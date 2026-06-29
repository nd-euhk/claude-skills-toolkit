# Spring Boot 4 — Messaging & Events

## Kafka

```yaml
spring.kafka:
  bootstrap-servers: kafka:9092
  producer:
    key-serializer: org.apache.kafka.common.serialization.StringSerializer
    value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
    acks: all
    retries: 3
  consumer:
    group-id: my-service
    key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
    value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
    auto-offset-reset: earliest
    enable-auto-commit: false
  listener.ack-mode: MANUAL_IMMEDIATE
```

```java
// Producer
@Service
public class OrderEventPublisher {
  private final KafkaTemplate<String, OrderEvent> kafka;

  public void publish(OrderEvent event) {
    kafka.send("order-events", event.orderId(), event)
        .whenComplete((r, ex) -> {
          if (ex != null) log.error("Publish failed", ex);
        });
  }
}

// Consumer
@Component
public class InventoryConsumer {
  @KafkaListener(topics = "order-events", groupId = "inventory-service")
  public void consume(ConsumerRecord<String, OrderEvent> record, Acknowledgment ack) {
    try {
      inventoryService.reserveItems(record.value());
      ack.acknowledge();
    } catch (Exception e) {
      log.error("Failed: {}", record.key(), e);
      // No ack = retry
    }
  }
}
```

## RabbitMQ

```java
@Configuration
public class RabbitConfig {
  @Bean Queue orderQueue() {
    return QueueBuilder.durable("order.processing")
        .withArgument("x-dead-letter-exchange", "order.dlx")
        .build();
  }
  @Bean DirectExchange orderExchange() { return new DirectExchange("order.events"); }
  @Bean Binding binding(Queue q, DirectExchange ex) { return BindingBuilder.bind(q).to(ex).with("order"); }
}

@RabbitListener(queues = "order.processing")
public void process(OrderEvent event, Channel ch,
                    @Header(AmqpHeaders.DELIVERY_TAG) long tag) throws IOException {
  try {
    orderService.process(event);
    ch.basicAck(tag, false);
  } catch (Exception e) {
    ch.basicNack(tag, false, false); // Send to DLQ
  }
}
```

## Transactional Outbox Pattern

```sql
-- V2__create_outbox.sql
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  published BOOLEAN NOT NULL DEFAULT FALSE
);
```

```java
// In same @Transactional as DB write
@Transactional
public OrderDto createOrder(CreateOrderRequest req) {
  var order = orderRepository.save(Order.from(req));
  outboxRepository.save(new OutboxEvent("order-events",
      objectMapper.writeValueAsString(OrderCreatedEvent.from(order))));
  return OrderDto.from(order);
}

// Publisher (scheduled every 1s)
@Scheduled(fixedDelay = 1000)
@Transactional
public void publishPending() {
  var events = outboxRepository.findByPublishedFalse(PageRequest.of(0, 100));
  events.forEach(e -> { kafka.send(e.getTopic(), e.getPayload()); e.setPublished(true); });
  outboxRepository.saveAll(events);
}
```

## Spring Application Events (In-Process)

```java
public record OrderCreatedEvent(Long orderId, String customerId) {}

@Transactional
public OrderDto createOrder(CreateOrderRequest req) {
  var order = orderRepository.save(Order.from(req));
  publisher.publishEvent(new OrderCreatedEvent(order.getId(), req.customerId()));
  return OrderDto.from(order);
}

@TransactionalEventListener(phase = AFTER_COMMIT)
@Async
public void handleOrderCreated(OrderCreatedEvent event) {
  notificationService.sendConfirmation(event.customerId());
}
```
