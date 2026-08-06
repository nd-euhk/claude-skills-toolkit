# JVM Startup and Warmup Performance in Java 25

**Status: JEP 514 (AOT Cache) and JEP 515 (AOT Method Profiling) — FINALIZED.
No flags needed beyond the explicit `-XX:AOTCache*` options shown below.**

Read this when optimizing application startup time, configuring AOT caches,
or working with Spring Boot AOT in a container/Kubernetes deployment.

## Background — what changed between Java 21 and Java 25

Java 21 had Class Data Sharing (CDS) and Application CDS (AppCDS) for startup
improvement, but the workflow was multi-step and verbose:

```bash
# Java 21 AppCDS — 3 steps, verbose
java -Xshare:off -XX:DumpLoadedClassList=classes.lst -jar app.jar
java -Xshare:dump -XX:SharedClassListFile=classes.lst \
     -XX:SharedArchiveFile=app.jsa -jar app.jar
java -Xshare:on -XX:SharedArchiveFile=app.jsa -jar app.jar
```

Java 25 simplifies this to 2 steps with the new AOT cache commands (JEP 514),
and adds method profiling to the same cache (JEP 515) so the JIT compiler can
generate optimized native code **immediately on startup** rather than waiting
for warmup:

```bash
# Java 25 AOT Cache — 2 steps, readable
java -XX:AOTCacheOutput=app.aot -jar app.jar  # creates cache on shutdown
java -XX:AOTCache=app.aot -jar app.jar         # uses cache on subsequent starts
```

**Important for agents with old training data:** The old 3-step AppCDS workflow
still works in Java 25 for compatibility, but it's no longer the recommended
approach. The new 2-step `-XX:AOTCacheOutput` / `-XX:AOTCache` commands are the
current standard and what new documentation/examples should use.

## Full worked example — AOT cache for a Spring Boot service

### Step 1: Create the cache (training run)

```bash
# Run the app normally — JVM records class loading, linking, and JIT profiles
# into the cache file on shutdown (via a JVM shutdown hook)
java \
  -XX:AOTCacheOutput=app.aot \
  -jar target/order-service-1.0.0.jar \
  --spring.main.web-application-type=none \
  --spring.context.exit=onRefresh
```

`--spring.context.exit=onRefresh` tells Spring Boot to exit immediately after
the context is refreshed (not to actually start handling requests) — this is
enough for the JVM to record class loading from the Spring startup phase, which
is where most of the startup time comes from.

### Step 2: Run with the cache

```bash
java \
  -XX:AOTCache=app.aot \
  -jar target/order-service-1.0.0.jar
```

The JVM loads already-linked, already-resolved class data from the cache instead
of parsing class files fresh, and starts the JIT compiler with pre-recorded
profiles from the training run — measurably faster startup and faster initial
throughput.

### Dockerfile integration

```dockerfile
FROM eclipse-temurin:25-jre AS build-aot
WORKDIR /app
COPY target/*.jar app.jar
# Training run to generate AOT cache
RUN java -XX:AOTCacheOutput=app.aot -jar app.jar \
    --spring.main.web-application-type=none \
    --spring.context.exit=onRefresh

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build-aot /app/app.jar ./
COPY --from=build-aot /app/app.aot ./
ENTRYPOINT ["java", "-XX:AOTCache=app.aot", "-jar", "app.jar"]
```

## Compact Object Headers (JEP 519) — opt-in, separate from AOT

Java 25 promotes Compact Object Headers from experimental to product. By
default, every Java object on the heap carries a 96–128-bit header (mark word +
class pointer). JEP 519 reduces this to 64 bits, shrinking heap usage by
roughly 10–20% for typical applications. It is **opt-in** — not the default:

```bash
java -XX:+UseCompactObjectHeaders -jar app.jar
```

When to use: services with large heaps, many small objects (lots of String,
small record instances), or memory-constrained container environments.
When not to: the flag changes the internal object layout — some JNI native code
that makes assumptions about header size may break. Test with this flag before
shipping to production, especially if the service uses native libraries.

## Ahead-of-Time Method Profiling (JEP 515)

Automatically included when using the AOT cache (`-XX:AOTCacheOutput`). The JVM
records method execution profiles (which methods get hot, how they branch) during
the training run and stores them alongside the class data in the cache file.

On subsequent starts, the JIT compiler reads these stored profiles and begins
generating optimized native code immediately, rather than waiting for JIT warmup
(which typically takes several seconds to minutes of real traffic before
code reaches peak performance). This closes the "cold start problem" gap that
exists even after class loading is fast.

No separate configuration needed — it's part of the same 2-step AOT workflow.

## Performance improvement expectations

These are illustrative ranges, not guarantees — actual numbers depend on
application size, class count, and workload:

| Optimization | Typical startup improvement |
|---|---|
| AOT Cache (JEP 514) — class loading only | 20–40% faster startup |
| + Compact Object Headers (JEP 519) | 10–20% less heap usage |
| + Method Profiling (JEP 515) | Faster peak throughput from the first request |

All three together are complementary and can be enabled in combination.

## Common mistakes

- **Using the old 3-step AppCDS workflow (`-XX:DumpLoadedClassList`,
  `-XX:SharedClassListFile`)** instead of the new 2-step AOT cache. It still
  works but is verbose and no longer the recommended approach in Java 25+.
- **Running the training step with the full application under real load**
  instead of the `--spring.context.exit=onRefresh` quick-exit approach. The full
  run works too, but the quick-exit approach produces a cache that's just as good
  for startup (Spring context loading is the biggest startup contributor) with
  much less CI/CD complexity.
- **Enabling `-XX:+UseCompactObjectHeaders` without testing native library
  compatibility.** If the service uses JNI native code that assumes standard
  object header layout, this flag can cause crashes — test first.
- **Copying the AOT cache file between different JVM versions or JDK
  distributions.** The cache is JVM-version-specific and vendor-specific — a
  cache generated on Eclipse Temurin 25 is not valid for Azul Zulu 25. Regenerate
  it if the JDK changes.
- **Forgetting to regenerate the cache after a dependency or code change.** A
  stale cache won't crash the application (the JVM validates it at startup and
  falls back gracefully if it doesn't match), but it also won't provide the
  startup benefit if the class set has changed significantly.
