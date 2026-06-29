---
name: spring-boot-4
description: >-
  Spring Boot 4.x expert guide covering all 15 use cases: project setup,
  SB3→SB4 migration, built-in API versioning, declarative HTTP clients
  (@HttpExchange), Virtual Threads (Project Loom), GraalVM native image,
  cloud-native microservices on Kubernetes, Spring Security 7, data access
  (JPA/R2DBC/Flyway), OpenTelemetry observability, testing with
  Testcontainers, Docker/K8s packaging, performance tuning, messaging
  (Kafka/RabbitMQ), and Spring AI integration. Use when working with
  Spring Boot 4, Spring Boot upgrade, Spring Framework 7, Jakarta EE 11,
  Virtual Threads, declarative HTTP client, API versioning Spring,
  GraalVM native image Spring, Spring Boot migration, or Spring AI.
  Targets Spring Boot 4.1.x (latest stable, June 2026), Java (Maven +
  Gradle), microservices architecture on Kubernetes.
version: 1.0.0
allowed-tools: Read,Write,Edit,Glob,Grep,Bash,WebSearch
---

# Spring Boot 4 — Expert Guide

**Target:** Spring Boot 4.1.x · Spring Framework 7 · Jakarta EE 11 · Java 17–25 · Maven + Gradle

## Quick Start

Scan the project first, then route to the matching use case below:

```bash
# Detect current version
grep -E "spring-boot|spring-framework" pom.xml | head -5
# or
grep -E "springBoot|springframework" build.gradle.kts | head -5
```

---

## Use Case 1 — Project Setup

```xml
<!-- pom.xml — Spring Boot 4.1.x parent -->
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>4.1.0</version>
</parent>
<properties>
  <java.version>21</java.version> <!-- min 17, max 25 -->
</properties>
```

```kotlin
// build.gradle.kts
plugins {
  id("org.springframework.boot") version "4.1.0"
  id("io.spring.dependency-management") version "1.1.7"
  java
}
java { toolchain { languageVersion = JavaLanguageVersion.of(21) } }
```

Use Spring Initializr: `https://start.spring.io` — select Spring Boot 4.1.x.
Full scaffold patterns → `references/01-project-setup.md`

---

## Use Case 2 — Migration SB3 → SB4

**Key breaking changes checklist:**

| Area | SB3 | SB4 |
|------|-----|-----|
| Namespace | `javax.*` | `jakarta.*` (enforced) |
| Null safety | Spring annotations | JSpecify (`@Nullable`, `@NonNull`) |
| Config keys | `spring.redis.*` | `spring.data.redis.*` |
| HTTP client | RestTemplate (deprecated) | `@HttpExchange` interfaces |
| Auto-config | `spring.factories` | `AutoConfiguration.imports` |
| Security | `WebSecurityConfigurerAdapter` removed | `SecurityFilterChain` bean |

```bash
# Run migration assistant
./mvnw spring-boot:run -Dspring-boot.run.arguments="--spring.config.use-legacy-processing=false"
```

Full migration guide with step-by-step + common errors → `references/02-migration-sb3-sb4.md`

---

## Use Case 3 — API Versioning (SB4 built-in)

```java
@RestController
@RequestMapping("/api/users")
public class UserController {

  @GetMapping(version = "1")          // v1
  public UserV1Dto getUserV1(@PathVariable Long id) { ... }

  @GetMapping(version = "2")          // v2 — new fields added
  public UserV2Dto getUserV2(@PathVariable Long id) { ... }
}
```

```yaml
# application.yml — versioning strategy
spring:
  mvc:
    versioning:
      strategy: header          # or: path | query-param
      header-name: API-Version  # for header strategy
      param-name: version       # for query-param strategy
```

Patterns (deprecation, OpenAPI docs, backward compat) → `references/03-api-versioning.md`

---

## Use Case 4 — Declarative HTTP Clients

```java
@HttpExchange("https://api.example.com")
public interface ProductClient {
  @GetExchange("/products/{id}")
  ProductDto getProduct(@PathVariable Long id);

  @PostExchange("/products")
  ProductDto createProduct(@RequestBody CreateProductRequest req);
}

@Configuration
public class HttpClientConfig {
  @Bean
  ProductClient productClient(RestClient.Builder builder) {
    RestClient restClient = builder.baseUrl("https://api.example.com").build();
    return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(restClient))
        .build().createClient(ProductClient.class);
  }
}
```

Retry, timeout, circuit breaker, testing with WireMock → `references/04-http-clients.md`

---

## Use Case 5 — Virtual Threads (Project Loom)

```yaml
# application.yml — one line to enable
spring:
  threads:
    virtual:
      enabled: true
```

**When to use Virtual Threads vs WebFlux:**

| Scenario | Use |
|----------|-----|
| Blocking I/O (JDBC, REST calls) | Virtual Threads |
| Stream processing, backpressure | WebFlux |
| Simple CRUD microservice | Virtual Threads |
| Reactor/RxJava existing codebase | WebFlux |

Pool sizing, pinning pitfalls, debugging → `references/05-virtual-threads.md`

---

## Use Case 6 — GraalVM Native Image

```bash
# Build native executable (Maven)
./mvnw -Pnative native:compile

# Build native Docker image
./mvnw -Pnative spring-boot:build-image
```

```java
@ImportRuntimeHints
public class AppHints implements RuntimeHintsRegistrar {
  @Override
  public void registerHints(RuntimeHints hints, ClassLoader cl) {
    hints.reflection().registerType(MyDto.class, MemberCategory.values());
  }
}
```

AOT processing, proxy hints, testing native, common failures → `references/06-graalvm-native.md`

---

## Use Case 7 — Cloud-Native Microservices (Kubernetes)

```yaml
# application.yml — K8s ready
management:
  endpoint.health.probes.enabled: true
  health:
    livenessstate.enabled: true
    readinessstate.enabled: true
server:
  shutdown: graceful
spring:
  lifecycle.timeout-per-shutdown-phase: 30s
```

```dockerfile
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /app
COPY . .
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Service discovery, circuit breaker, Helm chart → `references/07-cloud-native-k8s.md`

---

## Use Case 8 — Security (Spring Security 7)

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
        .build();
  }
}
```

OAuth2 / OIDC, method security, WebAuthn/Passkeys → `references/08-security.md`

---

## Use Case 9 — Data Access

```java
@Entity
public class Order {
  @Id @GeneratedValue Long id;
  @NotNull String status;
}

// Specification (type-safe query)
Specification<Order> byStatus = (root, q, cb) ->
    cb.equal(root.get("status"), "PENDING");
repository.findAll(byStatus, pageable);
```

```yaml
# HikariCP — optimized for Virtual Threads
spring:
  datasource.hikari:
    maximum-pool-size: 10
    connection-timeout: 3000
```

R2DBC reactive, Flyway migration, multi-datasource → `references/09-data-access.md`

---

## Use Case 10 — Observability (OpenTelemetry)

```xml
<!-- pom.xml — OTEL starter (new in SB4) -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-opentelemetry</artifactId>
</dependency>
```

```yaml
management:
  tracing.sampling.probability: 1.0
  otlp:
    tracing.endpoint: http://otel-collector:4318/v1/traces
    metrics.export.url: http://otel-collector:4318/v1/metrics
spring.application.name: my-service
```

Micrometer custom metrics, Grafana dashboards, structured logs → `references/10-observability.md`

---

## Use Case 11 — Testing

```java
@SpringBootTest
@Testcontainers
class OrderServiceIT {

  @Container
  static PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>("postgres:16");

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", postgres::getJdbcUrl);
  }

  @Test void createOrder_persists() { ... }
}
```

MockMvc, WebTestClient, native image test, contract tests → `references/11-testing.md`

---

## Use Case 12 — Packaging & Deployment

```bash
# OCI image via Buildpacks (no Dockerfile needed)
./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=myapp:latest

# Layered JAR (faster Docker rebuilds)
./mvnw package
java -Djarmode=layertools -jar target/app.jar extract
```

Helm chart, multi-env config, CI/CD pipeline → `references/12-packaging-deployment.md`

---

## Use Case 13 — Performance Tuning

```yaml
spring:
  main.lazy-initialization: true
  jpa.open-in-view: false
  cache.type: caffeine
  cache.caffeine.spec: maximumSize=1000,expireAfterWrite=10m
```

```bash
# JVM flags for Java 21
-XX:+UseZGC -XX:+ZGenerational -Xms256m -Xmx512m
```

Profiling with JFR, cache strategies, DB query optimization → `references/13-performance.md`

---

## Use Case 14 — Messaging & Events

```java
// Kafka producer
@Service
public class OrderEventPublisher {
  private final KafkaTemplate<String, OrderEvent> kafka;

  public void publish(OrderEvent event) {
    kafka.send("order-events", event.id().toString(), event);
  }
}

// Consumer
@KafkaListener(topics = "order-events", groupId = "inventory-service")
public void consume(OrderEvent event, Acknowledgment ack) {
  inventoryService.reserve(event);
  ack.acknowledge();
}
```

RabbitMQ, transactional outbox, dead-letter queues → `references/14-messaging.md`

---

## Use Case 15 — Spring AI Integration

```xml
<dependency>
  <groupId>org.springframework.ai</groupId>
  <artifactId>spring-ai-openai-spring-boot-starter</artifactId>
  <version>1.0.0</version>
</dependency>
```

```java
@RestController
public class AiController {
  private final ChatClient chatClient;

  @PostMapping("/chat")
  public String chat(@RequestBody String question) {
    return chatClient.prompt(question).call().content();
  }
}
```

```yaml
spring.ai.openai:
  api-key: ${OPENAI_API_KEY}
  chat.model: gpt-4o
```

RAG pipeline, VectorStore, structured output, Ollama local → `references/15-spring-ai.md`

---

## Reference Index

| File | Content |
|------|---------|
| `references/01-project-setup.md` | Initializr, scaffold, module structure |
| `references/02-migration-sb3-sb4.md` | Full migration checklist + common errors |
| `references/03-api-versioning.md` | Versioning strategies, OpenAPI, deprecation |
| `references/04-http-clients.md` | @HttpExchange, retry, timeout, WireMock |
| `references/05-virtual-threads.md` | Loom config, pitfalls, vs WebFlux |
| `references/06-graalvm-native.md` | AOT, hints, native testing |
| `references/07-cloud-native-k8s.md` | K8s probes, Helm, service mesh |
| `references/08-security.md` | Spring Security 7, OAuth2, Passkeys |
| `references/09-data-access.md` | JPA, R2DBC, Flyway, multi-datasource |
| `references/10-observability.md` | OTEL, Micrometer, Grafana |
| `references/11-testing.md` | Testcontainers, MockMvc, contracts |
| `references/12-packaging-deployment.md` | Buildpacks, layered JAR, Helm |
| `references/13-performance.md` | JVM tuning, cache, profiling |
| `references/14-messaging.md` | Kafka, RabbitMQ, outbox pattern |
| `references/15-spring-ai.md` | Spring AI, RAG, VectorStore |
