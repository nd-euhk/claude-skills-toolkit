# Spring Data / Repository convention (team-specific)

Read this when writing or editing `@Repository` interfaces, JPA entities,
or anything touching Spring Data's AOT Repository support in Boot 4.

## Safe default — entity + repository with auditing base class

A shared base entity for created/updated timestamps avoids repeating
auditing boilerplate on every entity:

```java
package com.example.app.domain;

import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AuditableEntity {

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
```

```java
package com.example.app.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import java.math.BigDecimal;

@Entity
public class Order extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String customerEmail;
    private BigDecimal totalAmount;
    private OrderStatus status;

    // getters/setters omitted for brevity
}
```

Repository — derived methods for simple lookups, `@Query` once logic gets
non-trivial (the line to draw between the two is exactly where a derived
method name would start getting unreadably long):

```java
package com.example.app.repository;

import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, String> {

    // Simple enough for a derived method — fine as-is.
    List<Order> findByCustomerEmail(String customerEmail);

    // Once you'd need something like
    // findByStatusAndCreatedAtBetweenOrderByCreatedAtDesc(...), switch to
    // @Query instead — it's more readable and easier to optimize.
    @Query("""
        SELECT o FROM Order o
        WHERE o.status = :status
        AND o.createdAt >= :since
        ORDER BY o.createdAt DESC
        """)
    Page<Order> findRecentByStatus(
        @Param("status") OrderStatus status,
        @Param("since") Instant since,
        Pageable pageable
    );
}
```

Don't forget to enable JPA auditing once, application-wide:

```java
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
```

## Common mistakes to watch for (these compile and run, but are wrong)

- **Letting a derived method name grow past 3-4 conditions.** Something
  like `findByStatusAndCustomerEmailAndCreatedAtBetweenAndTotalAmountGreaterThan`
  technically works but is unreadable and easy to get subtly wrong (parameter
  order). Switch to `@Query` once it gets here — there's no fixed rule, but
  if you have to pause to parse the method name yourself, that's the signal.
- **Returning `List<T>` for queries that could return a large result set.**
  Without `Pageable`, an unexpectedly large table can pull everything into
  memory at once. Default to `Page<T>` + `Pageable` for anything
  user-facing or potentially unbounded.
- **Forgetting `@EnableJpaAuditing`.** Without it, `@CreatedDate`/
  `@LastModifiedDate` fields silently stay `null` — no error, just empty
  timestamps. This is a classic "compiles and runs, wrong result" trap.
- **Not indexing the columns used in `@Query` `WHERE`/`ORDER BY` clauses.**
  Not a compile-time or even Boot-4-specific issue, but worth flagging if a
  new query is added against a column that doesn't have a corresponding
  database index — it'll work fine in dev with a small dataset and degrade
  badly in production.

## Capture checklist (things the team needs to decide)

- [ ] Whether `AuditableEntity` (or an equivalent) already exists somewhere in
      the codebase — replace the example above with the actual shared base
      class rather than this generic one.
- [ ] Whether the team has adopted AOT Repositories, and if so, whether that
      changes anything about how queries should be written (e.g. avoiding
      constructs that don't AOT-compile cleanly).
- [ ] Standard pagination/sorting conventions — default page size, whether
      sort fields need to be whitelisted to avoid exposing internal column
      names through an API parameter.
- [ ] Soft-delete convention, if used (e.g. a `deletedAt` field + a default
      query filter) — this affects every repository method, so it's worth
      pinning down explicitly rather than re-deciding per entity.

## Migration note (3.x → 4.x)

Spring Data itself is largely backward-compatible. The main change is AOT
Repository support (opt-in in 4.x). No urgent action needed for existing
repositories — they should work as-is. Focus on standardizing patterns
for new code rather than retrofitting existing entities.
