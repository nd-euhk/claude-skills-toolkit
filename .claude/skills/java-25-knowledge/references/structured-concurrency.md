# Structured Concurrency in Java 25 (JEP 505)

**Status: STILL IN PREVIEW — 5th preview round in Java 25.**
**Requires `--enable-preview` at both compile time and runtime.**
**API changed significantly in Java 25 — do NOT use examples from Java 21-24.**

Read this when writing concurrent code that forks multiple tasks and needs to
handle their results or failures together — the "scatter/gather" pattern.

## Background

Structured Concurrency (Project Loom, JEP 505) provides a framework for
treating a group of concurrent tasks as a single unit of work, with clean
lifecycle management: all forked tasks either all complete, or all are
cancelled together. It eliminates the common pattern of spawning threads and
then manually tracking which ones failed, which are still running, and
whether the right things were cancelled when something went wrong.

**Why it's still preview:** the API was substantially redesigned in JDK 25
(the `StructuredTaskScope` class changed significantly from its JDK 24 shape).
The Java team considers the feature design correct in principle but wants
another round of real-world feedback before finalizing.

## Using it in Java 25 (new API shape)

```bash
# Must add --enable-preview to both compile and runtime
javac --enable-preview --release 25 MyService.java
java  --enable-preview MyService
```

```java
import java.util.concurrent.StructuredTaskScope;

// Java 25 API — StructuredTaskScope.open() is the new entry point
// (the old ShutdownOnFailure/ShutdownOnSuccess subclasses changed)
try (var scope = StructuredTaskScope.open()) {
    var inventoryFork = scope.fork(() -> inventoryService.getStock(sku));
    var pricingFork   = scope.fork(() -> pricingService.getPrice(sku));

    scope.join(); // waits for all forked tasks

    // After join() — read results
    return new ProductDetail(inventoryFork.get(), pricingFork.get());
}
```

If any forked task throws, `scope.join()` propagates the failure after
cancelling remaining tasks — no need to manually catch and cancel.

## Combining with Scoped Values (the key Java 25 pattern)

Scoped Values are inherited by forked tasks automatically:

```java
ScopedValue.where(REQUEST_ID, "req-123")
           .where(CURRENT_USER, currentUser)
           .run(() -> {
               try (var scope = StructuredTaskScope.open()) {
                   // Both forks automatically see REQUEST_ID and CURRENT_USER
                   var inventoryFork = scope.fork(() -> inventoryService.getStock(sku));
                   var pricingFork   = scope.fork(() -> pricingService.getPrice(sku));
                   scope.join();
                   return new ProductDetail(inventoryFork.get(), pricingFork.get());
               }
           });
```

This combination — Scoped Values (finalized) + Structured Concurrency
(preview) — is the direction Java is heading for high-concurrency request
handling, but the preview status means the code must opt in explicitly.

## When to use vs alternatives

| Scenario | Recommended approach |
|---|---|
| Multiple parallel calls, need all results | `StructuredTaskScope` (if preview is acceptable) |
| Multiple parallel calls, need all results, no preview | `CompletableFuture.allOf(...)` + join |
| Fire-and-forget async task | `@Async` (Spring) or `Thread.startVirtualThread(...)` |
| Sequential calls | Plain method calls — don't over-engineer |

## Important: API changed between Java 21-24 and Java 25

Code written for Java 21-24's `StructuredTaskScope` API **does not compile
as-is in Java 25** — the scope was redesigned. Key changes in Java 25:
- Entry point is now `StructuredTaskScope.open()` instead of
  `new StructuredTaskScope.ShutdownOnFailure()`
- `scope.fork(callable)` returns a `Subtask<T>` (unchanged)
- Policy handling for shutdown-on-failure vs shutdown-on-success is now
  configured differently

If converting existing JDK 21-24 `StructuredTaskScope` code to JDK 25:
treat it as a rewrite, not a simple migration, and consult current JDK 25
Javadoc for the exact API shape.

## Common mistakes

- **Omitting `--enable-preview`.** Since this is still preview, omitting the flag
  produces a compile error. Unlike `ScopedValue` (which is finalized and needs
  no flag), Structured Concurrency always needs the flag in Java 25.
- **Using Java 21-24 `StructuredTaskScope` API shape in Java 25 code.** The
  `ShutdownOnFailure`/`ShutdownOnSuccess` constructors changed — use
  `StructuredTaskScope.open()` in Java 25.
- **Using in production code without accepting the "may change in Java 26"
  risk.** Preview APIs are explicitly not stable — the Java team may change them.
  For production services, prefer `CompletableFuture` + virtual threads until
  this feature is finalized (expected Java 26).
