---
title: "Event Schema: {{domain}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - architecture.md
  - scale-strategy.md
referenced_by:
  - tech-design/*.md
  - impl-spec-*.md
changelog:
  - 1.0 | {{date}} | Initial event schema
---

# Event Schema — {{domain}}

> **Context budget**: ~410 dòng. Load khi implement event-driven communication.

> Event-driven communication cho hệ thống ≥ 100K TPS.
> Sử dụng Apache Kafka làm event bus mặc định.

## 1. Topic Design

### Naming Convention
```
{company}.{domain}.{entity}.{event_type}

Ví dụ:
  acme.payment.transaction.created
  acme.payment.transaction.completed
  acme.user.profile.updated
  acme.order.item.cancelled
```

### Topic Registry

| Topic | Producer | Consumers | Partitions | Retention | Key |
|-------|----------|-----------|------------|-----------|-----|
| {{company}}.{{domain}}.{{entity}}.created | {{service}}-service | {{consumer1}}, {{consumer2}} | {{partitions}} | {{retention}} | entityId |
| {{company}}.{{domain}}.{{entity}}.updated | {{service}}-service | {{consumer1}} | {{partitions}} | {{retention}} | entityId |
| {{company}}.{{domain}}.{{entity}}.deleted | {{service}}-service | {{consumer1}} | {{partitions}} | {{retention}} | entityId |

### Partition Strategy

| Strategy | Key | Use Case | Ordering Guarantee |
|----------|-----|----------|-------------------|
| Entity-based | `entityId` | CRUD events — same entity luôn vào cùng partition | Per-entity |
| Tenant-based | `tenantId` | Multi-tenant — same tenant cùng partition | Per-tenant |
| Random | null | High throughput, không cần ordering | None |

```
Partitions = max(ceil(target_throughput / throughput_per_partition), num_consumers)
# throughput_per_partition ≈ 10K–50K msg/sec (tuỳ message size)
# num_consumers = consumer group size (mỗi partition chỉ 1 consumer trong group)
```

## 2. Event Envelope (Standard Format)

> Mọi event PHẢI tuân theo envelope format này. AI agent sinh code PHẢI dùng đúng cấu trúc.

```json
{
  "eventId": "uuid-v7",
  "eventType": "{{domain}}.{{entity}}.{{action}}",
  "eventVersion": "1.0",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "source": "{{service}}-service",
  "correlationId": "uuid — propagated from HTTP request X-Correlation-Id",
  "causationId": "uuid — eventId of the event that caused this event",
  "partitionKey": "{{entityId}}",
  "data": {
    // Event-specific payload — xem Section 3
  },
  "metadata": {
    "userId": "uuid — who triggered this",
    "traceId": "OpenTelemetry trace ID",
    "spanId": "OpenTelemetry span ID"
  }
}
```

### Java Record
```java
public record DomainEvent<T>(
    UUID eventId,
    String eventType,
    String eventVersion,
    Instant timestamp,
    String source,
    UUID correlationId,
    UUID causationId,
    String partitionKey,
    T data,
    EventMetadata metadata
) {
    public static <T> DomainEvent<T> of(String eventType, T data, UUID correlationId) {
        return new DomainEvent<>(
            UUID.randomUUID(),
            eventType,
            "1.0",
            Instant.now(),
            "{{service}}-service",
            correlationId,
            null,
            null,
            data,
            EventMetadata.fromContext()
        );
    }
}

public record EventMetadata(UUID userId, String traceId, String spanId) {
    public static EventMetadata fromContext() {
        // Extract from SecurityContext + OpenTelemetry
        return new EventMetadata(
            SecurityUtils.getCurrentUserId(),
            Span.current().getSpanContext().getTraceId(),
            Span.current().getSpanContext().getSpanId()
        );
    }
}
```

## 3. Event Definitions per Entity

### {{Entity}}CreatedEvent
```json
{
  "eventType": "{{domain}}.{{entity}}.created",
  "data": {
    "id": "uuid",
    "field1": "value",
    "field2": "value",
    "createdAt": "ISO-8601"
  }
}
```

### {{Entity}}UpdatedEvent
```json
{
  "eventType": "{{domain}}.{{entity}}.updated",
  "data": {
    "id": "uuid",
    "changes": {
      "field1": { "old": "oldValue", "new": "newValue" }
    },
    "updatedAt": "ISO-8601"
  }
}
```

### {{Entity}}DeletedEvent
```json
{
  "eventType": "{{domain}}.{{entity}}.deleted",
  "data": {
    "id": "uuid",
    "deletedAt": "ISO-8601",
    "reason": "string"
  }
}
```

## 4. Producer Configuration

### Spring Kafka Producer
```yaml
spring:
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      acks: all                        # Durability: wait for all replicas
      retries: 3
      properties:
        enable.idempotence: true       # Exactly-once producer
        max.in.flight.requests.per.connection: 5
        delivery.timeout.ms: 120000    # 2 min total timeout
        linger.ms: 5                   # Batch small messages
        batch.size: 16384              # 16KB batch
        compression.type: lz4          # Fast compression
```

### Producer Service Pattern
```java
@Service
@RequiredArgsConstructor
@Slf4j
public class {{Entity}}EventPublisher {
    private final KafkaTemplate<String, DomainEvent<?>> kafkaTemplate;
    private static final String TOPIC = "{{company}}.{{domain}}.{{entity}}";

    /**
     * Publish event AFTER transaction commits.
     * NEVER call inside @Transactional — use TransactionalEventListener.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCreated({{Entity}}CreatedEvent event) {
        var domainEvent = DomainEvent.of(
            TOPIC + ".created",
            event.getData(),
            event.getCorrelationId()
        );
        kafkaTemplate.send(TOPIC + ".created", event.getEntityId().toString(), domainEvent)
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish event: topic={}, key={}", 
                        TOPIC, event.getEntityId(), ex);
                    // Fallback: persist to outbox table for retry
                    outboxRepository.save(OutboxEvent.from(domainEvent));
                }
            });
    }
}
```

### Transactional Outbox Pattern (Guaranteed Delivery)
```
Khi event publish thất bại → lưu vào outbox table → scheduler retry

┌──────────────┐  1. Save entity   ┌────────────┐
│   Service    │──────────────────▶│ PostgreSQL │
│              │  2. Save outbox    │ (same TX)  │
│              │──────────────────▶│            │
└──────────────┘                   └────────────┘
                                         │
        ┌────────────────────────────────┘
        │ 3. Poll outbox (scheduler)
        ▼
┌──────────────┐  4. Publish       ┌────────────┐
│   Outbox     │──────────────────▶│   Kafka    │
│  Processor   │  5. Mark sent     │            │
│  (Debezium   │──────────────────▶│            │
│   or cron)   │                   └────────────┘
└──────────────┘
```

```sql
-- Outbox table
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(255) NOT NULL,
    partition_key VARCHAR(255),
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, SENT, FAILED
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    INDEX idx_outbox_status_created (status, created_at) WHERE status = 'PENDING'
);
```

## 5. Consumer Configuration

### Spring Kafka Consumer
```yaml
spring:
  kafka:
    consumer:
      group-id: ${spring.application.name}
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      auto-offset-reset: earliest
      enable-auto-commit: false        # Manual commit for at-least-once
      properties:
        spring.json.trusted.packages: "com.{{company}}.{{project}}.*"
        max.poll.records: 500          # Batch size
        max.poll.interval.ms: 300000   # 5 min — max processing time
        session.timeout.ms: 30000      # 30s — detect dead consumer
        heartbeat.interval.ms: 10000   # 10s
    listener:
      type: batch                      # Batch listener
      ack-mode: manual                 # Manual acknowledgment
      concurrency: {{partition_count}} # 1 thread per partition
```

### Idempotent Consumer Pattern
```java
@Component
@RequiredArgsConstructor
public class {{Entity}}EventConsumer {
    private final {{Entity}}Service service;
    private final ProcessedEventRepository processedEventRepo;

    @KafkaListener(
        topics = "{{company}}.{{domain}}.{{entity}}.created",
        groupId = "{{consumer_group}}"
    )
    public void onCreated(
        @Payload DomainEvent<{{Entity}}CreatedData> event,
        Acknowledgment ack
    ) {
        // Idempotency check — skip if already processed
        if (processedEventRepo.existsByEventId(event.eventId())) {
            ack.acknowledge();
            return;
        }

        try {
            service.handleCreated(event.data());
            processedEventRepo.save(new ProcessedEvent(event.eventId(), Instant.now()));
            ack.acknowledge();
        } catch (RetryableException e) {
            // Do NOT acknowledge — Kafka will redeliver
            throw e;
        } catch (Exception e) {
            // Non-retryable — send to DLT
            log.error("Non-retryable error processing event: {}", event.eventId(), e);
            ack.acknowledge(); // Prevent infinite retry — DLT handler picks up
        }
    }
}
```

```sql
-- Processed events table (idempotency)
CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- TTL cleanup: delete records older than topic retention
```

## 6. Dead Letter Topic (DLT)

### DLT Configuration
```java
@Bean
public DefaultErrorHandler errorHandler(KafkaTemplate<String, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(
        template,
        (record, ex) -> new TopicPartition(record.topic() + ".dlt", record.partition())
    );
    var backoff = new FixedBackOff(1000L, 3L); // 3 retries, 1s interval
    return new DefaultErrorHandler(recoverer, backoff);
}
```

### DLT Naming Convention
```
Original: {{company}}.{{domain}}.{{entity}}.created
DLT:      {{company}}.{{domain}}.{{entity}}.created.dlt
```

### DLT Monitoring Alert
```yaml
# Alert khi DLT có message mới
- alert: KafkaDLTMessages
  expr: kafka_consumergroup_lag{topic=~".*\\.dlt"} > 0
  for: 1m
  labels:
    severity: warning
  annotations:
    summary: "Dead letter topic has unprocessed messages"
```

### DLT Replay Strategy
```
1. Investigate root cause từ DLT consumer logs
2. Fix code hoặc external dependency
3. Replay DLT messages:
   - Sử dụng Kafka consumer tool đọc từ DLT
   - Publish lại vào original topic
   - Hoặc process trực tiếp từ DLT consumer
4. Clear DLT sau khi replay thành công
```

## 7. Schema Evolution Rules

### Backward Compatible Changes (SAFE — không cần consumer update trước)
- ✅ Thêm optional field mới (có default value)
- ✅ Thêm new event type
- ✅ Deprecate field (giữ lại, thêm annotation)

### Breaking Changes (UNSAFE — cần coordination)
- ❌ Remove field
- ❌ Rename field
- ❌ Change field type
- ❌ Change event type name

### Migration Strategy cho Breaking Changes
```
1. Bump eventVersion: "1.0" → "2.0"
2. Produce both v1 and v2 (dual-write) trong transition period
3. Consumers migrate to v2
4. Stop producing v1 sau khi all consumers migrated
5. Transition period: ≥ 2 sprints
```

## 8. Kafka Cluster Sizing

### Production Recommendations
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Brokers | ≥ 3 | High availability |
| Replication factor | 3 | Tolerate 1 broker failure |
| Min in-sync replicas | 2 | Durability guarantee |
| Partitions per topic | ≥ num_consumers × 2 | Room to scale consumers |
| Retention | 7 days (default) | Replay window |
| Log segment size | 1GB | Efficient cleanup |
| Message max size | 1MB | Prevent oversized events |

### Monitoring Metrics
| Metric | Warning | Critical |
|--------|---------|----------|
| Consumer lag | > 5000 messages | > 50000 messages |
| Under-replicated partitions | > 0 for 5 min | > 0 for 15 min |
| ISR shrink rate | > 0/sec for 5 min | — |
| Request latency P99 | > 100ms | > 500ms |
| Disk usage | > 75% | > 85% |
