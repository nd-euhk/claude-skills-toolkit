---
title: "Architecture — Condensed"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - project-overview.md
  - ../docs/ARCHITECT/ADD.md
referenced_by:
  - tech-design/*.md
  - hard-boundaries.md
  - ../contracts/api-*.yaml
changelog:
  - 2.1 | {{date}} | Removed duplicate with ADD — kept agent-only sections
  - 2.0 | {{date}} | Expanded — package structure, shared modules, env config
  - 1.0 | {{date}} | Condensed from ADD
---

# Architecture — Condensed for Agent

> **Mục đích**: Agent đọc file này biết **cách tổ chức code** để implement đúng.
> File này KHÔNG lặp lại kiến trúc hệ thống (đã có trong ADD).
>
> **Đọc trước**: `docs/ARCHITECT/ADD.md` → System topology, Communication patterns, Data architecture, Security architecture.
> **File này bổ sung**: Package structure, shared modules, env config, cross-cutting — những thứ agent cần khi CODE mà ADD không cover.
>
> **Context budget**: ~ 150 dòng.

<!--
HARD RULES (xem SPEC-BOUNDARIES.md):

  1. Package structure ở §2 là LAYOUT REFERENCE (directory tree + filename
     pattern), KHÔNG phải implementation. Tên file là pattern gợi ý, source
     code quyết định tên chính xác.
  2. §4 env config: hiển thị YAML bắt buộc ở mức "setting key + default
     value", không phải full application.yml.
  3. Error handling / caching / monitoring detail: xem file chuyên biệt
     (error-handling.md, caching-strategy.md, operations/monitoring-spec.md).
-->


---

## 1. Services Quick Reference

| Service | Port | Tables Owned | Health Check |
|---------|------|-------------|-------------|
| api-gateway | 8080 | — | /actuator/health |
| auth-service | {{port}} | users, refresh_tokens | /actuator/health |
| {{name}}-service | {{port}} | {{tables}} | /actuator/health |

→ Communication patterns, Data architecture, Security: xem `docs/ARCHITECT/ADD.md` §3-6.

## 2. Package Structure (per service)

> Agent PHẢI tuân theo cấu trúc này khi tạo file mới.

```
com.{{company}}.{{project}}.{{service}}
├── api/                          # ── Presentation Layer
│   ├── {{feature}}/
│   │   ├── {{Feature}}Controller.java     # REST endpoints
│   │   ├── dto/
│   │   │   ├── {{Feature}}Request.java    # @Valid request DTO
│   │   │   └── {{Feature}}Response.java   # Response DTO
│   │   └── mapper/
│   │       └── {{Feature}}Mapper.java     # MapStruct mapper
│   └── GlobalExceptionHandler.java        # @RestControllerAdvice (1 per service)
│
├── domain/                       # ── Business Layer
│   ├── model/
│   │   ├── {{Entity}}.java               # JPA entity
│   │   └── {{Enum}}.java                 # Business state enums
│   ├── repository/
│   │   └── {{Entity}}Repository.java     # Spring Data JPA
│   └── service/
│       └── {{Feature}}Service.java       # Business logic
│
├── integration/                  # ── Integration Layer (cross-service)
│   └── {{target}}/
│       ├── {{Target}}ServiceClient.java  # RestClient + @CircuitBreaker
│       └── dto/
│           └── {{Target}}Dto.java        # Local DTO (NEVER import from target)
│
├── common/                       # ── Shared within service
│   ├── exception/
│   │   ├── ApplicationException.java     # Base exception
│   │   ├── ResourceNotFoundException.java
│   │   └── BusinessException.java
│   └── util/                             # Service-specific utilities
│
├── config/                       # ── Spring Configuration
│   ├── SecurityConfig.java
│   ├── RestClientConfig.java
│   ├── CacheConfig.java
│   └── {{Feature}}Config.java
│
└── {{ServiceName}}Application.java       # Main class
```

### Package Rules (ArchUnit enforced)

| Rule | Enforcement |
|------|-------------|
| `api/` KHÔNG import trực tiếp `domain/model/` | Phải qua mapper: Entity → Response DTO |
| `domain/` KHÔNG import `api/` hoặc `integration/` | Domain layer independent |
| `integration/` KHÔNG import entity từ target service | Dùng local DTO |
| Cross-service: KHÔNG import classes từ service khác | Dùng REST + local DTO |

## 3. Shared Modules

| Module | Chứa gì | Ai dùng |
|--------|---------|---------|
| `common-lib` | Base exceptions, Response wrapper, Audit annotation, Security utils | All services |
| `common-test` | Test utilities, WireMock helpers, TestContainers config | All services (test scope) |

> **Quy tắc**: Shared module chỉ chứa infrastructure concerns. KHÔNG chứa business logic.
> Khi thêm class vào `common-lib`, phải review: "Class này có thật sự dùng ở 2+ services không?"

## 4. Environment Configuration

### Profile Strategy

```
application.yml          # Defaults — PHẢI an toàn (không chứa secrets)
application-dev.yml      # Local development overrides
application-staging.yml  # Staging environment
application-prod.yml     # Production environment (minimal — secrets từ Vault/env vars)
```

### Mandatory Config Items (per service)

```yaml
# application.yml
server:
  port: {{port}}
  shutdown: graceful

spring:
  application:
    name: {{service-name}}
  datasource:
    url: jdbc:postgresql://localhost:5432/{{db_name}}
    hikari:
      maximum-pool-size: ${DB_POOL_SIZE:10}
      connection-timeout: 5000
  jpa:
    open-in-view: false  # PHẢI false — tránh lazy loading issues
    hibernate:
      ddl-auto: validate  # PHẢI validate — migrations via Flyway only

management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  endpoint:
    health:
      show-details: when_authorized

resilience4j:
  circuitbreaker:
    instances:
      {{target}}:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
  retry:
    instances:
      {{target}}:
        maxAttempts: 3
        waitDuration: 500ms
```

## 5. API Versioning

| Aspect | Rule |
|--------|------|
| **Strategy** | URL path: `/api/v{N}/{{resource}}` |
| **Current** | `v1` |
| **When to bump** | See `api-routing.md` §API Versioning Policy |

## 6. Cross-Cutting Concerns

| Concern | Implementation | Config Location |
|---------|---------------|-----------------|
| **Logging** | Logback (structured JSON) | `logback-spring.xml` |
| **Metrics** | Micrometer → Prometheus | Auto-config + custom beans |
| **Tracing** | Micrometer Tracing → OTel → Tempo | `application.yml` |
| **Audit** | `@Audited` annotation → audit_logs table | `common-lib` |
| **Error Handling** | `GlobalExceptionHandler` | Per service (see `error-handling.md`) |
| **Validation** | Bean Validation (`@Valid`) | On ALL request DTOs |
| **Caching** | Caffeine L1 + Redis L2 | `CacheConfig.java` (see `caching-strategy.md`) |

→ Monitoring details: `operations/monitoring-spec.md`
→ Error handling: `error-handling.md`
→ Caching strategy: `caching-strategy.md`
