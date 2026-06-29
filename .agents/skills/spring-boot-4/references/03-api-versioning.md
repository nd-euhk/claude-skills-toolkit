# Spring Boot 4 — Built-in API Versioning

## Overview

Spring Boot 4 introduces native API versioning support — no more custom filters or libraries needed.

## Versioning Strategies

### 1. Header-based (Recommended for microservices)

```yaml
spring:
  mvc:
    versioning:
      strategy: header
      header-name: API-Version
```

```bash
curl -H 'API-Version: 2' http://localhost:8080/api/users/1
```

### 2. Path-based

```yaml
spring:
  mvc:
    versioning:
      strategy: path
```

### 3. Query Parameter

```yaml
spring:
  mvc:
    versioning:
      strategy: query-param
      param-name: version
```

## Controller Pattern

```java
@RestController
@RequestMapping("/api/orders")
public class OrderController {

  @GetMapping(version = "1")
  public OrderV1Dto getOrderV1(@PathVariable Long id) {
    return orderService.findByIdV1(id);
  }

  @GetMapping(version = "2")
  public OrderV2Dto getOrderV2(@PathVariable Long id) {
    return orderService.findByIdV2(id);
  }
}
```

## Deprecation Headers (RFC 8594)

```java
@GetMapping(version = "1")
@Deprecated
public ResponseEntity<UserV1Dto> getUserV1(@PathVariable Long id) {
  HttpHeaders headers = new HttpHeaders();
  headers.add("Deprecation", "true");
  headers.add("Sunset", "2026-12-31");
  headers.add("Link", "</api/users/" + id + ">; rel=\"successor-version\"");
  return ResponseEntity.ok().headers(headers).body(service.findV1(id));
}
```

## Default Version Fallback

```yaml
spring:
  mvc:
    versioning:
      default-version: 1
```

## Testing

```java
@Test void v1_returns_old_schema() {
  var headers = new HttpHeaders();
  headers.set("API-Version", "1");
  var resp = rest.exchange("/api/orders/1", GET,
      new HttpEntity<>(headers), OrderV1Dto.class);
  assertThat(resp.getStatusCode()).isEqualTo(OK);
}
```
