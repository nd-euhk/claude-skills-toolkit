# Per-service migration runbook (team-specific)

Read this when actively migrating a specific service from Spring Boot 3.x
to 4.x — as opposed to writing new 4.x-native code from scratch (for that,
the Tier tables in the main SKILL.md and the other reference files apply
directly).

The point of this file is to act as a persistent "where did we left off"
log across sessions, so re-running this skill doesn't repeat work that's
already done, and doesn't lose track of what's still outstanding. **Update
this file directly as work happens** — don't just report progress in chat
and leave the file stale.

## Quick migration checklist (per service)

```
Tier 1 (won't build) — fix first:
□ spring-boot-starter-web → spring-boot-starter-webmvc
□ WebSecurityConfigurerAdapter → SecurityFilterChain bean
□ HttpSecurity method-chaining → lambda DSL
□ @MockBean/@SpyBean → @MockitoBean/@MockitoSpyBean
□ Gradle < 8.14 → bump to 8.14+ or 9.x
□ OkHttp3 → HTTP Service Client / RestClient

Tier 2 (won't run) — fix next:
□ javax.* imports → jakarta.*
□ Auto-configured RestTemplate → explicit bean or @HttpExchange
□ OAuth2 password grant → authorization code / client credentials
□ spring.factories → AutoConfiguration.imports
□ Public @ConfigurationProperties fields → records or getters/setters

Tier 3 (silent wrong results) — verify last:
□ CSRF: test POST/PUT/DELETE against real endpoints → expect 403 until fixed
□ Jackson: compare JSON output before/after — dates, nulls, enums
□ PropertyMapper: null source values no longer mapped by default
□ Logback: charset default changed to UTF-8
```

## Template — duplicate this section per service

### Service: `<service-name>`

- **Status:** not started / on 3.5.x bridge / Tier 1 fixed / Tier 2 fixed /
  Tier 3 reviewed / done
- **Current Boot version:** e.g. `3.5.4` → target `4.1.x`
- **Build tool:** Maven / Gradle (+ version)
- **Tier 1 outstanding:**
  - [ ] ...
- **Tier 2 outstanding:**
  - [ ] ...
- **Tier 3 verified:**
  - [ ] CSRF behavior re-tested against real endpoints
  - [ ] JSON output spot-checked for date/time and decimal fields
  - [ ] PropertyMapper null-handling verified
- **Known blockers:** e.g. internal library not yet compatible, Spring Cloud
  dependency not validated for 4.x
- **Notes / decisions:** anything decided ad hoc that should stick

### Worked example (illustrative — replace with real data)

This is what a filled-in entry looks like. Use it as the template shape:

**Service: `order-service`**

- **Status:** Tier 2 fixed, Tier 3 in progress
- **Current Boot version:** `3.5.6` → target `4.1.0`
- **Build tool:** Maven
- **Tier 1 (won't build) — outstanding items:**
  - [x] `spring-boot-starter-web` → `spring-boot-starter-webmvc` (done 2026-06-15)
  - [x] `LegacySecurityConfig` rewritten as `SecurityFilterChain` bean using lambda DSL (done 2026-06-16)
  - [x] Swapped `@MockBean`/`@SpyBean` for `@MockitoBean`/`@MockitoSpyBean` across 14 test classes (done 2026-06-17)
- **Tier 2 (won't run) — outstanding items:**
  - [x] `PaymentClient` rewritten as `@HttpExchange` interface per `references/http-client-conventions.md` (done 2026-06-18)
  - [ ] Custom `spring.factories` auto-config registration in internal `order-events` library not yet migrated to `AutoConfiguration.imports` — **blocked on platform team**
- **Tier 3 (silent/wrong results) — verified or outstanding:**
  - [x] CSRF behavior re-tested against real `/api/orders` POST endpoint — confirmed 403 issue does NOT occur since `csrf.disable()` + `STATELESS` was applied (verified 2026-06-19)
  - [ ] JSON output for `Order.createdAt` not yet spot-checked against Jackson 3 defaults
  - [ ] `PropertyMapper` null-handling change not yet audited in `OrderMapperConfig`
- **Known blockers:**
  - `order-events` shared library (owned by platform team) not yet Boot-4-compatible
- **Notes / decisions made:**
  - Decided to keep `spring-boot-starter-classic` bridge temporarily for `legacy-audit-client` — tracked as tech debt, revisit next quarter.

## How to use this during a migration session

1. Find or create the entry for the service being worked on
2. Work Tier 1 → Tier 2 → Tier 3, checking off items as resolved
3. Update "Status" so the next session knows where things stand
4. Don't re-verify Tier 1/2 items already checked off unless something changed
5. **Always verify Tier 3 items with actual runtime testing before checking off** — these are the ones that compile and run fine while quietly doing the wrong thing
6. If a blocker is hit (external dependency, pending decision), record it under "Known blockers" — an unchecked item alone doesn't explain why six months later
