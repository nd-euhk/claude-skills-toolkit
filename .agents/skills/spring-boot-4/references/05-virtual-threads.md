# Spring Boot 4 — Virtual Threads (Project Loom)

## Enable in One Line

```yaml
spring:
  threads:
    virtual:
      enabled: true
```

Configures Tomcat, `@Async`, and `@Scheduled` to use virtual threads automatically.

## What Changes

| Component | Before | After |
|-----------|--------|-------|
| Tomcat | Platform threads (200) | Virtual threads (unbounded) |
| @Async executor | ThreadPoolTaskExecutor | SimpleAsyncTaskExecutor |
| @Scheduled | ThreadPoolTaskScheduler | SimpleAsyncTaskScheduler |

## Virtual Threads vs WebFlux

| Factor | Virtual Threads | WebFlux |
|--------|----------------|----------|
| Code style | Imperative | Reactive (Mono/Flux) |
| Blocking I/O | Fine | Must avoid |
| Existing JDBC | Works as-is | Requires R2DBC |
| Learning curve | Low | High |
| **Default choice** | **Yes** | When backpressure needed |

## HikariCP — Keep Pool SMALL

```yaml
spring.datasource.hikari:
  maximum-pool-size: 10   # Low! Virtual threads pile up waiting for connections
  connection-timeout: 3000
```

## Avoid Pinning

```java
// BAD — synchronized causes virtual thread pinning
public synchronized void processOrder(Order order) { ... }

// GOOD — use ReentrantLock
private final ReentrantLock lock = new ReentrantLock();
public void processOrder(Order order) {
  lock.lock();
  try { jdbcTemplate.update(...); }
  finally { lock.unlock(); }
}
```

```bash
# Detect pinning
-Djdk.tracePinnedThreads=full
```
