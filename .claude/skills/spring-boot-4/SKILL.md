---
name: spring-boot-4
version: 1.1.0
description: Use when writing, editing, reviewing, or migrating Java/Kotlin code in a Spring Boot 4.x (4.0/4.1) project. Spring Boot 4 removed ~88% of APIs deprecated in 3.x and changed several defaults silently — code correct by 3.x conventions may not compile, fail at runtime, or silently produce wrong results (REST APIs returning 403, JSON output changing shape). Trigger before: writing Spring Boot code, suggesting starter dependencies, configuring Security/CSRF, touching Jackson/JSON, writing @ConfigurationProperties or @Repository, writing tests that mock beans, writing @HttpExchange clients, touching Spring gRPC, or migrating from 3.x to 4.x — even if the request doesn't mention "Spring Boot 4" since most training data defaults to 3.x.
allowed-tools: Read, Write, Bash
---

# Spring Boot 4.x Awareness

Spring Boot 4 (built on Spring Framework 7, Jakarta EE 11) removed ~88% of all
APIs that were deprecated across the 2.x/3.x lines. There is no grace period —
deprecated-in-3.x means gone-in-4.0. The danger isn't the stuff that fails to
compile (that's self-correcting). The danger is the stuff that **compiles,
runs, and silently does the wrong thing**.

Before writing or reviewing Spring Boot code, route through the table below.
If unsure which tier a change falls into, treat it as Tier 3 (silent) and
double check rather than assume.

## Route to the right reference

| Task | Must read | Can skip |
|---|---|---|
| **Security config** (SecurityFilterChain, JWT, OAuth2) | Tier 3 CSRF section + `references/security-conventions.md` | gRPC, observability refs |
| **JSON / DTOs / serialization** | Tier 3 Jackson section + `references/jackson-conventions.md` | Security, gRPC refs |
| **Writing tests** (any test file) | Tier 1 mock annotations + `references/testing-conventions.md` | Migration runbook |
| **HTTP calls between services** | Tier 2 RestTemplate + `references/http-client-conventions.md` | Jackson, gRPC refs |
| **Repository / JPA entities** | `references/spring-data-conventions.md` | Security, HTTP refs |
| **Build / dependencies / starters** | Tier 1 starters + Starter naming table below | All domain refs |
| **Spring gRPC** (Boot 4.1+) | `references/grpc-notes.md` | Migration runbook |
| **Observability** (tracing, metrics) | `references/observability-conventions.md` | Security refs |
| **Full 3.x → 4.x migration** | ALL Tier tables + `references/migration-runbook.md` | Nothing — read everything |
| **Reviewing PR/diff** for 4.x compat | All three Tier tables — flag Tier 1 as blocking, Tier 3 as must-verify-manually | Domain refs (unless a Tier match is found) |
| **Simple CRUD controller, plain `application.yml` tweak, basic test** | Tier tables in this file usually enough | All reference files |

**Rule of thumb:** Security or serialization → Tier 3 is mandatory, not optional. Those are the two areas where Boot 4 silently produces wrong behavior with no compile or runtime error.

## How to use this skill

### Step 1: Identify the Boot version

Confirm (or infer from `pom.xml`/`build.gradle`) which Boot version:
- **4.0.x** — baseline; everything below applies
- **4.1.x** — adds Spring gRPC support; see `references/grpc-notes.md`

### Step 2: Route using the table above

Match your task to the "Must read" column — that's your minimum reading before writing code.

### Step 3: Default to 4.x-native patterns

Never silently "helpfully" reintroduce a 3.x pattern (e.g.
`WebSecurityConfigurerAdapter`, public-field `@ConfigurationProperties`,
`spring-boot-starter-web`) just because it's more common in training data.
Generate 4.x-native code, not 3.x-with-bridges.

### Step 4: Verify runtime for Tier 3 changes

For Tier 3 items especially, **build success ≠ correctness**. After any security
or serialization change, verify with actual HTTP calls (curl/Postman/integration
test), not just `mvn compile`.

---

## Tier 1 — Won't build (loudest, lowest risk, fix first)

These break compilation immediately, so they're the easiest tier to deal with
— but still worth knowing so you don't suggest the broken pattern in the
first place.

| Old (3.x) pattern | What happens in 4.x | Fix |
|---|---|---|
| `spring-boot-starter-web` | No longer maps to a webmvc app the same way | Use `spring-boot-starter-webmvc` |
| `spring-boot-starter-undertow` | Removed entirely (Undertow doesn't support Servlet 6.1) | Switch to Tomcat (default) or Jetty |
| `extends WebSecurityConfigurerAdapter` | Class removed from Spring Security 7 | Use the `SecurityFilterChain` bean + lambda DSL (see Tier 3 security section) |
| `HttpSecurity` method-chaining (`.authorizeRequests().antMatchers(...)`) | Method-chaining DSL removed; lambda DSL is now the *only* supported form | Rewrite as `http -> http.authorizeHttpRequests(...)` lambda style |
| Reaching into internal `org.springframework.boot.*` packages directly | Boot's codebase is now modularized; internal package paths changed | Find the new module-specific package, or depend on the public API only |
| `@MockBean` / `@SpyBean` (Spring Boot's own annotations) | Removed from the test framework | Use Mockito's own `@Mock`/`@Captor` with `MockitoExtension`, or `@MockitoBean`/`@MockitoSpyBean` (3.4+ replacements) |
| Gradle < 8.14 | No longer supported | Bump to Gradle 8.14+ (9.x recommended) |
| OkHttp3-based HTTP client support | Removed | Migrate to the new HTTP Service Client / RestClient approach |

**Key Tier 1 code examples:**

*@MockBean → @MockitoBean:*
```java
// OLD (3.x) — removed in 4.x
@MockBean private UserService userService;
@SpyBean private EmailService emailService;

// NEW (4.x) — use Boot 3.4+ replacements
@MockitoBean private UserService userService;
@MockitoSpyBean private EmailService emailService;
```

## Tier 2 — Builds, but fails at startup or runtime

These pass compilation, so a green build gives false confidence. Test the
actual running behavior, not just `mvn compile` / `./gradlew build`.

| Old (3.x) pattern | What happens in 4.x | Fix |
|---|---|---|
| `javax.annotation.*`, `javax.inject.*` imports | No longer recognized at runtime | Use `jakarta.annotation.*` / `jakarta.inject.*` |
| Relying on auto-configured `RestTemplate` bean | `RestTemplate` auto-configuration was removed (opt-in only now) | Declare your own `RestTemplate` bean explicitly, or prefer the new declarative HTTP Service Client (`@HttpExchange` interfaces) |
| OAuth2 "password" grant type config | Grant type removed entirely from Spring Security | Migrate to an OAuth2 flow that's still supported (authorization code, client credentials) |
| `spring.factories`-based auto-configuration registration (custom starters/libraries) | May not be picked up the same way | Migrate to `AutoConfiguration.imports` |
| Public fields on `@ConfigurationProperties` classes | Binding to public fields no longer supported | Use private fields with getters/setters (or records for immutable config) |

**Key Tier 2 code examples:**

*RestTemplate → @HttpExchange (new code):*
```java
// OLD (3.x) — RestTemplate auto-config removed in 4.x
@Bean
RestTemplate restTemplate() { return new RestTemplate(); }

// NEW (4.x) — declare a service client interface
@HttpExchange("/api/payments")
interface PaymentClient {
    @GetExchange("/{id}")
    PaymentDto getPayment(@PathVariable String id);
}

// Register it via RestClient or RestClient.Builder
@Bean
PaymentClient paymentClient(RestClient.Builder builder) {
    var client = RestClient.builder().build();
    return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(client)).build()
        .createClient(PaymentClient.class);
}
```

*AutoConfiguration.imports (replaces spring.factories):*
```
# OLD: META-INF/spring.factories
# org.springframework.boot.autoconfigure.EnableAutoConfiguration=com.example.MyAutoConfig

# NEW: META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.example.MyAutoConfig
```

*@ConfigurationProperties as records:*
```java
// Java record — preferred for immutable config in 4.x
@ConfigurationProperties(prefix = "app.payment")
public record PaymentProperties(String endpoint, Duration timeout, int maxRetries) {}
```

## Tier 3 — Builds, runs, produces wrong results (the dangerous tier)

Nothing will flag these. This is where careful review matters most — if
you're generating or reviewing security or serialization code, treat this
section as mandatory reading every time.

### Spring Security 7 — CSRF default change (relevant to this project: REST API)

This is the single most consequential default change for a REST API. In
Spring Boot 3.x, CSRF protection was effectively permissive for stateless
REST APIs unless you'd wired your own `SecurityFilterChain`. In Boot 4 /
Spring Security 7, **CSRF protection is enforced more aggressively by
default**, and it is no longer scoped to form-based apps only.

**Symptom if missed:** all POST/PUT/DELETE/PATCH requests silently return
`403 Forbidden`, with no compile error and no obvious log message pointing at
the cause. GET requests work fine, which makes this especially easy to miss
in a quick smoke test.

**What to do:**
- For a stateless, token-authenticated REST API (e.g. JWT bearer auth), CSRF
  protection is generally not needed — but it must now be **explicitly**
  disabled via a `SecurityFilterChain` bean, not left to an implicit
  permissive default:

```java
@Bean
SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable()) // explicit, intentional — REST API uses token auth, not cookies
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated()
        )
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
    return http.build();
}
```
- If the API *does* use cookie-based session auth anywhere, do **not** blanket-disable
  CSRF — that reopens a real vulnerability. Scope CSRF protection correctly
  instead of disabling it wholesale; flag this to the user rather than
  silently picking one.
- Always test actual HTTP calls (curl/Postman/integration test) against
  state-changing endpoints after any Security config change in this project
  — don't rely on build success as a signal.

### Jackson 3 — package and default behavior changes

- Group/package migrated: `com.fasterxml.jackson` → `tools.jackson` for the
  core (some compatibility classes remain under the old package as a bridge
  — don't assume one or the other without checking the project's actual
  Jackson version).
- Several serialization defaults changed (notably around date/time
  formatting). Code that "looks the same" can produce different JSON output
  than it did on Boot 3.x. If a request involves custom serializers,
  `ObjectMapper` customization, or date/time fields, flag this explicitly and
  verify actual output rather than assuming parity with 3.x behavior.
- Custom `Module` registrations and annotations tied to old Jackson 2.x
  classes may need updating — don't assume an old custom serializer still
  behaves identically.

### Other silent-default changes worth knowing

- `PropertyMapper` no longer maps `null` source values by default. If
  existing code relied on that behavior, it now needs an explicit `.always()`
  call.
- Logback default charset behavior changed (now UTF-8 aligned) — relevant if
  the project has custom `logback.xml` config with charset assumptions baked in.

---

## Starter naming — quick reference

When suggesting or writing build file dependencies, use 4.x starter names,
not 3.x ones, unless the user is intentionally using the temporary "classic"
bridge starters during a staged migration:

| 3.x starter | 4.x starter |
|---|---|
| `spring-boot-starter-web` | `spring-boot-starter-webmvc` |
| (monolithic auto-config, implicit) | Smaller, focused per-feature starters — don't assume one starter pulls in unrelated auto-configuration the way it used to |

If the user mentions `spring-boot-starter-classic` or similar bridge
starters: these exist only to ease a staged migration and are themselves
deprecated. Don't suggest them for new code — only acknowledge them if the
user is mid-migration and explicitly wants the bridge.

---

## Baseline requirements to keep in mind

- Java 17 minimum; Java 21–25 is where most 4.0.x tooling guidance centers,
  with first-class Java 25 support. Don't assume Java 17 is the recommended
  target — it's the floor, not the recommendation.
- Servlet 6.1 / Jakarta EE 11 baseline — anything assuming Servlet 5 era
  behavior (or javax.* namespaces) is wrong by construction.
- Gradle 8.14+ or Gradle 9.x; Maven works through the normal Boot BOM but
  plugin versions need to line up with the new Java/native baselines.
- Don't mix Spring Boot 3.x and 4.x assumptions within the same artifact —
  if the user's codebase still has 3.x-flavored modules being merged in,
  flag it rather than blending conventions.

## When migrating existing code (not writing new code)

1. Confirm the project is already on the latest 3.5.x and has zero
   deprecation warnings before assuming a clean jump to 4.0/4.1 — Spring
   explicitly designed 3.5 as the deprecation-warning bridge release.
2. Work Tier 1 → Tier 2 → Tier 3, in that order.
3. For Tier 3 changes especially, don't just make the code compile and call
   it done — call out explicitly to the user which behaviors need manual
   verification (Security filter behavior, JSON output shape, config
   property null-handling) since these are exactly the changes that won't
   announce themselves.
4. If the user's build still pulls in Spring Cloud or other non-Boot-managed
   dependencies, note that compatibility needs separate verification — Boot's
   own dependency management doesn't cover those.

---

## Common Pitfalls & Error Recovery

### "My POST returns 403 but GET works"

**Cause:** CSRF protection now enforced aggressively by default (Tier 3). The
`SecurityFilterChain` is missing explicit `csrf.disable()` for stateless token
auth, or the CSRF config is targeting only form-based paths.

**Fix:** Verify the SecurityFilterChain bean has `.csrf(csrf -> csrf.disable())`
with a comment explaining why. Then test the actual endpoint — don't trust that
`mvn test` passing means it's fixed.

### "My JSON output looks different after migrating"

**Cause:** Jackson 3 silently changed serialization defaults for date/time and
null handling (Tier 3). Same DTO, different JSON shape.

**Debug:** Compare actual JSON output (curl/Postman) against 3.x output. Check:
- Date/time fields formatted differently?
- Null values appearing/disappearing?
- Enum fields serialized differently?
- `@JsonProperty` annotations still resolving to the right Jackson package?

### "My @ConfigurationProperties stopped working"

**Cause:** Public field binding removed in 4.x (Tier 2). If the class uses
`public String endpoint;` instead of private fields + getters/setters or a
Java record, binding silently fails.

**Fix:** Convert to a Java record or add getters/setters with private fields.

### "Tests fail with NoSuchBeanDefinitionException for mocked beans"

**Cause:** `@MockBean` / `@SpyBean` were removed in 4.x (Tier 1). Any test
using them won't even compile — but if the code compiles because it was
already migrated to `@MockitoBean`, the test might still fail because the
Mockito version doesn't match.

**Fix:** Use `@MockitoBean` / `@MockitoSpyBean` with Boot 3.4+ compatible
test dependencies, or fall back to `@Mock` with `MockitoExtension`.

### "My inter-service HTTP calls work locally but fail in deployed env"

**Cause:** The auto-configured `RestTemplate` bean was removed (Tier 2). If
the code relies on it being auto-created, it won't exist at runtime unless
explicitly declared — or worse, a different `RestTemplate` bean from another
module might be injected, causing subtle behavioral differences.

**Fix:** Explicitly declare a `RestTemplate` bean or migrate to
`@HttpExchange` + `RestClient` (see Tier 2 code examples).

---

## About the reference files

The files under `references/` capture team-specific conventions on top of the
general Boot 4.x facts in this file. Each reference file provides:

1. **When to read it** — the specific trigger that makes it relevant
2. **Safe defaults** — what to use until the team standardizes
3. **Capture checklist** — what needs a decision, so you know what to ask

When a reference file is still in placeholder / scaffold state:
- **Use the documented safe default** and say so out loud ("Using the safe
  default for now — the team hasn't standardized this yet").
- **Capture conventions in real time:** If the user states a real convention
  in conversation (e.g. "we always use snake_case for JSON" or "our base
  entity class is `AuditableEntity`"), write it into the matching reference
  file immediately so it persists for next time.
- **Don't invent conventions** that weren't actually stated, even if a
  plausible-sounding one would make the answer feel more complete.
- **Flag gaps** rather than silently papering over them — a missing convention
  is better than a wrong one.
