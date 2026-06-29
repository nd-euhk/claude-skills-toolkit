# Spring Boot 4 — Packaging & Deployment

## OCI Image via Buildpacks

```bash
# Build (no Dockerfile needed)
./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=my-service:1.0.0

# Native image
./mvnw -Pnative spring-boot:build-image
```

```xml
<!-- Configure builder in pom.xml -->
<plugin>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-maven-plugin</artifactId>
  <configuration>
    <image>
      <name>registry.example.com/${project.artifactId}:${project.version}</name>
      <builder>paketobuildpacks/builder-jammy-base</builder>
      <env>
        <BP_JVM_VERSION>21</BP_JVM_VERSION>
        <BPE_APPEND_JAVA_TOOL_OPTIONS>-XX:+UseZGC -XX:+ZGenerational</BPE_APPEND_JAVA_TOOL_OPTIONS>
      </env>
    </image>
  </configuration>
</plugin>
```

## Layered JAR Dockerfile

```dockerfile
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml .
RUN ./mvnw dependency:go-offline
COPY src src
RUN ./mvnw package -DskipTests
RUN java -Djarmode=layertools -jar target/*.jar extract

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=builder /app/dependencies/ ./
COPY --from=builder /app/spring-boot-loader/ ./
COPY --from=builder /app/snapshot-dependencies/ ./
COPY --from=builder /app/application/ ./
EXPOSE 8080
ENTRYPOINT ["java","-XX:+UseZGC","-XX:+ZGenerational","-Xms256m","-Xmx512m","org.springframework.boot.loader.launch.JarLauncher"]
```

## Helm values.yaml

```yaml
image:
  repository: registry.example.com/my-service
  tag: 1.0.0

replicaCount: 3

resources:
  requests: { memory: 256Mi, cpu: 250m }
  limits:   { memory: 512Mi, cpu: 500m }

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

env:
  SPRING_PROFILES_ACTIVE: prod
  JAVA_OPTS: "-XX:+UseZGC -XX:+ZGenerational"
```

## GitHub Actions CI/CD

```yaml
name: Build and Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-java@v4
      with:
        java-version: '21'
        distribution: 'temurin'
        cache: maven
    - run: ./mvnw verify
    - run: |
        ./mvnw spring-boot:build-image \
          -Dspring-boot.build-image.imageName=${{ env.IMAGE }}
        docker push ${{ env.IMAGE }}
      env:
        IMAGE: registry.example.com/my-service:${{ github.sha }}
    - run: |
        helm upgrade --install my-service chart/ \
          --set image.tag=${{ github.sha }} --namespace production
```
