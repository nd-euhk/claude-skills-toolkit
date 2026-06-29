# Spring Boot 4 — Security (Spring Security 7)

## Basic Config

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**", "/actuator/health").permitAll()
            .requestMatchers("/api/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated())
        .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
        .csrf(csrf -> csrf.disable())
        .sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))
        .build();
  }
}
```

## JWT Resource Server

```yaml
spring.security.oauth2.resourceserver.jwt:
  issuer-uri: https://auth.example.com
  jwk-set-uri: https://auth.example.com/.well-known/jwks.json
```

```java
@Bean
JwtAuthenticationConverter jwtConverter() {
  var grantedConverter = new JwtGrantedAuthoritiesConverter();
  grantedConverter.setAuthoritiesClaimName("roles");
  grantedConverter.setAuthorityPrefix("ROLE_");
  var converter = new JwtAuthenticationConverter();
  converter.setJwtGrantedAuthoritiesConverter(grantedConverter);
  return converter;
}
```

## Method-Level Security

```java
@Configuration
@EnableMethodSecurity
public class MethodSecurityConfig {}

@Service
public class OrderService {

  @PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
  public List<OrderDto> getUserOrders(String userId) { ... }

  @PostAuthorize("returnObject.ownerId == authentication.name")
  public OrderDto getOrder(Long id) { ... }
}
```

## WebAuthn / Passkeys (Spring Security 7)

```java
@Bean
SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
  return http
      .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
      .webAuthn(webauthn -> webauthn
          .rpName("My Application")
          .rpId("example.com")
          .allowedOrigins("https://example.com"))
      .build();
}
```

## Security Tests

```java
@SpringBootTest
@AutoConfigureMockMvc
class SecurityTest {

  @Autowired MockMvc mockMvc;

  @Test
  @WithMockUser(roles = "USER")
  void authenticated_user_can_access() throws Exception {
    mockMvc.perform(get("/api/orders")).andExpect(status().isOk());
  }

  @Test
  void unauthenticated_returns_401() throws Exception {
    mockMvc.perform(get("/api/orders")).andExpect(status().isUnauthorized());
  }

  @Test
  @WithMockUser(roles = "USER")
  void user_cannot_access_admin() throws Exception {
    mockMvc.perform(delete("/api/admin/users/1")).andExpect(status().isForbidden());
  }
}
```
