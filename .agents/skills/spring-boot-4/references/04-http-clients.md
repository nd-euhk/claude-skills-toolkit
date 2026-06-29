# Spring Boot 4 — Declarative HTTP Clients

## Basic Setup

```java
@HttpExchange("https://payment-api.example.com")
public interface PaymentClient {
  @GetExchange("/payments/{id}")
  PaymentDto getPayment(@PathVariable String id);

  @PostExchange("/payments")
  PaymentDto createPayment(@RequestBody CreatePaymentRequest request);

  @DeleteExchange("/payments/{id}")
  void cancelPayment(@PathVariable String id);
}

@Configuration
public class HttpClientConfig {

  @Bean
  PaymentClient paymentClient(RestClient.Builder builder) {
    RestClient restClient = builder
        .baseUrl("https://payment-api.example.com")
        .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
        .build();
    return HttpServiceProxyFactory
        .builderFor(RestClientAdapter.create(restClient))
        .build()
        .createClient(PaymentClient.class);
  }
}
```

## Auth via Interceptor

```java
RestClient restClient = builder
    .baseUrl("https://secure-api.example.com")
    .requestInterceptor((req, body, exec) -> {
      req.getHeaders().setBearerAuth(tokenProvider.getToken());
      return exec.execute(req, body);
    })
    .build();
```

## Retry with Resilience4j

```java
@HttpExchange("https://payment-api.example.com")
public interface PaymentClient {

  @GetExchange("/payments/{id}")
  @Retry(name = "payment-service")
  @CircuitBreaker(name = "payment-service", fallbackMethod = "getPaymentFallback")
  PaymentDto getPayment(@PathVariable String id);

  default PaymentDto getPaymentFallback(String id, Exception e) {
    return PaymentDto.unavailable(id);
  }
}
```

```yaml
resilience4j:
  retry.instances.payment-service:
    max-attempts: 3
    wait-duration: 500ms
  circuit-breaker.instances.payment-service:
    sliding-window-size: 10
    failure-rate-threshold: 50
```

## Testing with WireMock

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@AutoConfigureWireMock(port = 0)
class PaymentClientTest {

  @Autowired PaymentClient client;

  @Test
  void getPayment_maps_response_correctly() {
    stubFor(get(urlEqualTo("/payments/123"))
        .willReturn(okJson("""
            {"id":"123","amount":9900,"status":"COMPLETED"}
            """)));
    var payment = client.getPayment("123");
    assertThat(payment.status()).isEqualTo("COMPLETED");
  }
}
```
