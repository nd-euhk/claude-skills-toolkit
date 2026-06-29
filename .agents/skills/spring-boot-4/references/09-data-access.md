# Spring Boot 4 — Data Access

## Entity (Jakarta EE 11 + JSpecify)

```java
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "orders")
public class Order {
  @Id @GeneratedValue(strategy = SEQUENCE) private Long id;
  @NotBlank private String status;
  @Nullable private String trackingCode;
  @ManyToOne(fetch = LAZY) @JoinColumn(name = "customer_id") private Customer customer;
  @CreationTimestamp private Instant createdAt;
}
```

## Repository

```java
public interface OrderRepository extends JpaRepository<Order, Long> {
  List<Order> findByStatus(String status);

  @Query("SELECT o FROM Order o WHERE o.customer.id = :cid AND o.status = :status")
  Page<Order> findByCustomerAndStatus(@Param("cid") Long cid,
                                      @Param("status") String status, Pageable page);

  List<OrderSummary> findByCreatedAtAfter(Instant since);  // Projection
}

public interface OrderSummary {
  Long getId(); String getStatus(); Instant getCreatedAt();
}
```

## Specifications (Dynamic Queries)

```java
public class OrderSpec {
  public static Specification<Order> hasStatus(String status) {
    return (root, q, cb) -> cb.equal(root.get("status"), status);
  }
  public static Specification<Order> createdAfter(Instant since) {
    return (root, q, cb) -> cb.greaterThan(root.get("createdAt"), since);
  }
}

var orders = orderRepository.findAll(
    OrderSpec.hasStatus("PENDING").and(OrderSpec.createdAfter(yesterday)));
```

## HikariCP — Optimal for Virtual Threads

```yaml
spring.datasource.hikari:
  maximum-pool-size: 10    # Keep LOW with virtual threads
  minimum-idle: 5
  connection-timeout: 3000
  idle-timeout: 600000
  max-lifetime: 1800000
  leak-detection-threshold: 60000
```

## R2DBC (Reactive)

```java
public interface ReactiveOrderRepository extends ReactiveCrudRepository<Order, Long> {
  Flux<Order> findByStatus(String status);
}

@Service
public class ReactiveService {
  public Flux<Order> getPending() {
    return repository.findByStatus("PENDING")
        .filter(o -> o.getCreatedAt().isAfter(Instant.now().minus(1, DAYS)));
  }
}
```

## Flyway Migration

```yaml
spring.flyway:
  enabled: true
  locations: classpath:db/migration
  validate-on-migrate: true
```

```sql
-- V1__create_orders_table.sql
CREATE TABLE orders (
  id          BIGSERIAL PRIMARY KEY,
  status      VARCHAR(50) NOT NULL,
  tracking_code VARCHAR(100),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_status ON orders(status);
```
