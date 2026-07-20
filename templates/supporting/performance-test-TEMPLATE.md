---
title: "Performance Test Plan — {{service_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - scale-strategy.md
  - tech-design.md
  - ../docs/SRS/SRS.md
referenced_by:
  - ../operations/monitoring-spec.md
  - ../operations/sla-targets.md
changelog:
  - 2.0 | {{date}} | Full expansion — 5 test types, criteria, budgets
  - 1.0 | {{date}} | Initial stub
---

# Performance Test Plan — {{service_name}}

> **Context budget**: ~300 dòng. Load khi viết performance tests.

> **Mục đích**: Xác minh hệ thống đáp ứng NFRs về throughput, latency, stability trước khi go-live.
> **Cross-reference**: NFR targets → [`SRS.md §2.1`](../docs/SRS/SRS.md) | Scale strategy → [`scale-strategy.md`](scale-strategy.md)

---

## 1. Performance Targets

### 1.1 NFR Reference

| NFR ID       | Metric                      | Target               | Priority |
| ------------ | --------------------------- | -------------------- | -------- |
| NFR-PERF-001 | API latency P95             | ≤ {{500}}ms          | Must     |
| NFR-PERF-002 | API latency P99             | ≤ {{1000}}ms         | Must     |
| NFR-PERF-003 | Throughput (sustained)      | ≥ {{target_tps}} TPS | Must     |
| NFR-PERF-004 | Concurrent users            | ≥ {{10000}}          | Must     |
| NFR-PERF-005 | Error rate under load       | < 1%                 | Must     |
| NFR-PERF-006 | CPU under sustained load    | < 80%                | Should   |
| NFR-PERF-007 | Memory under sustained load | < 85%                | Should   |
| NFR-PERF-008 | Connection pool exhaustion  | 0 occurrences        | Must     |

### 1.2 Per-Endpoint Performance Budget

> Mỗi endpoint có latency budget riêng — service không đạt target → investigate trước khi deploy.

| Endpoint                    | Method       | Target P95  | Target P99  | Target RPS | Category    |
| --------------------------- | ------------ | ----------- | ----------- | ---------- | ----------- |
| `/api/v1/{{resource}}`      | GET (list)   | ≤ {{100}}ms | ≤ {{200}}ms | {{5000}}   | Read-heavy  |
| `/api/v1/{{resource}}/{id}` | GET (single) | ≤ {{50}}ms  | ≤ {{100}}ms | {{10000}}  | Cached read |
| `/api/v1/{{resource}}`      | POST         | ≤ {{200}}ms | ≤ {{500}}ms | {{2000}}   | Write       |
| `/api/v1/{{resource}}/{id}` | PUT          | ≤ {{200}}ms | ≤ {{500}}ms | {{1000}}   | Write       |
| `/api/v1/{{resource}}/{id}` | DELETE       | ≤ {{100}}ms | ≤ {{200}}ms | {{500}}    | Write       |
| `/api/v1/auth/login`        | POST         | ≤ {{300}}ms | ≤ {{500}}ms | {{1000}}   | Auth        |

---

## 2. Test Types

### 2.1 Load Test — "Can we handle expected traffic?"

| Aspect        | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| Purpose       | Verify system meets NFR targets under expected production load |
| Virtual Users | {{target_concurrent_users}}                                    |
| Duration      | 30 minutes sustained                                           |
| Ramp-up       | 0 → target over 5 minutes                                      |
| Pass criteria | All P95/P99 targets met, error rate < 1%                       |

```
VUs ▲
     │          ┌──────────────────────────────┐
     │         /│        Sustained Load         │\
     │        / │     (30 min at target VUs)     │ \
     │       /  │                                │  \
     │      /   │                                │   \
     │     /    │                                │    \
     └────/─────┴────────────────────────────────┴─────\──▶ Time
     0   5min                                   35min  40min
         Ramp Up           Sustained             Ramp Down
```

### 2.2 Stress Test — "Where do we break?"

| Aspect        | Value                                                           |
| ------------- | --------------------------------------------------------------- |
| Purpose       | Find breaking point — max throughput before degradation         |
| Virtual Users | Increase in steps: 100% → 150% → 200% → 250% of target          |
| Duration      | 10 minutes per step                                             |
| Pass criteria | System degrades gracefully (no crashes, proper error responses) |

```
VUs ▲
     │                              ┌──────┐
     │                    ┌─────────┤ 250% │
     │          ┌─────────┤  200%   │      │
     │┌─────────┤  150%   │         │      │
     ││  100%   │         │         │      │
     └┴─────────┴─────────┴─────────┴──────┴──▶ Time
      10min     20min     30min     40min
```

**Key observations to record**:

- At what VU count does P95 exceed target?
- At what VU count do errors begin (> 0.1%)?
- At what VU count does the system become unresponsive?
- Does auto-scaling trigger? How fast?

### 2.3 Spike Test — "Can we handle sudden traffic bursts?"

| Aspect        | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Purpose       | Verify system handles sudden traffic spikes (flash sale, viral event) |
| Virtual Users | Baseline → 500% of target (instant) → Baseline                        |
| Duration      | 2 min baseline → 3 min spike → 5 min recovery                         |
| Pass criteria | System recovers to normal within 2 minutes after spike                |

```
VUs ▲
     │     ┌───────────┐
     │     │   500%    │
     │     │   SPIKE   │
     │     │           │
     │─────┤           ├──────────────
     │     │           │  Recovery
     │ Base│           │  (< 2 min)
     └─────┴───────────┴──────────────▶ Time
       2min    3min        5min
```

**Key observations to record**:

- Response time during spike (acceptable degradation?)
- Error rate during spike
- Recovery time to P95 < target after spike ends
- Auto-scaling response time
- Circuit breaker activation?

### 2.4 Soak Test — "Can we sustain over time?"

| Aspect        | Value                                                                           |
| ------------- | ------------------------------------------------------------------------------- |
| Purpose       | Detect memory leaks, connection pool exhaustion, resource degradation over time |
| Virtual Users | 80% of target load (comfortable level)                                          |
| Duration      | 2-4 hours (minimum), 8-12 hours (recommended)                                   |
| Pass criteria | No degradation trend in latency/memory/connections over duration                |

```
VUs ▲
     │    ┌────────────────────────────────────────────┐
     │    │             80% Load, Sustained             │
     │    │          (2-12 hours continuous)             │
     └────┴────────────────────────────────────────────┴──▶ Time
```

**Key observations to record**:

- Memory trend: flat (✅) vs increasing (❌ leak)
- GC pause trend: stable (✅) vs worsening (❌)
- Connection pool active count: stable (✅) vs growing (❌ leak)
- Thread count trend: stable (✅) vs growing (❌)
- Response time trend: flat (✅) vs creeping up (❌)

### 2.5 Breakpoint Test — "What is our absolute maximum?"

| Aspect        | Value                                                  |
| ------------- | ------------------------------------------------------ |
| Purpose       | Determine maximum system capacity — documented ceiling |
| Virtual Users | Continuously increase until system fails               |
| Step          | +{{500}} VUs every 2 minutes                           |
| Pass criteria | Documented breakpoint with metrics                     |

**Result template**:

| Metric                | Value at Breakpoint                                                   |
| --------------------- | --------------------------------------------------------------------- |
| Virtual Users         | {{N}}                                                                 |
| Requests/sec          | {{N}} RPS                                                             |
| P95 Latency           | {{N}}ms                                                               |
| Error Rate            | {{N}}%                                                                |
| CPU Usage             | {{N}}%                                                                |
| Memory Usage          | {{N}}%                                                                |
| Active DB Connections | {{N}} / {{max}}                                                       |
| Bottleneck            | {{CPU / Memory / DB connections / Thread pool / External dependency}} |

---

## 3. Test Environment

| Aspect         | Requirement                                             |
| -------------- | ------------------------------------------------------- |
| Environment    | Staging (production-mirrored)                           |
| Data volume    | Production-like (≥ 80% of production data size)         |
| Infrastructure | Same instance types as production                       |
| Dependencies   | Real services (not mocks) for accurate results          |
| Monitoring     | Full observability stack active (metrics, logs, traces) |
| Isolation      | No other traffic during test                            |

### Environment Checklist

- [ ] Database seeded with production-like data volume
- [ ] All services deployed with production configuration
- [ ] Connection pools sized same as production
- [ ] Auto-scaling policies active (if testing scale behavior)
- [ ] Monitoring dashboards open and recording
- [ ] External dependencies available and not rate-limited

---

## 4. Assertions / Pass-Fail Criteria

### Global Assertions (Apply to all test types)

```
# Latency
http_req_duration{p(95)} < {{target_p95_ms}}ms
http_req_duration{p(99)} < {{target_p99_ms}}ms

# Error rate
http_req_failed < 1%

# Throughput
http_reqs > {{target_rps}} per second (sustained)
```

### Per-Test-Type Assertions

| Test Type   | Additional Criteria                             |
| ----------- | ----------------------------------------------- |
| Load Test   | All global assertions PASS for full duration    |
| Stress Test | Graceful degradation (HTTP 429/503, no crashes) |
| Spike Test  | Recovery to normal within 2 min after spike     |
| Soak Test   | No metric degradation trend over duration       |
| Breakpoint  | Documented capacity ceiling                     |

---

## 5. Bottleneck Investigation Guide

> When tests fail, investigate in this order:

```
1. Check error responses
   → 429 Too Many Requests: Rate limiter → increase limits or scale
   → 503 Service Unavailable: Circuit breaker open → fix downstream
   → 500 Internal Error: Application bug → logs + traces

2. Check infrastructure metrics
   → CPU > 80%: Scale horizontally (add pods) or optimize code
   → Memory > 85%: Memory leak? Check GC, heap dump
   → DB connections exhausted: Increase pool or add PgBouncer

3. Check database
   → Slow queries (pg_stat_statements): Add indexes, optimize queries
   → Lock contention: Reduce transaction scope
   → Connection wait time > 1s: Pool exhaustion → scale

4. Check cache
   → Cache hit ratio < 80%: Review cache strategy, increase TTL
   → Redis latency > 10ms: Network issue or Redis overloaded

5. Check event bus
   → Kafka consumer lag growing: Add consumers or increase partitions
   → Producer latency > 100ms: Kafka cluster overloaded
```

---

## 6. Test Report Template

### Performance Test Report — {{YYYY-MM-DD}}

| Property     | Value                                         |
| ------------ | --------------------------------------------- |
| Service      | {{service_name}}                              |
| Environment  | {{staging / pre-prod}}                        |
| Test Type    | {{Load / Stress / Spike / Soak / Breakpoint}} |
| Duration     | {{N}} minutes                                 |
| Target VUs   | {{N}}                                         |
| Conducted by | {{name}}                                      |

### Results Summary

| Metric      | Target    | Actual  | Status    |
| ----------- | --------- | ------- | --------- |
| P95 Latency | ≤ {{N}}ms | {{N}}ms | {{✅/❌}} |
| P99 Latency | ≤ {{N}}ms | {{N}}ms | {{✅/❌}} |
| Max RPS     | ≥ {{N}}   | {{N}}   | {{✅/❌}} |
| Error Rate  | < 1%      | {{N}}%  | {{✅/❌}} |
| CPU Peak    | < 80%     | {{N}}%  | {{✅/❌}} |
| Memory Peak | < 85%     | {{N}}%  | {{✅/❌}} |

### Verdict: {{PASS / FAIL / CONDITIONAL PASS}}

### Observations & Actions

| #   | Observation | Severity         | Action     |
| --- | ----------- | ---------------- | ---------- |
| 1   | {{finding}} | {{High/Med/Low}} | {{action}} |

### Trend (vs previous test)

| Metric  | Previous | Current | Trend     |
| ------- | -------- | ------- | --------- |
| P95     | {{N}}ms  | {{N}}ms | {{↑/↓/→}} |
| Max RPS | {{N}}    | {{N}}   | {{↑/↓/→}} |
