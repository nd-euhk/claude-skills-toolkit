# Observability / OpenTelemetry convention (team-specific)

Read this when writing or editing tracing, metrics, or logging
instrumentation — Boot 4 added the `spring-boot-starter-opentelemetry`
starter and moved to Micrometer 2 (see main SKILL.md for the baseline facts).

## Safe default — starter setup + custom span/metric

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-opentelemetry</artifactId>
</dependency>
```

```yaml
management:
  otlp:
    metrics:
      export:
        url: http://otel-collector:4318/v1/metrics
    tracing:
      endpoint: http://otel-collector:4318/v1/traces
  tracing:
    sampling:
      probability: 1.0  # 100% in dev; lower this in production (e.g. 0.1)
```

Custom span around a service-layer method, using `@Observed` rather than
manually managing spans:

```java
package com.example.app.service;

import io.micrometer.observation.annotation.Observed;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    // Produces both a trace span AND a timer metric for this method,
    // tagged with the name below. Naming convention matters here — see
    // the mistakes section.
    @Observed(name = "order.place", contextualName = "place-order")
    public OrderResult placeOrder(OrderRequest request) {
        // ...
    }
}
```

For `@Observed` to actually take effect, an `ObservedAspect` bean must
exist — this is the single most common reason it silently does nothing:

```java
@Configuration
public class ObservabilityConfig {

    @Bean
    ObservedAspect observedAspect(ObservationRegistry registry) {
        return new ObservedAspect(registry);
    }
}
```

Custom metric with consistent tags applied globally via a `MeterFilter`,
so every metric automatically carries service/environment context without
remembering to add it on every individual metric call:

```java
@Configuration
public class MetricsConfig {

    @Bean
    MeterFilter commonTagsFilter(
            @Value("${spring.application.name}") String serviceName,
            @Value("${app.environment}") String environment) {
        return MeterFilter.commonTags(Tags.of(
            "service", serviceName,
            "environment", environment
        ));
    }
}
```

## Common mistakes to watch for (these compile and run, but are wrong)

- **Adding `@Observed` without registering the `ObservedAspect` bean.**
  The annotation silently does nothing — no span, no metric, no error. If
  `@Observed` is being introduced and the bean above doesn't already exist
  somewhere in the project's config, add it; otherwise the annotation is
  decorative.
- **Inconsistent span/metric naming across services.** If one service uses
  `order.place` and another uses `OrderService.placeOrder` for a
  conceptually similar operation, dashboards and alerting that aggregate
  across services break silently — the data's there, it just doesn't
  group the way anyone expects. Pin a naming convention (e.g.
  `<domain>.<action>`, lowercase, dot-separated) before this proliferates.
- **100% trace sampling left on in a production config copied from dev.**
  Works fine functionally, but generates far more trace volume (and cost)
  than intended — and nothing about it looks "wrong" until someone notices
  the bill or the collector falling behind.
- **Forgetting trace context propagation across thread boundaries.** If a
  service spawns work onto a separate thread (e.g. `@Async`, an executor),
  trace context doesn't automatically follow unless context propagation is
  explicitly configured — the async work shows up as a disconnected trace,
  or no trace at all, with no error to indicate why.

## Capture checklist (things the team needs to decide)

- [ ] The actual department-wide span/metric naming convention (replace the
      `order.place` guess above with the real pattern once one exists).
- [ ] Standard tags every metric should carry beyond `service`/`environment`
      (e.g. `version`, `region`) — extend the `MeterFilter` example above.
- [ ] Whether `@Observed` is the standard instrumentation approach, or whether
      some services manually manage spans for finer control.
- [ ] The actual OTLP collector endpoint per environment (dev/staging/prod),
      and the production sampling rate (the `1.0` above is a dev-only value).

## Migration note (3.x → 4.x)

Micrometer 2 changes some metric naming conventions. Existing custom metrics
may need renaming. The `spring-boot-starter-opentelemetry` starter replaces
several individual observability starters from 3.x — check if the old project
was pulling in Brave/Zipkin or OpenTelemetry individually.
