# GC and Memory in Java 25

**Status: Generational Shenandoah (JEP 516) finalized. Compact Object Headers
(JEP 519) promoted to product but opt-in. No changes to G1 defaults.**

Read this when selecting a GC, tuning heap size, or optimizing memory usage
for a service running in a Kubernetes/container environment.

## GC options in Java 25 — quick reference

| GC | Status in JDK 25 | When to use |
|---|---|---|
| **G1** | Default, unchanged | General purpose; the right choice for most services unless you have a specific latency requirement. Keep using it if you're already on it. |
| **Generational ZGC** (`-XX:+UseZGC`) | Stable since JDK 21 | Low-latency (<1ms pause target), large heaps (>16GB), or when G1 pause times are causing issues |
| **Generational Shenandoah** (`-XX:+UseShenandoahGC`) | **Finalized in JDK 25** | Low-latency alternative to ZGC; competitive pause times with lower memory overhead; not available in Oracle JDK (OpenJDK only) |
| **Serial** | Unchanged | Single-threaded, small heaps only. Not relevant for server services. |

**Nothing to change** if a service is already running well on G1 — there are no
default GC changes in Java 25.

## Generational Shenandoah (JEP 516) — what's new

Shenandoah already existed in Java 21, but without generational support — it
processed all live objects on every GC cycle regardless of age, which was
inefficient. JDK 25 finalizes its generational mode (shorter-lived objects
collected more frequently, longer-lived objects less frequently — the same
generational hypothesis as G1/ZGC).

Enable Shenandoah with generational support:
```bash
java -XX:+UseShenandoahGC -XX:ShenandoahGCMode=generational -jar app.jar
```

Or just enable it (generational is the recommended mode):
```bash
java -XX:+UseShenandoahGC -jar app.jar
```

**Note:** Shenandoah is not included in Oracle JDK — only in OpenJDK builds
(Eclipse Temurin, Red Hat builds, Azul Zulu, etc.). If `-XX:+UseShenandoahGC`
produces an error, the JDK distribution doesn't include it.

## Compact Object Headers (JEP 519) — opt-in product feature

Reduces every Java object's header from 96–128 bits to 64 bits on 64-bit
architectures. This shrinks heap usage by ~10–20% for typical applications.

```bash
# Opt in — not the default in Java 25
java -XX:+UseCompactObjectHeaders -jar app.jar
```

**When to enable:** services with high object counts (lots of small DTOs,
collections, records), or services running in memory-constrained containers.

**When to be careful:** if the service uses any native (JNI) libraries that
depend on specific object header layout — test thoroughly before enabling in
production. The JVM validates at startup and will refuse to start if it detects
a known incompatibility.

## Container-aware heap sizing (no change from Java 11+, but important)

Since Java 11, the JVM automatically detects container resource limits:

```bash
java -XX:MaxRAMPercentage=75.0 -jar app.jar
# Uses up to 75% of the container's memory limit as max heap
# Better than -Xmx because it adapts to whatever the pod limit is
```

This is not new in Java 25 but is the correct approach for Kubernetes
deployments — don't hardcode `-Xmx512m` when the container memory limit
is the source of truth.

## Common mistakes

- **Enabling Shenandoah on Oracle JDK distributions.** Oracle JDK doesn't ship
  it; use an OpenJDK-based distribution if Shenandoah is the target.
- **Leaving `-XX:+UnlockExperimentalVMOptions -XX:+UseShenandoahGC` flags from
  a pre-Java-25 setup.** `UnlockExperimentalVMOptions` is no longer needed for
  Shenandoah in Java 25 (it's a product feature now), and leaving it causes a
  warning or error depending on JVM version. Remove the experimental unlock flag.
- **Jumping to Shenandoah or ZGC without measuring G1 behavior first.** Both are
  more operationally complex. Unless G1 pause times are actually causing
  observable latency problems in production, the complexity isn't worth it.
- **Using `-Xmx` in Kubernetes instead of `-XX:MaxRAMPercentage`.** If the pod
  limit changes (scale up/down event, resource tuning), a hardcoded `-Xmx` value
  doesn't adapt. `MaxRAMPercentage` adapts automatically.
