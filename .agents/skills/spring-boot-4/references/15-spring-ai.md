# Spring Boot 4 — Spring AI Integration

## Dependencies (BOM)

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.ai</groupId>
      <artifactId>spring-ai-bom</artifactId>
      <version>1.0.0</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <dependency><groupId>org.springframework.ai</groupId><artifactId>spring-ai-openai-spring-boot-starter</artifactId></dependency>
  <!-- Local: -->
  <dependency><groupId>org.springframework.ai</groupId><artifactId>spring-ai-ollama-spring-boot-starter</artifactId></dependency>
  <!-- Vector DB: -->
  <dependency><groupId>org.springframework.ai</groupId><artifactId>spring-ai-pgvector-store-spring-boot-starter</artifactId></dependency>
</dependencies>
```

## Basic Chat

```yaml
spring.ai.openai:
  api-key: ${OPENAI_API_KEY}
  chat.model: gpt-4o
  chat.temperature: 0.7
```

```java
@RestController
public class AiController {
  private final ChatClient chatClient;

  public AiController(ChatClient.Builder builder) {
    this.chatClient = builder
        .defaultSystem("You are a helpful e-commerce assistant.")
        .build();
  }

  @PostMapping("/api/ai/chat")
  public String chat(@RequestBody String message) {
    return chatClient.prompt(message).call().content();
  }

  @PostMapping(value = "/api/ai/chat/stream", produces = TEXT_EVENT_STREAM_VALUE)
  public Flux<String> stream(@RequestBody String message) {
    return chatClient.prompt(message).stream().content();
  }
}
```

## Structured Output

```java
public record ProductRecommendation(String name, String reason, BigDecimal price) {}

public List<ProductRecommendation> recommend(String userProfile) {
  return chatClient.prompt()
      .user(u -> u.text("Recommend 3 products for: {profile}").param("profile", userProfile))
      .call()
      .entity(new ParameterizedTypeReference<List<ProductRecommendation>>() {});
}
```

## RAG Pipeline

```java
// 1. Ingest documents
@Component
public class DocumentIngester {
  private final VectorStore vectorStore;

  public void ingest(Resource[] resources) {
    for (Resource r : resources) {
      var chunks = new TokenTextSplitter(500, 50).apply(new TextReader(r).get());
      vectorStore.add(chunks);
    }
  }
}

// 2. Query with RAG advisor
@Service
public class KnowledgeBase {
  private final ChatClient chatClient;
  private final VectorStore vectorStore;

  public String query(String question) {
    return chatClient.prompt()
        .advisors(new QuestionAnswerAdvisor(vectorStore, SearchRequest.defaults()))
        .user(question)
        .call().content();
  }
}
```

## Ollama (Local Models)

```yaml
spring.ai.ollama:
  base-url: http://localhost:11434
  chat.model: llama3.2
```

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 ollama/ollama
docker exec ollama ollama pull llama3.2
```

## pgvector Store

```yaml
spring.ai.vectorstore.pgvector:
  index-type: hnsw
  distance-type: cosine_distance
  dimensions: 1536
```

```sql
-- Flyway: V3__enable_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Function Calling (Tool Use)

```java
@Bean
@Description("Get the status of an order by order ID")
Function<GetOrderStatusRequest, OrderStatusResponse> getOrderStatus(
    OrderRepository repo) {
  return req -> {
    var order = repo.findById(req.orderId()).orElseThrow();
    return new OrderStatusResponse(order.getId(), order.getStatus());
  };
}

// In controller
return chatClient.prompt()
    .user(question)
    .functions("getOrderStatus")
    .call().content();
```
