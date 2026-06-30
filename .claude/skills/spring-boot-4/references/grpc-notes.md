# Spring gRPC (Boot 4.1+) — handle with extra care

Read this when writing or editing anything involving **Spring gRPC**, the
native integration that shipped in Boot 4.1.0 — distinct from the older,
unofficial `net.devh:grpc-spring-boot-starter` third-party project that
most existing blog posts and tutorials online describe. If existing project
code uses `net.devh.boot.grpc.*` imports, that's the old third-party
starter, not the new Boot-native one — don't mix the two.

**Confidence note for this file specifically:** this is the newest, least
training-data-saturated corner of Boot 4.x covered by this skill. Verify
specifics (exact property names, exact starter artifact IDs) against
current Spring gRPC reference docs before committing to them in code,
rather than treating anything below as guaranteed-correct from memory.

## Safe default — server + client (Boot-native Spring gRPC)

Maven dependency (server side):

```xml
<dependency>
    <groupId>org.springframework.grpc</groupId>
    <artifactId>spring-grpc-spring-boot-starter</artifactId>
</dependency>
```

Service implementation — extend the generated `ImplBase` from your `.proto`
file, annotate with `@GrpcService` (Spring will auto-register it as a
`BindableService` bean):

```java
package com.example.app.grpc;

import io.grpc.stub.StreamObserver;
import org.springframework.grpc.server.service.GrpcService;

@GrpcService
public class GreeterService extends GreeterGrpc.GreeterImplBase {

    @Override
    public void sayHello(HelloRequest request, StreamObserver<HelloReply> responseObserver) {
        HelloReply reply = HelloReply.newBuilder()
            .setMessage("Hello, " + request.getName())
            .build();
        responseObserver.onNext(reply);
        responseObserver.onCompleted();
    }
}
```

`application.yml` — server port and basics:

```yaml
spring:
  grpc:
    server:
      port: 9090
```

Client side — Boot 4.1 added auto-configured stub injection via named
channels, configured under `spring.grpc.client.channel.*`:

```yaml
spring:
  grpc:
    client:
      channels:
        greeter-service:
          address: static://greeter-service:9090
```

```java
package com.example.app.client;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class GreeterClient {

    private final GreeterGrpc.GreeterBlockingStub stub;

    @Autowired
    public GreeterClient(GreeterGrpc.GreeterBlockingStub stub) {
        this.stub = stub;
    }

    public String greet(String name) {
        HelloReply reply = stub.sayHello(
            HelloRequest.newBuilder().setName(name).build()
        );
        return reply.getMessage();
    }
}
```

## What's auto-configured out of the box (don't reimplement these)

- **Observability** — adding Spring Boot Actuator to the project is enough
  to get tracing and metrics for gRPC calls; there's an autoconfigured
  interceptor that wires this in automatically. Don't hand-write a manual
  tracing interceptor before checking whether actuator alone already
  covers it.
- **Health checks** — the standard gRPC Health service is auto-registered,
  and integrates with Spring Boot's own health model if Actuator's health
  endpoint is present.
- **Reflection service** — auto-configured, so tools like `grpcurl` can
  discover services at runtime without extra setup.
- **`@Async` trace context propagation (4.1 specifically)** — context
  propagation to methods running on a separate thread via `@Async` is now
  automatic. If older code manually threaded trace context through async
  boundaries, that workaround may now be redundant — verify rather than
  assume it's still needed.

## Common mistakes to watch for

- **Mixing `net.devh.boot.grpc.*` (third-party starter) imports with
  `org.springframework.grpc.*` (Boot-native) in the same project.** Most
  existing online tutorials describe the third-party starter — if asked to
  write Spring gRPC code, confirm which one the project actually uses
  before pattern-matching off of a generic "Spring Boot gRPC" tutorial.
- **Implementing `BindableService` directly instead of extending the
  generated `*ImplBase`.** Bypassing the generated base class can also
  bypass Spring Security's checks on the service — extend the generated
  base class, not the raw interface.
- **Assuming exact property paths or starter artifact IDs from memory.**
  Given how new this feature is, double-check the actual current artifact
  name (e.g. whether it's `spring-grpc-spring-boot-starter` or a renamed
  variant by the time this is used) against current docs rather than
  trusting recall.

## Capture checklist (things the team needs to decide)

- [ ] Whether the project uses the Boot-native `org.springframework.grpc`
      starter or the third-party `net.devh` one (relevant if migrating).
- [ ] `.proto` file organization convention in the repo, and codegen plugin
      setup (Maven's `protobuf-maven-plugin` vs Gradle's `com.google.protobuf`
      plugin — Boot 4.1 manages and pre-configures both).
- [ ] Interceptor conventions for cross-cutting concerns (auth, logging) beyond
      what's auto-configured.
- [ ] Error handling convention via `@GrpcAdvice`, once a pattern is settled.

## Migration note (3.x → 4.x)

Spring gRPC is new in 4.1 — there's no 3.x equivalent to migrate from. If
the project already uses the third-party `net.devh` gRPC starter, don't
assume it needs to be replaced. The Boot-native gRPC support is additive,
not a forced migration.
