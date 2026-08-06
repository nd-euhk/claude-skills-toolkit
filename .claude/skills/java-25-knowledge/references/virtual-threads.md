# Virtual Threads in Java 25

**Status: Finalized since Java 21. No flags needed.**

Read this when configuring thread pools, writing concurrent request handling,
or enabling virtual thread support in Spring Boot 4.x.

## Background (for agents that may not know Java 21 features)

Virtual Threads (Project Loom, JEP 444) are JVM-managed threads that are
extremely lightweight — you can create **millions** of them without exhausting
memory or OS thread limits. Unlike platform (OS) threads which each consume
~1MB of stack memory, virtual threads are cheap enough that one per request
is a practical model again, eliminating the need for reactive programming
(`WebFlux`, `CompletableFuture` chaining) just to handle concurrent I/O.

When a virtual thread blocks on I/O (reading from a socket, waiting on a
database query, calling `Thread.sleep()`), the JVM automatically unmounts it
from the carrier (OS) thread and parks it — the carrier thread is freed to
run other virtual threads. When the I/O completes, the virtual thread is
remounted on any available carrier thread and continues.

**Java 21:** Virtual Threads finalized.
**Java 25:** No change to the Virtual Threads API itself, but Scoped Values
(JEP 506) finalization and Structured Concurrency improvements make virtual
threads significantly more practical for real application code.

## Creating virtual threads

```java
// One-off virtual thread
Thread vt = Thread.ofVirtual().start(() -> System.out.println("running"));

// Named (for diagnostics)
Thread vt = Thread.ofVirtual().name("request-handler-", 0).start(task);

// Via an ExecutorService — one virtual thread per task
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> handleRequest(req1));
    executor.submit(() -> handleRequest(req2));
} // executor.close() waits for all submitted tasks to complete
```

## Spring Boot 4.x integration

Enable virtual threads for all incoming HTTP requests (Tomcat switches to
virtual-thread-per-request model instead of a thread pool):

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

This is a single-line change. Spring Boot handles the executor configuration
automatically — no `@Bean TaskExecutor` or manual Tomcat connector setup needed.

## When virtual threads help vs don't help

**Virtual threads help (I/O-bound work):**
- HTTP request handlers that call databases, external APIs, or other services
- Any code that spends most of its time blocked on network/disk I/O
- High-concurrency workloads where thread pool exhaustion was a bottleneck

**Virtual threads do NOT help (CPU-bound work):**
- Number crunching, encryption, image processing, JSON serialization at scale
- These still need platform threads or parallel streams with a bounded pool
- A CPU-bound task on a virtual thread simply ties up the carrier thread for
  the duration — no benefit, and you've lost the ability to tune the pool size

## Thread-per-request model with `ScopedValue` (Java 25 combination)

Virtual Threads + Scoped Values is the idiomatic Java 25 pattern for
request-scoped context that works correctly across the entire call chain:

```java
// At the request entry point (e.g. a filter or interceptor):
ScopedValue.where(REQUEST_ID, extractRequestId(request))
           .where(CURRENT_USER, authenticateUser(request))
           .run(() -> chain.doFilter(request, response));

// Anywhere downstream — including code running on child virtual threads:
String requestId = REQUEST_ID.get(); // always correct, even on child threads
```

See `references/scoped-values.md` for the full pattern.

## ThreadLocal interaction with virtual threads — the silent bug

This is the most important pitfall for code migrating from platform to
virtual threads:

```java
static final ThreadLocal<String> TL = new ThreadLocal<>();

// On a platform thread pool — WORKS (same thread handles the whole request)
TL.set("user-123");
callServiceA(); // TL.get() returns "user-123" inside callServiceA

// After enabling virtual.threads.enabled=true in Spring Boot:
// The same code MAY still work for single-threaded flows, but...
Thread.startVirtualThread(() -> {
    System.out.println(TL.get()); // NULL — child virtual threads don't inherit
});
```

**Diagnostic flag** (run once to surface all ThreadLocal mutations on virtual
threads in your app):

```
-Djdk.traceVirtualThreadLocals=true
```

This logs a stack trace every time a virtual thread mutates a ThreadLocal.
Use this to audit an existing codebase before enabling virtual threads — it
surfaces hidden ThreadLocal usage in third-party code too.

## Common mistakes

- **Enabling `spring.threads.virtual.enabled=true` without auditing
  ThreadLocal usage.** If the app or its dependencies use ThreadLocal for
  context (very common in Spring Security, MDC, transaction management), some of
  those values may silently become `null` on code paths that use child virtual
  threads. Use the diagnostic flag above first.
- **Creating a `newVirtualThreadPerTaskExecutor()` for CPU-bound work.** The
  executor still runs tasks concurrently — there's just no benefit (and
  potentially higher carrier-thread contention) compared to a bounded platform
  thread pool for pure CPU work.
- **Using a `synchronized` block that holds a lock across I/O inside a virtual
  thread.** A `synchronized` block pins the virtual thread to its carrier thread
  for the duration — blocking I/O inside `synchronized` negates the unmounting
  benefit. Prefer `ReentrantLock` for locks that might be held across I/O.
- **Assuming a virtual thread completes on the same carrier thread it started
  on.** After an I/O await, a virtual thread resumes on whatever carrier thread
  is available — not necessarily the same one. Code that assumes
  "same thread = same carrier" breaks.
