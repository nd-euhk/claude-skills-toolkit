# Spring Boot 4 — Migration from SB3 to SB4

## Pre-Migration Checklist

- [ ] Java version ≥ 17 (21 recommended)
- [ ] All `javax.*` imports replaced with `jakarta.*`
- [ ] Spring Security: `WebSecurityConfigurerAdapter` removed → use `SecurityFilterChain`
- [ ] Auto-configuration: `spring.factories` → `AutoConfiguration.imports`
- [ ] `RestTemplate` usages identified for migration to `@HttpExchange`
- [ ] Property keys updated (see table below)
- [ ] JSpecify null-safety annotations adopted where needed

## Step 1 — Update Parent Version

```xml
<!-- pom.xml -->
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version>4.1.0</version>  <!-- was 3.x.x -->
</parent>
```

## Step 2 — Add Migration Assistant (Temporary)

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-properties-migrator</artifactId>
  <scope>runtime</scope>
</dependency>
```

Run the app once, check logs for deprecation warnings. Remove after migration.

## Step 3 — Property Key Changes

| Old (SB3) | New (SB4) |
|-----------|-----------|
| `spring.redis.*` | `spring.data.redis.*` |
| `spring.elasticsearch.*` | `spring.data.elasticsearch.*` |
| `spring.mongodb.*` | `spring.data.mongodb.*` |
| `spring.security.oauth2.client.*` | Unchanged |
| `management.metrics.export.prometheus.*` | `management.prometheus.metrics.export.*` |
| `spring.mvc.pathmatch.use-suffix-pattern` | Removed (suffix matching dropped) |

## Step 4 — Null Safety: JSpecify Migration

```java
// SB3 (Spring annotations)
import org.springframework.lang.Nullable;
import org.springframework.lang.NonNull;

// SB4 (JSpecify — portfolio-wide standard)
import org.jspecify.annotations.Nullable;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.NullMarked;

// Add to package-info.java
@NullMarked
package com.example.myservice.domain;
import org.jspecify.annotations.NullMarked;
```

## Step 5 — Auto-Configuration Migration

```
# SB3: src/main/resources/META-INF/spring.factories
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.example.MyAutoConfiguration

# SB4: src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.example.MyAutoConfiguration
```

## Step 6 — RestTemplate → @HttpExchange

```java
// BEFORE (SB3 — RestTemplate)
@Service
public class PaymentService {
  private final RestTemplate restTemplate;

  public PaymentResponse charge(ChargeRequest req) {
    return restTemplate.postForObject(
        "https://payment-api/charges", req, PaymentResponse.class);
  }
}

// AFTER (SB4 — declarative)
@HttpExchange("https://payment-api")
public interface PaymentClient {
  @PostExchange("/charges")
  PaymentResponse charge(@RequestBody ChargeRequest req);
}
```

## Common Migration Errors

### Error: `javax.persistence` not found
```
Cannot resolve symbol 'javax'
```
**Fix:** Replace all `javax.persistence.*` with `jakarta.persistence.*`.  
Quick fix in IntelliJ: Edit → Find → Replace in Files → `javax.persistence` → `jakarta.persistence`

### Error: `WebSecurityConfigurerAdapter` not found
```
Cannot find class WebSecurityConfigurerAdapter
```
**Fix:**
```java
// Remove extends WebSecurityConfigurerAdapter, use bean approach
@Configuration
@EnableWebSecurity
public class SecurityConfig {
  @Bean
  SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(auth -> auth.anyRequest().authenticated());
    return http.build();
  }
}
```

### Error: Circular bean dependency
SB4 defaults `spring.main.allow-circular-references=false`. Fix: refactor the circular dependency or add:
```yaml
spring.main.allow-circular-references: true  # temporary — plan to fix properly
```

### Error: `spring.factories` auto-config ignored
**Fix:** Create `AutoConfiguration.imports` file (Step 5 above).

## Automated Migration Tools

```bash
# OpenRewrite Spring Boot 4 migration recipe
./mvnw -U org.openrewrite.maven:rewrite-maven-plugin:run \
  -Drewrite.recipeArtifactCoordinates=org.openrewrite.recipe:rewrite-spring:LATEST \
  -Drewrite.activeRecipes=org.openrewrite.java.spring.boot4.UpgradeSpringBoot_4_1
```

## Testing After Migration

1. Run unit tests: `./mvnw test`
2. Run integration tests: `./mvnw verify`
3. Check actuator health: `curl http://localhost:8080/actuator/health`
4. Review startup logs for deprecation warnings
5. Load test to verify Virtual Threads performance
