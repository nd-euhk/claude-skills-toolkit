# Spring Boot 4 — Project Setup

## Spring Initializr (Recommended)

```
https://start.spring.io
  Group:    com.example
  Artifact: my-service
  Type:     Maven (or Gradle - Kotlin DSL)
  Language: Java
  Version:  4.1.0
  Java:     21
```

Essential starters for microservices:
- `spring-boot-starter-web` — REST API (Tomcat + MVC)
- `spring-boot-starter-actuator` — health, metrics
- `spring-boot-starter-data-jpa` — JPA + Hibernate 7
- `spring-boot-starter-security` — Spring Security 7
- `spring-boot-starter-opentelemetry` — distributed tracing
- `spring-boot-starter-validation` — Bean Validation (Jakarta)

## Maven pom.xml — Full Skeleton

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.1.0</version>
    <relativePath/>
  </parent>
  <groupId>com.example</groupId>
  <artifactId>my-service</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>my-service</name>
  <properties>
    <java.version>21</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

## Gradle Kotlin DSL — Full Skeleton

```kotlin
// build.gradle.kts
plugins {
  id("org.springframework.boot") version "4.1.0"
  id("io.spring.dependency-management") version "1.1.7"
  java
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
  toolchain {
    languageVersion = JavaLanguageVersion.of(21)
  }
}

repositories {
  mavenCentral()
}

dependencies {
  implementation("org.springframework.boot:spring-boot-starter-web")
  implementation("org.springframework.boot:spring-boot-starter-actuator")
  testImplementation("org.springframework.boot:spring-boot-starter-test")
}
```

## Recommended Package Structure (Microservice)

```
src/main/java/com/example/myservice/
├── MyServiceApplication.java          # @SpringBootApplication
├── api/                               # Controllers (inbound adapters)
│   ├── OrderController.java
│   └── dto/
│       ├── CreateOrderRequest.java
│       └── OrderResponse.java
├── domain/                            # Business logic (pure, no Spring)
│   ├── Order.java
│   ├── OrderStatus.java
│   └── OrderService.java
├── infrastructure/                    # Outbound adapters
│   ├── persistence/
│   │   ├── OrderEntity.java
│   │   ├── OrderRepository.java
│   │   └── OrderPersistenceAdapter.java
│   ├── messaging/
│   │   └── OrderEventPublisher.java
│   └── client/
│       └── PaymentClient.java         # @HttpExchange
├── config/                            # Spring configuration classes
│   ├── SecurityConfig.java
│   ├── CacheConfig.java
│   └── HttpClientConfig.java
└── common/                            # Cross-cutting concerns
    ├── exception/
    │   └── GlobalExceptionHandler.java
    └── observability/
        └── MetricsConfig.java
```

## application.yml — Base Configuration

```yaml
spring:
  application.name: my-service
  threads.virtual.enabled: true      # Enable Virtual Threads
  jpa.open-in-view: false

server:
  port: 8080
  shutdown: graceful

management:
  endpoint.health.probes.enabled: true
  endpoints.web.exposure.include: health,info,metrics,prometheus
  tracing.sampling.probability: 1.0

logging:
  level.root: INFO
  level.com.example: DEBUG
```

## Multi-Environment Config

```
src/main/resources/
├── application.yml           # Base config (shared)
├── application-dev.yml       # Development overrides
├── application-staging.yml   # Staging overrides
└── application-prod.yml      # Production overrides (minimal — use K8s ConfigMap)
```

Activate profile: `SPRING_PROFILES_ACTIVE=prod` env var.
