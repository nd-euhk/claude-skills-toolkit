# Testing convention (team-specific)

Read this when writing or editing tests — especially anything that used to
rely on `@MockBean`/`@SpyBean`, which were removed in Boot 4 (Tier 1 in the
main SKILL.md).

## Safe default — mock replacements

The direct, least-friction replacement for `@MockBean`/`@SpyBean` in a
`@SpringBootTest`/slice test context is `@MockitoBean`/`@MockitoSpyBean`
(Boot's own 3.4+ replacements — same mental model, different name):

```java
package com.example.app.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
class OrderServiceTest {

    @MockitoBean // was @MockBean in Boot 3.x — same usage, new annotation
    PaymentClient paymentClient;

    @org.springframework.beans.factory.annotation.Autowired
    OrderService orderService;

    @Test
    void shouldRejectOrderWhenPaymentFails() {
        when(paymentClient.charge(any())).thenReturn(PaymentResult.failed());

        var result = orderService.placeOrder(someOrderRequest());

        assertThat(result.status()).isEqualTo(OrderStatus.REJECTED);
    }
}
```

For a plain unit test with no Spring context at all (faster, preferred when
you don't actually need the application context wired up), skip Boot's
annotations entirely and use Mockito directly:

```java
package com.example.app.service;

import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class OrderCalculatorTest {

    @Mock
    PricingRules pricingRules;

    @Test
    void appliesDiscountCorrectly() {
        when(pricingRules.discountFor(any())).thenReturn(BigDecimal.valueOf(0.1));

        var calculator = new OrderCalculator(pricingRules);
        var result = calculator.calculateTotal(someOrder());

        // assertions...
    }
}
```

### Testcontainers integration test base class

If multiple test classes need a real database, share one base class instead
of repeating container setup per test class:

```java
package com.example.app.testsupport;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
public abstract class BaseIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
}
```

Then any integration test just extends it:

```java
class OrderRepositoryIntegrationTest extends BaseIntegrationTest {
    // gets the real Postgres container for free, no setup duplication
}
```

## Common mistakes to watch for (these compile and run, but are wrong)

- **Using `@MockitoBean` when a plain `@Mock` would do.** `@MockitoBean`
  pulls in the full Spring context, which is slow. If the test doesn't
  actually need Spring wiring, use `@ExtendWith(MockitoExtension.class)` +
  `@Mock` instead — faster tests, same coverage.
- **Forgetting the static container needs to be shared, not per-test-method.**
  The `static` modifier on the `@Container` field above matters — without
  it, a new container spins up per test method, which is slow and usually
  not what's intended.
- **Re-declaring Testcontainers setup in every test class** instead of
  extending a shared base — this is the single most common thing that gets
  duplicated across test files; if it's happening, that's the signal to
  extract a base class like the one above.
- **Assuming `@DataJpaTest`/`@WebMvcTest` slice tests automatically pick up
  the same security config as the full app.** Slice tests load a minimal
  context — if a controller test needs authenticated requests to behave
  correctly, the security test setup usually needs to be added explicitly
  (e.g. `@Import` of a test security config, or `@WithMockUser`).

## Capture checklist (things the team needs to decide)

- [ ] Standard mock replacement: `@MockitoBean`/`@MockitoSpyBean` vs plain
      Mockito `@Mock`/`@Captor` with `MockitoExtension`? Pick one as the
      department-wide default.
- [ ] Shared `BaseIntegrationTest` — does one already exist? Replace the
      example above with the real one so new tests extend the right base.
- [ ] Which containers are standardized (Postgres, Kafka, Redis?) and whether
      they're shared/reused across test classes via a singleton container
      pattern, or spun up fresh per test class as in the example above.

## Migration note (3.x → 4.x)

Tests are the most mechanical part of the migration — the patterns are
well-defined. Run `grep -r '@MockBean\|@SpyBean' src/test/` to find every
occurrence, then replace with `@MockitoBean` / `@MockitoSpyBean`.
