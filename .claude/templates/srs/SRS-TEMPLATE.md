---
title: "SRS — {{project_name}}"
status: draft
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
updated_by: {{author}}
depends_on:
  - ../business/BRD.md
  - ../business/business-rules/
  - ../product/PRD.md
  - ../user/URD.md
  - ../ux/UX-UI-SPEC.md
referenced_by:
  # ── Phase 5 initial (agent write-srs fill ngay khi sinh SRS) ─────
  - ./SRS-BACKEND.md                              # Backend SRS chi tiết (khi Master variant)
  - ./SRS-FRONTEND.md                             # Frontend SRS chi tiết (khi Master variant)
  - ./features/README.md                          # FR index Phase 5
  - ../../agent_docs/traceability/requirements-matrix.md
  # ── Phase 6 HLD uncomment khi complete ─────
  # - ../../agent_docs/architecture.md
  # - ../../agent_docs/event-schema.md
  # - ../architecture/ADR-001-service-topology.md
  # - ../architecture/ADR-002-api-convention.md
  # - ../architecture/ADR-003-event-taxonomy.md
  # ── Phase 7 LLD uncomment khi complete ─────
  # - ../../agent_docs/features/FR-*.md           # Agent work package
  # - ../../agent_docs/tech-design/*.md
  # - ../../agent_docs/contracts/api-*.yaml
  # - ../../agent_docs/contracts/error-codes.md
changelog:
  - 2.0 | YYYY-MM-DD | Refactor Phase 5 pure: referenced_by phân tầng Phase 5/6/7; Phase sau uncomment khi complete
  - 1.1 | YYYY-MM-DD | Added references to Backend/Frontend SRS
  - 1.0 | YYYY-MM-DD | Initial SRS
---

# Software Requirements Specification — {{project_name}}

> **Đây là SRS Master** — chứa overview toàn hệ thống.
> Đối với hệ thống lớn, phức tạp, có nhiều team Backend và Frontend:
>
> | Tài liệu | Mục đích | Audience |
> |----------|---------|---------|
> | **SRS.md** (file này) | Overview — FR index + NFR tổng hợp + Traceability | PO, BA, Architect, All teams |
> | **[SRS-LITE.md](SRS-LITE-TEMPLATE.md)** | All-in-one SRS cho Team nhỏ (3-5 devs) | Fullstack Devs, AI agents (Fullstack) |
> | **[SRS-BACKEND.md](SRS-BACKEND-TEMPLATE.md)** | Chi tiết backend: services, APIs, data, events, security, performance | Backend Lead, Backend Devs, AI agents (backend) |
> | **[SRS-FRONTEND.md](SRS-FRONTEND-TEMPLATE.md)** | Chi tiết frontend: pages, UX, state, accessibility, SEO, Web Vitals | Frontend Lead, Frontend Devs, AI agents (frontend) |
>
> **Quy tắc**: SRS Master giữ ngắn gọn (index level). Mọi chi tiết kỹ thuật nằm trong Backend/Frontend SRS.

## 1. Functional Requirements

> Mỗi FR = 1 file riêng trong `docs/product/features/{project-name}/FR-{DOMAIN}-{NNN}--{slug}.md` (Phase 5 artifact — enrich từ PRD draft).
> Section này là index + summary cấp Master.
> **Phase 7** sinh thêm work package ở `agent_docs/features/FR-*.md` — KHÔNG liệt kê ở Phase 5.

| FR ID | Feature | Domain | Epic | Priority | Layer |
|-------|---------|--------|------|----------|-------|
| FR-XXX-001 | {{description}} | {{domain}} | {{epic-slug}} | Must | {{backend\|frontend\|full-stack}} |

## 2. Non-Functional Requirements

### 2.1 Performance

#### Backend

> → **Phase 6 sẽ sinh**: `agent_docs/performance-test.md` (test types + assertions), `agent_docs/scale-strategy.md` (scaling patterns). Phase 5 chỉ spec target numbers.

| NFR ID | Metric | Target | Measurement | Priority |
|--------|--------|--------|-------------|----------|
| NFR-PERF-001 | API latency P95 | ≤ 500ms | Load test (sustained 30 min) | Must |
| NFR-PERF-002 | API latency P99 | ≤ 1000ms | Load test (sustained 30 min) | Must |
| NFR-PERF-003 | Throughput (sustained) | ≥ {{target_tps}} TPS | Load test | Must |
| NFR-PERF-004 | Concurrent users | ≥ 10,000 | Stress test | Must |
| NFR-PERF-005 | Error rate under load | < 1% | Load test | Must |
| NFR-PERF-006 | Spike recovery time | ≤ 2 min | Spike test (5x traffic) | Should |
| NFR-PERF-007 | Soak test stability | No degradation trend | Soak test (≥ 2h at 80% load) | Should |

#### Frontend (Web Vitals)

> → **Phase 6/7 sẽ sinh**: `agent_docs/frontend-architecture.md` (§9 CWV implementation patterns). Phase 5 chỉ spec target numbers.

| NFR ID | Metric | Target | Measurement | Priority |
|--------|--------|--------|-------------|----------|
| NFR-PERF-010 | LCP (Largest Contentful Paint) | ≤ 2.5s | RUM / Lighthouse | Must |
| NFR-PERF-011 | INP (Interaction to Next Paint) | ≤ 200ms | RUM / Lighthouse | Must |
| NFR-PERF-012 | CLS (Cumulative Layout Shift) | ≤ 0.1 | RUM / Lighthouse | Must |
| NFR-PERF-013 | TTFB (Time to First Byte) | ≤ 800ms | RUM | Should |
| NFR-PERF-014 | JS bundle size (initial) | ≤ 200KB gzipped | `next build` | Should |
| NFR-PERF-015 | Lighthouse Performance score | ≥ 90 | Lighthouse CI | Must |


### 2.2 Availability
| NFR ID | Metric | Target |
|--------|--------|--------|
| NFR-AVAIL-001 | Uptime | 99.5% monthly |

### 2.3 Security

> → Chi tiết: [`docs/SECURITY/security-architecture.md`](../SECURITY/security-architecture.md)

| NFR ID | Requirement | OWASP Ref | Priority |
|--------|------------ |-----------|----------|
| NFR-SEC-001 | All endpoints require authentication (except explicit public whitelist) | A01 | Must |
| NFR-SEC-002 | Passwords hashed with strong cryptographic algorithm (adaptive, cost/work factor ≥ 12) | A02, A07 | Must |
| NFR-SEC-003 | JWT access token expiry ≤ 15 min; refresh token ≤ 7 days | A07 | Must |
| NFR-SEC-004 | API rate limiting: 100 req/min per user, 20 req/min per anonymous IP | A05 | Must |
| NFR-SEC-005 | Secrets from Vault/AWS Secrets Manager — no .env in staging/production | A05 | Must |
| NFR-SEC-006 | TLS 1.3 for all external communications; TLS 1.2+ for internal | A02 | Must |
| NFR-SEC-007 | Database encryption at rest (TDE or volume-level) | A02 | Should |
| NFR-SEC-008 | Audit logging for all state-changing operations (`@Audited`) | A09 | Must |
| NFR-SEC-009 | CORS: explicit allowed origins only — no wildcard in production | A05 | Must |
| NFR-SEC-010 | CSP, HSTS, X-Frame-Options, X-Content-Type-Options on all frontend pages | A05 | Must |
| NFR-SEC-011 | PII data masking in logs — never log passwords, tokens, full emails | A09 | Must |
| NFR-SEC-012 | Session timeout ≤ 30 min idle (via JWT + refresh token rotation) | A07 | Should |
| NFR-SEC-013 | Account lockout after 5 failed login attempts → 15 min lock | A07 | Must |
| NFR-SEC-014 | Dependency vulnerability scan: 0 critical/high CVEs in CI/CD | A06 | Must |
| NFR-SEC-015 | GDPR right to delete: user data erasure within 30 days of request | — | Should |

### 2.4 Scalability

> → **Phase 6 sẽ sinh**: `agent_docs/scale-strategy.md` (scale playbook). Phase 5 chỉ spec scalability requirement.

| NFR ID | Requirement | Target | Priority |
|--------|------------|--------|----------|
| NFR-SCALE-001 | Horizontal scaling with auto-scaling | Auto-scale within 60s of threshold breach | Must |
| NFR-SCALE-002 | Stateless services | All services deployable with ≥ 2 replicas | Must |
| NFR-SCALE-003 | Database connection pooling | Pooling for > 100 concurrent connections | Must |
| NFR-SCALE-004 | Async processing (event-driven) | Event-driven architecture, ≥ 100K msg/sec throughput | Should |
| NFR-SCALE-005 | Caching layer | Distributed caching, cache hit ratio > 90% | Must |
| NFR-SCALE-006 | CDN for frontend assets | Cache hit ratio > 95% | Should |

## 3. Interface Requirements

| IR ID | External System | Protocol | Direction |
|-------|----------------|----------|-----------|
| | | REST/gRPC/Webhook | Inbound/Outbound |

## 4. Constraints
- 

## 5. Traceability Matrix

| FR/NFR | PRD Feature | BRD Objective |
|--------|-------------|---------------|
| FR-XXX-001 | FR-001 | BO-001 |
