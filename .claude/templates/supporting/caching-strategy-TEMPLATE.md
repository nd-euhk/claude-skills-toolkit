---
title: "Caching Strategy: {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - architecture.md
  - scale-strategy.md
referenced_by:
  - tech-design/*.md
changelog:
  - 2.0 | {{date}} | Refactor lean — bỏ compile-ready Java, giữ decision + inventory
  - 1.0 | {{date}} | Initial caching strategy
---

<!--
HARD RULES (xem SPEC-BOUNDARIES.md):

  1. File này mô tả PATTERNS + POLICY cache toàn hệ thống. KHÔNG cài đặt.
     @Service, @CacheEvict, Redis config class, stampede lock code — source code.
  2. Snippet ≤10 dòng chỉ khi minh hoạ decision (ví dụ: config YAML shape
     cho cluster), gắn nhãn "illustrative".
  3. TTL cụ thể cho từng cache key: xem cache inventory (§3) — là bảng,
     không phải code.
-->

# Caching Strategy — {{project_name}}

> **Context budget**: ~180 dòng. Load khi cần quyết định caching cho feature.

> Mục tiêu: Giảm DB load, đạt P99 < {{target_p99}}ms cho read-heavy endpoint.
> Default distributed cache: Redis (Cluster mode cho production).

---

## 1. Cache Architecture

```
Client ──▶ CDN/Edge (L0) ──▶ App Local Cache (L1 Caffeine) ──▶ Redis (L2) ──▶ PostgreSQL
```

| Layer | Tech | Scope | Latency | Use case |
|---|---|---|---|---|
| L0 — CDN/Edge | CloudFront / Cloudflare | Global | ~5ms | Static asset, SSG page |
| L1 — Local | Caffeine | Per-pod | ~0.1ms | Hot data, small dataset |
| L2 — Distributed | Redis Cluster | Cross-pod | ~1–3ms | Shared state, session, large dataset |
| L3 — DB query cache | PostgreSQL | Per-DB | ~5–50ms | Complex query result |

---

## 2. Cache Patterns

| Pattern | Read flow | Write flow | Khi dùng | Trade-off |
|---|---|---|---|---|
| **Cache-Aside** (default) | App → cache; miss → DB → populate | DB write → evict cache | Hầu hết read-heavy entity | Cold start chậm |
| **Write-Through** | Cache luôn hit (trừ evict/expiry) | DB + cache cùng lúc | Data đọc ngay sau write (profile, config) | Write chậm, risk inconsistent nếu cache fail |
| **Write-Behind (async)** | Cache hit | Cache → DB qua batch async | High-frequency writes (counter, view count) | Risk mất data nếu cache crash trước flush |
| **Read-Through L1+L2** | L1 → L2 → DB | Evict L1 + L2 | Ultra-low latency + shared state | Phức tạp về invalidation |

> Cài đặt (annotation, service class, manager bean) thuộc source code. File này chỉ chốt pattern.

---

## 3. Cache Inventory

> Agent PHẢI check bảng này trước khi thêm cache key mới. Thêm row vào đây khi introduce cache pattern mới.

| Key pattern | Data | Pattern | TTL | L1 | L2 | Eviction trigger |
|---|---|---|---|---|---|---|
| `{{entity}}:{id}` | Single entity | Cache-Aside | {{5}}min | ✅ | ✅ | UPDATE/DELETE entity |
| `{{entity}}:list:{filter_hash}` | List result | Cache-Aside | {{2}}min | ❌ | ✅ | Bất kỳ CREATE/UPDATE/DELETE |
| `{{entity}}:count:{filter_hash}` | Count | Cache-Aside | {{1}}min | ❌ | ✅ | CREATE/DELETE |
| `config:{key}` | System config | Write-Through | {{30}}min | ✅ | ✅ | Admin update |
| `user:{id}:session` | User session | Write-Through | {{60}}min | ❌ | ✅ | Logout / refresh |
| `rate:{user_id}:{endpoint}` | Rate limit counter | Write-Behind | {{1}}min | ❌ | ✅ | Auto-expire |

**Key naming convention**: `{domain}:{identifier}[:{qualifier}]`. Không dùng space, colon là separator chính thức.

---

## 4. Invalidation Strategies

| Strategy | Khi dùng | Rule |
|---|---|---|
| **Direct eviction** | Cùng service quản lý cache + data | Trên write path, evict key liên quan ngay sau commit DB |
| **Event-driven** (Kafka) | Cross-service invalidation | Service owner emit domain event; subscriber evict key. **KHÔNG** gọi REST để invalidate |
| **TTL expiry** | Data ít thay đổi / không critical | Chấp nhận stale trong TTL window. **KHÔNG** dùng cho financial / auth / inventory |
| **Stampede protection** | Hot key với traffic cao | Distributed lock (setNX) hoặc stale-while-revalidate |

### Eviction timing rule

- Viết DB **trước**, evict cache **sau** (nếu dùng Cache-Aside) để tránh race: đọc-giữa-khoảng-delete-và-set.
- Transaction: evict **sau commit** (transaction synchronization) — không evict giữa transaction.

---

## 5. Stampede Prevention

**Vấn đề**: cache hết hạn → N request cùng miss → N query DB đồng thời.

**Phương án**:
| Option | Cơ chế | Khi dùng |
|---|---|---|
| Distributed lock (setNX) | Chỉ 1 thread load từ DB, thread khác chờ/retry | Hot key single value |
| Stale-while-revalidate | Trả stale value + trigger refresh async | Hot key tolerate stale vài giây |
| Probabilistic early recomputation | Recompute trước khi hết hạn với xác suất tăng dần | Periodic job tải nền |

Source code cài đặt chi tiết — file này chỉ chốt **khi nào dùng cái nào**.

---

## 6. Redis Cluster Configuration (shape)

Mỗi service dùng Redis qua config chuẩn — các setting bắt buộc:

| Setting | Value |
|---|---|
| Mode | Cluster (production), Standalone (local dev) |
| Nodes | ≥ 3 master + 3 replica |
| Lettuce pool (per node) | `max-active: 32`, `max-idle: 16`, `min-idle: 8`, `max-wait: 2000ms` |
| Topology refresh | Adaptive, period 30s |
| Command timeout | 2000ms |
| Eviction policy | `allkeys-lfu` (default) |

**Memory sizing**: `required ≈ (num_keys × avg_value_size × 1.5) + (num_keys × key_size × 1.2)`. Allocate ≥ 1.5× required cho headroom.

> YAML config đầy đủ nằm trong source code (`application.yml` / secret manager).

---

## 7. Monitoring

| Metric | Target | Warning | Critical |
|---|---|---|---|
| Cache hit ratio | > 90% | < 80% | < 60% |
| Cache latency P95 | < 5ms | > 10ms | > 50ms |
| Memory usage | < 70% maxmemory | > 80% | > 90% |
| Eviction rate | < 100/min | > 500/min | > 2000/min |
| Connected clients | < 80% max | > 85% | > 95% |

Metric source: Spring Boot Actuator + Micrometer (`cache.gets`, `cache.puts`, `cache.evictions`, `cache.size`) + Redis INFO. Dashboard detail: `operations/monitoring-spec.md`.

---

## 8. Anti-patterns

| Anti-pattern | Vấn đề | Thay bằng |
|---|---|---|
| Cache everything | Memory bloat, eviction pressure | Pareto: chỉ cache hot 20% |
| No TTL | Stale forever | Luôn set TTL kể cả 24h |
| Cache mutable object | Race condition khi mutate cached | Cache immutable DTO/record |
| Cache `null` không TTL | Negative cache không refresh | Short TTL (30s) hoặc không cache `null` |
| Delete-then-set | Race: read giữa delete và set → miss | Chỉ evict, để next read populate |
| Cache JPA entity trực tiếp | LazyInit, serialization issue | Cache DTO/record |
| Cùng TTL cho mọi key | Hot key expire đồng loạt → stampede | Jitter: `TTL ± random(0, TTL×0.1)` |
| Cross-service invalidation qua REST | Coupling, fail khi peer down | Event-driven (§4) |
