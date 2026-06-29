# Spring Boot 4 — Observability (OpenTelemetry + Micrometer)

## Dependencies

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-opentelemetry</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
<dependency>
  <groupId>io.micrometer</groupId>
  <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

## application.yml

```yaml
spring.application.name: my-service

management:
  endpoints.web.exposure.include: health,metrics,prometheus
  tracing.sampling.probability: 1.0
  otlp:
    tracing.endpoint: http://otel-collector:4318/v1/traces
    metrics.export.url: http://otel-collector:4318/v1/metrics

logging:
  pattern.console: '%d [%X{traceId},%X{spanId}] %-5level %logger - %msg%n'
```

## Custom Metrics

```java
@Service
public class OrderService {

  private final Counter ordersCreated;
  private final Timer orderProcessingTime;

  public OrderService(MeterRegistry registry) {
    this.ordersCreated = Counter.builder("orders.created")
        .tag("service", "order-service").register(registry);
    this.orderProcessingTime = Timer.builder("orders.processing.time")
        .publishPercentiles(0.5, 0.95, 0.99).register(registry);
  }

  public OrderDto createOrder(CreateOrderRequest req) {
    return orderProcessingTime.record(() -> {
      var order = orderRepository.save(Order.from(req));
      ordersCreated.increment();
      return OrderDto.from(order);
    });
  }
}
```

## Custom Tracing Span

```java
public PaymentResult processPayment(PaymentRequest request) {
  Span span = tracer.nextSpan().name("payment.process")
      .tag("payment.method", request.method()).start();
  try (Tracer.SpanInScope scope = tracer.withSpan(span)) {
    return doProcessPayment(request);
  } catch (Exception e) {
    span.error(e); throw e;
  } finally {
    span.end();
  }
}
```

## Grafana Dashboard

Import ID `19004` for the official Spring Boot dashboard.

Key metrics:
- `http_server_requests_seconds` — latency P50/P95/P99
- `jvm_memory_used_bytes` — heap usage
- `hikaricp_connections_active` — DB pool utilization
- `process_cpu_usage` — CPU
