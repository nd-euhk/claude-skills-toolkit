# HTTP Service Client / inter-service call convention (team-specific)

Read this when writing or editing `@HttpExchange` interfaces, inter-service
HTTP calls, or anything that used to go through `RestTemplate` (auto-config
removed in Boot 4 — Tier 2 in the main SKILL.md).

## Safe default — declarative client with header propagation

The interface declares *what* to call; the factory bean configures *how*
(base URL, interceptors for things like trace ID and auth token
propagation, timeouts):

```java
package com.example.app.client;

import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.PostExchange;

public interface InventoryServiceClient {

    @GetExchange("/api/inventory/{sku}")
    InventoryResponse getStock(@PathVariable String sku);

    @PostExchange("/api/inventory/reserve")
    ReservationResponse reserve(@RequestBody ReservationRequest request);
}
```

```java
package com.example.app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

@Configuration
public class HttpClientConfig {

    @Bean
    InventoryServiceClient inventoryServiceClient(
            @Value("${services.inventory.base-url}") String baseUrl) {

        RestClient restClient = RestClient.builder()
            .baseUrl(baseUrl)
            // Propagates the incoming trace/correlation ID to the downstream
            // call. Without this, distributed tracing across services breaks
            // silently — requests still succeed, but you lose the ability to
            // correlate logs/spans across the call chain.
            .requestInterceptor((request, body, execution) -> {
                String traceId = MDC.get("traceId");
                if (traceId != null) {
                    request.getHeaders().add("X-Trace-Id", traceId);
                }
                return execution.execute(request, body);
            })
            .build();

        HttpServiceProxyFactory factory = HttpServiceProxyFactory
            .builderFor(RestClientAdapter.create(restClient))
            .build();

        return factory.createClient(InventoryServiceClient.class);
    }
}
```

```yaml
services:
  inventory:
    base-url: http://inventory-service:8080
```

## Common mistakes to watch for (these compile and run, but are wrong)

- **Porting old `RestTemplate` code by just deleting the `RestTemplate`
  bean and writing an `@HttpExchange` interface, without checking whether
  the old code had interceptors for auth/tracing.** Since `RestTemplate`
  auto-configuration is gone in Boot 4 (Tier 2), this migration is exactly
  where header propagation (trace ID, auth token forwarding) is easiest to
  silently drop — the new client compiles and makes successful calls in a
  quick test, but loses cross-cutting behavior the old one had.
- **No timeout configured.** `RestClient.builder()` without an explicit
  `ClientHttpRequestFactory` timeout configuration can hang on a slow or
  unresponsive downstream service. Always set connect/read timeouts
  explicitly for inter-service calls — don't rely on infinite defaults.
- **Swallowing downstream error responses instead of translating them.**
  By default, a 4xx/5xx from the downstream service throws a
  `RestClientResponseException` — if the calling code doesn't catch and
  translate this into a meaningful error for its own caller, the failure
  mode becomes a generic 500 with no useful context.
- **One `@HttpExchange` interface per downstream service is fine, but
  duplicating the same interceptor logic (trace ID propagation, auth
  forwarding) in every `RestClient.builder()` call across multiple
  clients.** If this is happening, extract a shared
  `RestClient.Builder` bean with the cross-cutting interceptors applied
  once, and have each service-specific client customize from that shared
  builder instead of starting from scratch.

## Capture checklist (things the team needs to decide)

- [ ] Whether there's a shared base `RestClient.Builder` bean with
      department-wide interceptors (trace ID, auth forwarding) that all
      service clients should build from, rather than each client configuring
      its own as in the example above.
- [ ] Standard timeout values for inter-service calls.
- [ ] Retry/circuit-breaker convention (e.g. Resilience4j), if standardized —
      and how it layers on top of the `@HttpExchange` pattern above.
- [ ] Error translation convention — how a downstream 4xx/5xx should map to
      this service's own response/exception model.

## Migration note (3.x → 4.x)

`RestTemplate` auto-config was removed. Search for any code calling
`new RestTemplate()` or injecting `RestTemplate` without an explicit bean
declaration — it won't exist at runtime. Prefer migrating to `@HttpExchange`
+ `RestClient` for new inter-service calls, but a plain `RestTemplate` bean
is the lowest-risk bridge for existing code.
