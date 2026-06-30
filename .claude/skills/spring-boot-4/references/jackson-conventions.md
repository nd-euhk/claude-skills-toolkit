# Jackson 3 / serialization convention (team-specific)

Read this when writing or editing DTOs, `ObjectMapper` customization, custom
serializers/deserializers, or anything that shapes JSON going in/out of an
API boundary. This is the highest-risk Tier 3 area in the main SKILL.md —
wrong output here doesn't throw an exception, it just silently changes the
JSON contract between services or between the API and its clients.

## Safe default — explicit ObjectMapper baseline

Don't rely on framework defaults for anything client-facing. Pin behavior
explicitly via a single `ObjectMapper` customizer bean, so every service
behaves identically regardless of what Jackson 3's own defaults happen to be:

```java
package com.example.app.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        return builder -> builder
            // Dates as ISO-8601 strings, not epoch millis. Pin this
            // explicitly — don't rely on whatever Jackson 3 defaults to,
            // since this is exactly the kind of thing that changed quietly
            // between Jackson 2.x (Boot 3.x) and Jackson 3.x (Boot 4.x).
            .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)

            // Don't blow up on JSON fields the DTO doesn't know about —
            // lets services evolve independently without lockstep deploys.
            .featuresToDisable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)

            // Omit nulls from output rather than emitting `"field": null`
            // for every optional field. Explicit choice, not a guess at
            // the framework default.
            .serializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL);
    }
}
```

DTO example showing the conventions this produces:

```java
package com.example.app.dto;

import java.math.BigDecimal;
import java.time.Instant;

// A record, not a class with public fields — Boot 4 doesn't bind
// @ConfigurationProperties to public fields, and for DTOs in general,
// records avoid the boilerplate getter/setter ceremony entirely.
public record OrderResponse(
    String orderId,
    BigDecimal totalAmount,   // NOT a `double` — see mistakes below
    Instant createdAt,        // serializes as ISO-8601 string given the config above
    String customerEmail
) {}
```

Resulting JSON for the above, given the `ObjectMapper` config:

```json
{
  "orderId": "ord_8f3a2b",
  "totalAmount": 49.99,
  "createdAt": "2026-06-29T03:44:00Z",
  "customerEmail": "user@example.com"
}
```

## Common mistakes to watch for (these compile and run, but are wrong)

- **Using `double`/`float` for money.** `BigDecimal` is correct above —
  binary floating point cannot represent most decimal currency values
  exactly, and this has nothing to do with the Boot 4 upgrade specifically,
  but it's exactly the kind of thing that silently produces wrong numbers
  in financial DTOs and is worth flagging if seen.
- **Assuming `LocalDateTime`/`Instant` serializes the same way it did on
  Boot 3.x without checking.** The date/time serialization defaults are one
  of the specific things that moved between Jackson 2.x and 3.x. If a
  request touches date/time fields, actually print the JSON output and
  look at it — don't assume parity with the old behavior.
- **Mixing `com.fasterxml.jackson` and `tools.jackson` imports in the same
  class.** If the project is mid-migration and using Jackson 3's
  compatibility bridge, pick one import family per class/module
  consistently — mixing them is a common source of confusing compile
  errors that look unrelated to the actual cause.
- **Forgetting that `FAIL_ON_UNKNOWN_PROPERTIES` defaults can differ from
  what a given service's tests assume.** If a slice test or integration
  test starts failing on a field that "shouldn't" matter, check this
  setting before assuming the test itself is broken.
- **Annotating fields with old Jackson 2.x-specific annotations that don't
  have a 1:1 mapping in Jackson 3.** If a custom serializer or annotation
  doesn't behave as expected after the Boot 4 upgrade, verify the
  annotation still exists in Jackson 3 rather than assuming it carried
  over unchanged.

## Capture checklist (things the team needs to decide)

- [ ] Naming strategy: camelCase (the example above, and Java's default) vs
      snake_case — if the team wants snake_case, add
      `.propertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)` to the
      customizer above and update this file with the decision.
- [ ] Whether `tools.jackson` (Jackson 3 native) or
      `com.fasterxml.jackson` (compatibility bridge) is the standard import
      family for this project, if mid-migration.
- [ ] Any custom `Module` registrations already in use elsewhere in the
      codebase (e.g. for `BigDecimal` precision control, enum serialization)
      — list them here so they're not silently dropped or duplicated when this
      file's example is applied to a new service.

## Migration note (3.x → 4.x)

Jackson 3 changes several defaults silently. After migration, compare actual
JSON output against 3.x output for every API endpoint:
```bash
# Before migration (3.x)
curl -s http://localhost:8080/api/payments/123 | jq .

# After migration (4.x) — compare field names, date formats, null handling
curl -s http://localhost:8080/api/payments/123 | jq .
```
