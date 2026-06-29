# Spring Boot 4 — Testing

## Unit Tests

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
  @Mock OrderRepository orderRepository;
  @InjectMocks OrderService orderService;

  @Test void createOrder_success() {
    var savedOrder = new Order(1L, "PENDING", "customer-1");
    when(orderRepository.save(any())).thenReturn(savedOrder);
    var result = orderService.createOrder(new CreateOrderRequest("customer-1", List.of("item-1")));
    assertThat(result.id()).isEqualTo(1L);
  }
}
```

## Integration Tests — Testcontainers + @ServiceConnection

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Testcontainers
class OrderIntegrationTest {

  @Container
  @ServiceConnection  // Auto-configures datasource — no @DynamicPropertySource needed!
  static PostgreSQLContainer<?> postgres =
      new PostgreSQLContainer<>("postgres:16-alpine");

  @Container
  @ServiceConnection
  static KafkaContainer kafka =
      new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6"));

  @Autowired TestRestTemplate rest;

  @Test
  void createOrder_persists_to_db() {
    var resp = rest.postForEntity("/api/orders",
        new CreateOrderRequest("c1", List.of("item1")), OrderDto.class);
    assertThat(resp.getStatusCode()).isEqualTo(CREATED);
  }
}
```

## MockMvc (REST Layer)

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {
  @Autowired MockMvc mockMvc;
  @MockBean OrderService orderService;
  @Autowired ObjectMapper objectMapper;

  @Test
  void createOrder_returns_201() throws Exception {
    when(orderService.createOrder(any())).thenReturn(new OrderDto(1L, "PENDING"));
    mockMvc.perform(post("/api/orders")
            .contentType(APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateOrderRequest("c1", List.of("i1")))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1L));
  }
}
```

## Repository Tests

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = NONE)
@Testcontainers
class OrderRepositoryTest {
  @Container @ServiceConnection
  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

  @Autowired OrderRepository repository;

  @Test
  void findByStatus_returns_matching() {
    repository.saveAll(List.of(new Order("PENDING"), new Order("COMPLETED"), new Order("PENDING")));
    assertThat(repository.findByStatus("PENDING")).hasSize(2);
  }
}
```

## Native Image Test

```java
@SpringBootTest
@NativeImageTest
class NativeApplicationTest {
  @Test void contextLoads() {}
}
```

```bash
./mvnw -Pnative test
```
