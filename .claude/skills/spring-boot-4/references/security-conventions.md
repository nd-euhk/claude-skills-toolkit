# Security / CSRF convention (team-specific)

Read this when writing or editing `SecurityFilterChain` beans, JWT/OAuth2
resource server config, or anything under a `security/` or `config/security`
package.

The "capture checklist" at the bottom is for once the team's real convention
is confirmed. Until then, **use the worked example below as the actual
default** — it's a complete, runnable pattern for a stateless JWT-based REST
API, which is the most common case for a department running internal services
on GitHub/GitLab + Docker/K8s.

## Safe default — stateless JWT resource server

This is what "REST API, token auth, no CSRF needed" looks like end to end
in Boot 4 / Spring Security 7. Use this as the starting point, not just the
two-line CSRF disable shown in the main SKILL.md.

```java
package com.example.app.config.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // No cookies involved in auth, so CSRF protection has nothing to
            // protect against here. Explicit + commented, never implicit.
            .csrf(csrf -> csrf.disable())

            // No server-side session state — every request carries its own
            // bearer token, so there's nothing to "create" a session for.
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Public endpoints first, most specific matchers before broader ones.
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )

            // Delegates token validation to Spring Security's OAuth2 resource
            // server support — this is what actually checks the JWT signature,
            // expiry, and issuer against your IdP/auth server.
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
            );

        return http.build();
    }

    // Maps JWT claims (e.g. a "roles" or "scope" claim) into Spring Security
    // authorities. Adjust the claim name to whatever your IdP actually emits —
    // this is the #1 thing that's wrong by default if authorization checks
    // silently fail even though the token itself is valid.
    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthorityPrefix("ROLE_");
        authoritiesConverter.setAuthoritiesClaimName("roles");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        return converter;
    }
}
```

Corresponding `application.yml` piece (so the resource server knows where to
validate tokens against):

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://your-idp.example.com/realms/your-realm
          # or, if not using issuer-based discovery:
          # jwk-set-uri: https://your-idp.example.com/realms/your-realm/protocol/openid-connect/certs
```

## Common mistakes to watch for (these compile and run, but are wrong)

- **Disabling CSRF without the STATELESS session policy.** If you disable
  CSRF but leave session management on its default (session-based), you've
  removed the protection without removing the thing it was protecting
  against. Always pair `csrf.disable()` with `STATELESS` for a pure REST API.
- **Forgetting `requestMatchers` order matters.** Spring Security evaluates
  matchers top to bottom and stops at the first match. A broad
  `.anyRequest().authenticated()` placed before a specific `permitAll()`
  matcher will shadow it — the specific rule never gets a chance to fire.
- **Assuming the JWT claim name.** `setAuthoritiesClaimName("roles")` above
  is a guess at a common convention — Keycloak, Auth0, Okta, and a custom
  IdP may all use different claim names (`roles`, `scope`, `realm_access.roles`,
  a custom claim). Confirm the actual claim shape from a real token
  (decode one at jwt.io or via `jwt --decode`) rather than assuming.
- **Mixing cookie-based admin UI auth into the same filter chain as the
  stateless API.** If one service has both a JWT API and a cookie-based
  admin panel, that needs **two separate `SecurityFilterChain` beans** with
  `@Order` and distinct `securityMatcher(...)` scoping — not one chain
  trying to do both. Flag this to the user rather than picking one
  approach silently if the request seems to involve both.

## Capture checklist (things the team needs to decide)

- [ ] Which IdP / auth server is actually in use, and the real claim name for
      roles/authorities (replace the guess in the example above).
- [ ] Whether any service legitimately needs cookie-based session auth (e.g.
      an internal admin panel) — if so, note which one and use the
      two-filter-chain pattern above instead of the single-chain example.
- [ ] CORS policy, if standardized (allowed origins, credentials handling) —
      add a `.cors(...)` block to the example above once confirmed.
- [ ] Multi-tenant handling, if applicable.

## Migration note (3.x → 4.x)

The security migration is the highest-risk change in any 3.x → 4.x jump:
- `WebSecurityConfigurerAdapter` is gone → rewrite as `SecurityFilterChain` bean
- Method-chaining DSL is gone → lambda DSL only
- CSRF is ON by default for everything → must be configured explicitly
- Always verify with `curl -X POST` against real endpoints after migration
