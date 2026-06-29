# Spring Boot 4 — Cloud-Native Microservices on Kubernetes

## K8s-Ready Config

```yaml
management:
  endpoint.health.probes.enabled: true
  health:
    livenessstate.enabled: true
    readinessstate.enabled: true
server:
  shutdown: graceful
spring:
  lifecycle.timeout-per-shutdown-phase: 30s
```

## Health Probes

| Endpoint | K8s Probe | Purpose |
|----------|-----------|----------|
| `/actuator/health/liveness` | livenessProbe | Restart if fails |
| `/actuator/health/readiness` | readinessProbe | Traffic gate |
| `/actuator/health` | startupProbe | Startup gate |

## Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: my-service
        image: my-service:latest
        resources:
          requests: { memory: "256Mi", cpu: "250m" }
          limits:   { memory: "512Mi", cpu: "500m" }
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
      terminationGracePeriodSeconds: 60
```

## Circuit Breaker with Resilience4j

```java
@CircuitBreaker(name = "downstream-service",
                fallbackMethod = "createOrderFallback")
public OrderDto createOrder(CreateOrderRequest request) {
  return paymentClient.charge(request);
}

private OrderDto createOrderFallback(CreateOrderRequest req, Exception e) {
  return OrderDto.pending(req);
}
```

```yaml
resilience4j.circuit-breaker.instances.downstream-service:
  sliding-window-size: 10
  failure-rate-threshold: 50
  wait-duration-in-open-state: 10s
```

## Helm Chart Structure

```
chart/
├── Chart.yaml
├── values.yaml
├── values-staging.yaml
├── values-prod.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    ├── hpa.yaml
    └── ingress.yaml
```
