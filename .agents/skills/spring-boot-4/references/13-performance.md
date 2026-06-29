# Spring Boot 4 — Performance Tuning

## JVM Flags (Java 21)

```bash
-XX:+UseZGC -XX:+ZGenerational
-Xms256m -Xmx512m
-XX:MaxRAMPercentage=75.0
-XX:+UseStringDeduplication
-Djava.security.egd=file:/dev/./urandom
```

## application.yml Optimizations

```yaml
spring:
  main.lazy-initialization: true
  jpa:
    open-in-view: false
    properties.hibernate:
      default_batch_fetch_size: 100
      jdbc.batch_size: 50
      order_inserts: true
      order_updates: true
  cache:
    type: caffeine
    caffeine.spec: maximumSize=10000,expireAfterWrite=10m,recordStats
```

## Spring Cache

```java
@Configuration
@EnableCaching
public class CacheConfig {
  @Bean
  CacheManager cacheManager() {
    return new CaffeineCacheManager(
        Caffeine.newBuilder().maximumSize(1000).expireAfterWrite(10, MINUTES).recordStats().build()
    );
  }
}

@Service
public class ProductService {
  @Cacheable("products") public ProductDto getProduct(Long id) { ... }
  @CachePut(value = "products", key = "#result.id") public ProductDto update(Long id, ...) { ... }
  @CacheEvict("products") public void delete(Long id) { ... }
}
```

## Redis (Distributed Cache)

```yaml
spring:
  cache.type: redis
  data.redis:
    host: redis
    port: 6379
    timeout: 2s
```

```java
@Bean
RedisCacheConfiguration cacheConfig() {
  return RedisCacheConfiguration.defaultCacheConfig()
      .entryTtl(Duration.ofMinutes(10))
      .disableCachingNullValues();
}
```

## JFR Profiling

```bash
# Record during runtime
jcmd <pid> JFR.start duration=60s filename=profile.jfr

# Or at startup
-XX:StartFlightRecording=duration=60s,filename=profile.jfr,settings=profile
```

## Load Testing Checklist

- [ ] Run Gatling/k6 before production
- [ ] Check HikariCP pool saturation: `hikaricp_connections_pending_threads`
- [ ] GC pause < 10ms with ZGC
- [ ] P99 latency meets SLA
- [ ] Test graceful shutdown under load
