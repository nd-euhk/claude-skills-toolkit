# Scoped Values (JEP 506) — Finalized in Java 25

**Status: FINALIZED in Java 25. No `--enable-preview` needed.**

Read this when writing code that passes context data (user identity, request ID,
trace context, transaction info) across a call stack or across threads — and
especially when the code uses Virtual Threads or Structured Concurrency.

## Background — why this exists and what replaces what

`ThreadLocal` has been the standard way to pass context across a call stack
without threading values through every method parameter since Java 1.2. It
worked acceptably for 25 years of platform (OS) threads, but has three serious
problems that become acute with Virtual Threads:

1. **Mutable by anyone** — any code anywhere in the call stack can call `set()`,
   silently overwriting a value that other code assumed was stable.
2. **Unbounded lifetime** — the value lives for the entire thread lifetime.
   With thread pools, threads are reused and `ThreadLocal` values from a previous
   request can "bleed" into the next unless explicitly `remove()`d. With virtual
   threads (which are short-lived and potentially millions of them), copying
   inherited `ThreadLocal` values to each new virtual thread wastes heap.
3. **Breaks with Virtual Threads** — a `ThreadLocal` value set on one virtual
   thread is NOT accessible in another virtual thread (e.g. one spawned via
   `scope.fork()` in Structured Concurrency). This is the most dangerous
   failure mode: code that passes tests with platform threads silently returns
   `null` at runtime with virtual threads.

`ScopedValue` solves all three: values are **immutable** within a scope,
automatically **cleaned up when the scope exits**, and **inherited by all child
threads** spawned within that scope at zero copy cost.

**Important:** On JDK 21–24, ScopedValue was a preview feature requiring
`--enable-preview`. **On JDK 25, it is finalized — no flag needed.**

## Core API

```java
// Declaration — static final, like ThreadLocal
static final ScopedValue<String> REQUEST_ID = ScopedValue.newInstance();
static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

// Binding and running — ScopedValue.where(KEY, value).run(lambda)
ScopedValue.where(REQUEST_ID, "req-abc123").run(() -> {
    handleRequest(); // REQUEST_ID.get() returns "req-abc123" anywhere in here
});
// After run() returns — REQUEST_ID.get() is gone, throws NoSuchElementException

// Reading — anywhere in the call stack within the scope
String id = REQUEST_ID.get(); // returns bound value
String id = REQUEST_ID.orElse("unknown"); // safe default if not bound

// Binding multiple values together
ScopedValue.where(REQUEST_ID, "req-abc123")
           .where(CURRENT_USER, authenticatedUser)
           .run(() -> processRequest());

// call() instead of run() — when you need a return value from the scope
String result = ScopedValue.where(REQUEST_ID, "req-abc123")
                           .call(() -> computeResult()); // call() throws checked Exception
```

## Full worked example — request context in a web handler

This is the most common use case: binding per-request context at the entry
point so it's available throughout the entire request processing chain.

```java
package com.example.app.context;

public final class RequestContext {

    // One ScopedValue per piece of context — static final, package-private or
    // public depending on who needs to read them.
    public static final ScopedValue<String> REQUEST_ID = ScopedValue.newInstance();
    public static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

    private RequestContext() {}
}
```

```java
package com.example.app.web;

import static com.example.app.context.RequestContext.*;

@RestController
public class OrderController {

    @GetMapping("/api/orders/{id}")
    public OrderResponse getOrder(@PathVariable String id,
                                  @RequestHeader("X-Request-Id") String requestId,
                                  Authentication auth) {
        // Bind context once at the request entry point
        return ScopedValue.where(REQUEST_ID, requestId)
                          .where(CURRENT_USER, (User) auth.getPrincipal())
                          .call(() -> orderService.getOrder(id));
    }
}
```

```java
package com.example.app.service;

import static com.example.app.context.RequestContext.*;

@Service
public class OrderService {

    public OrderResponse getOrder(String id) {
        // No method parameter needed — reads from the active scope
        String requestId = REQUEST_ID.get();
        User user = CURRENT_USER.get();

        log.info("Request {} by user {}: fetching order {}", requestId, user.id(), id);

        // Works correctly in a virtual thread too — unlike ThreadLocal
        return orderRepository.findByIdAndUser(id, user.id())
            .map(OrderResponse::from)
            .orElseThrow(() -> new OrderNotFoundException(id));
    }
}
```

## Full worked example — context propagation to child virtual threads

The critical difference from `ThreadLocal`: child threads spawned inside
a `ScopedValue` scope automatically inherit the bound values, at zero
copy cost:

```java
// With ThreadLocal — BROKEN with virtual threads
static final ThreadLocal<String> TL_REQUEST_ID = new ThreadLocal<>();

TL_REQUEST_ID.set("req-123");
Thread.startVirtualThread(() -> {
    System.out.println(TL_REQUEST_ID.get()); // prints "null" — not inherited
});

// With ScopedValue — WORKS correctly
static final ScopedValue<String> SV_REQUEST_ID = ScopedValue.newInstance();

ScopedValue.where(SV_REQUEST_ID, "req-123").run(() -> {
    Thread.startVirtualThread(() -> {
        System.out.println(SV_REQUEST_ID.get()); // prints "req-123" — inherited
    }).join();
});
```

With Structured Concurrency (still preview in JDK 25, but illustrative):

```java
ScopedValue.where(REQUEST_ID, "req-abc")
           .where(CURRENT_USER, user)
           .run(() -> {
               try (var scope = StructuredTaskScope.open()) {
                   // All forked tasks inherit REQUEST_ID and CURRENT_USER
                   var inventoryTask = scope.fork(() -> inventoryService.getStock(sku));
                   var pricingTask   = scope.fork(() -> pricingService.getPrice(sku));
                   scope.join().throwIfFailed();

                   return new ProductDetail(inventoryTask.get(), pricingTask.get());
               }
           });
```

## Rebinding — overriding a value for a nested scope

```java
ScopedValue.where(CURRENT_USER, adminUser).run(() -> {
    // This outer scope runs as adminUser

    ScopedValue.where(CURRENT_USER, regularUser).run(() -> {
        // This inner scope temporarily runs as regularUser
        // CURRENT_USER.get() returns regularUser here
    });

    // Back here, CURRENT_USER.get() returns adminUser again
    // The outer binding is restored automatically
});
```

Note: this is not mutation — the inner `where().run()` creates a new binding
that shadows the outer one within its scope, and the outer binding resumes
automatically when the inner scope exits.

## ThreadLocal → ScopedValue migration guide

| Scenario | Keep ThreadLocal? | Migrate to ScopedValue? |
|---|---|---|
| Request-scoped context (user, request ID, trace ID) | No — migrate | Yes |
| Security context propagation | No — migrate | Yes |
| MDC trace ID for logging | Prefer OTel (auto-handles this) | Yes if doing manually |
| Per-thread mutable cache (e.g. cached regex, SimpleDateFormat) | **Yes** | No — ScopedValue is immutable |
| Connection/resource per-thread | **Yes** | No |
| Legacy framework code you don't own | **Yes** | Only when refactoring it |

Key rule: **if the value needs to be mutable within a thread's execution,
`ThreadLocal` is still the correct tool.** `ScopedValue` is only for
read-only context sharing.

## Common mistakes (these compile and run, but are wrong)

- **Writing `--enable-preview` in javac/run commands when targeting JDK 25.**
  ScopedValue is finalized — no flag needed. Adding it anyway marks the code as
  depending on a preview feature, which changes behavior expectations and may
  produce warnings.
- **Calling `ScopedValue.get()` outside a scope.** If the scope has ended (or
  was never started), `get()` throws `NoSuchElementException`. Use
  `orElse(defaultValue)` at call sites where the value might not be bound yet
  (e.g. background jobs that don't have a request context).
- **Expecting `ScopedValue` to replace `ThreadLocal` for mutable state.** It
  cannot — values are immutable within a scope. Rebinding (via a nested
  `where().run()`) creates a new scope, not a mutation of the current one.
- **Declaring `ScopedValue` as an instance field.** Declare it `static final` —
  same as `ThreadLocal`, the key is a shared identity object, not a per-instance
  thing.
- **Using `ScopedValue` without Virtual Threads and assuming it offers a
  performance advantage.** The zero-copy inheritance benefit only materializes
  at scale with virtual threads. For single-threaded or small thread-pool code,
  `ThreadLocal` and `ScopedValue` are both fine; `ScopedValue` is still
  preferred for new code because of the cleaner lifecycle, but don't oversell it
  as a performance improvement if virtual threads aren't in use.
