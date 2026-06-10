# Operational Impact Review — Workflow & Checklist

Tài liệu tham khảo cho operational impact review dimension. Dùng bởi main agent để hiểu scope và bởi subagent `review-mr-ops` khi thực thi.

## Workflow Overview

### 1. Classify Change Profile
Phân loại: Database, Code, Configuration, Dependency, Infrastructure, Mixed.

### 2. Database Migration Assessment
Schema change analysis, migration safety (locking, data migration, reversibility), data integrity.

### 3. Performance Impact
Query analysis (missing indexes, N+1, unbounded queries), memory & CPU, external calls (timeout, circuit breaker, cache).

### 4. Deployment Risk
Multi-service coordination, feature flags, downtime risk, environment parity.

### 5. Rollback Complexity
Rollback feasibility, state & data compatibility after rollback, monitoring & verification.

## Checklist

### Database Migration
- [ ] **New table**: Indexed đúng columns? Column types phù hợp? FK defined?
- [ ] **New column**: Có default value? NOT NULL không default → deployment fail
- [ ] **Column rename/remove**: Old column còn reference trong code? (grep repo)
- [ ] **Column type change**: Compatible với existing data? (VARCHAR(100)→VARCHAR(50) = truncation risk)
- [ ] **New constraint**: Existing data satisfy? UNIQUE có duplicates?
- [ ] **Locking risk**: ALTER TABLE trên large table?
- [ ] **Data migration**: Backfill bao nhiêu data? Timeout risk?
- [ ] **Reversibility**: Có down/rollback migration?
- [ ] **Data loss**: DELETE/DROP data → backup/verification?
- [ ] **Cascading**: CASCADE delete/update có unintended consequences?

### Performance

#### Query Analysis
- [ ] **Missing indexes**: New WHERE/JOIN/ORDER BY columns có index?
- [ ] **N+1 queries**: Loop bên ngoài + query bên trong?
- [ ] **Unbounded queries**: SELECT không LIMIT trên large table?
- [ ] **ORM lazy loading**: Accidentally triggered trong loop?
- [ ] **Migrations include indexes**: New columns có kèm index?

#### Memory & CPU
- [ ] Large data loading: toàn bộ table/collection vào RAM?
- [ ] Streaming vs buffering: file upload/download?
- [ ] Recursion depth: stack overflow risk?
- [ ] String/regex: repeated compilation trong hot path?
- [ ] Connection pool: new data source có pool config?

#### External Calls
- [ ] New HTTP/API calls trong critical path?
- [ ] Timeout configured?
- [ ] Circuit breaker?
- [ ] Serial vs parallel: multiple independent calls sequential?
- [ ] Cache strategy: frequently read + rarely changed → should cache?
- [ ] Retry: idempotent operations only?

### Deployment Risk
- [ ] **Multi-service coordination**: Deploy order required?
- [ ] **Client/server compatibility**: Old client + new server? New client + old server?
- [ ] **Feature flag**: New feature behind flag? Independent toggle?
- [ ] **Flag default**: Safe if config fails to load?
- [ ] **Zero-downtime**: Có thể deploy không downtime?
- [ ] **Background jobs**: Cần drain trước deploy?
- [ ] **WebSocket/SSE**: Active connections bị drop?
- [ ] **Session/cache**: Survive deploy?
- [ ] **Env vars**: New vars set trong tất cả environments?
- [ ] **Resource differences**: Dev (100 rows) vs Prod (100M rows)?

### Rollback
- [ ] **Feasible**: Có thể rollback không?
- [ ] **DB rollback**: Down-migration tested?
- [ ] **Data compatibility**: Old code đọc được new data?
- [ ] **Config drift**: Config consistent sau rollback?
- [ ] **Cache invalidation**: Cần clear cache sau rollback?
- [ ] **Health indicators**: Metrics/logs để verify deploy success?
- [ ] **Smoke test path**: Critical path để verify?
- [ ] **Alerting**: Existing alerts cover new behavior?

## Verdict Decision Tree
```
Có data loss risk từ migration? → BLOCKER
Migration không reversible, không rollback plan? → BLOCKER
Performance degradation gây production issue (N+1, unbounded query)? → BLOCKER
Multi-service deploy với breaking contract, không compatibility plan? → BLOCKER
Missing env vars trong production config? → BLOCKER
Rollback impossible sau data migration? → BLOCKER
Migration locking trên large table, không warning? → HIGH_RISK
New external call không timeout/circuit breaker? → HIGH_RISK
Deploy không zero-downtime, không feature flag trên critical path? → HIGH_RISK
Missing index trên new query → CAUTION
Monitoring/smoke test chưa đầy đủ → CAUTION
Không có vấn đề gì → LOW_RISK
```
