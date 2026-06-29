# Spring Boot 4 — GraalVM Native Image

## Build Commands

```bash
# Native executable
./mvnw -Pnative native:compile

# Native Docker image (no GraalVM on CI needed)
./mvnw -Pnative spring-boot:build-image
```

## Maven Profile

```xml
<profiles>
  <profile>
    <id>native</id>
    <build>
      <plugins>
        <plugin>
          <groupId>org.graalvm.buildtools</groupId>
          <artifactId>native-maven-plugin</artifactId>
          <extensions>true</extensions>
        </plugin>
      </plugins>
    </build>
  </profile>
</profiles>
```

## Register Reflection Hints

```java
// Option 1: RuntimeHintsRegistrar
@Component
public class MyRuntimeHints implements RuntimeHintsRegistrar {
  @Override
  public void registerHints(RuntimeHints hints, ClassLoader cl) {
    hints.reflection().registerType(MyExternalDto.class, MemberCategory.values());
    hints.resources().registerPattern("data/*.json");
    hints.proxies().registerJdkProxy(MyInterface.class);
  }
}

// Option 2: Simpler for DTOs
@Configuration
@RegisterReflectionForBinding({MyDto.class, AnotherDto.class})
public class NativeConfig {}
```

## Common Failures

| Error | Fix |
|-------|-----|
| No serializer found for class | `@RegisterReflectionForBinding(MyDto.class)` |
| Proxy class not found | `hints.proxies().registerJdkProxy(MyInterface.class)` |
| FileNotFoundException: schema.sql | `hints.resources().registerPattern("schema.sql")` |

## Native vs JVM

| Metric | JVM | Native |
|--------|-----|--------|
| Startup | 2-5s | 50-200ms |
| Memory | 200-400MB | 40-80MB |
| Build time | Fast | 2-10 min |
| Best for | Long-running | Serverless/Lambda |

## Native Test

```java
@SpringBootTest
@NativeImageTest
class NativeApplicationTest {
  @Test void contextLoads() {}
}
```
