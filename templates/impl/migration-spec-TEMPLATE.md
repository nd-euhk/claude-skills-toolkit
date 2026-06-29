---
title: "Migration Spec: V{{NNN}}__{{description}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - ../tech-design/{{service}}-service.md
referenced_by:
  - ../backend/{{service}}/implementation/FR-{{DOMAIN}}-{{NNN}}--{{slug}}-impl.md
  - ../../changes/CR.md
changelog:
  - 1.0 | {{date}} | Initial migration spec
---

# Migration Spec: V{{NNN}}\_\_{{description}}

> **Context budget**: ~270 dòng. Load khi viết DB migration.
>
> **SOURCE OF TRUTH cho schema change**: full `CREATE TABLE / ALTER / INDEX`
> SQL chỉ nằm ở file này. Tech-design reference schema qua bảng field/constraint;
> impl-spec reference qua `Schema impact: See migration spec: ...`. Xem
> `SPEC-BOUNDARIES.md §2 R-3`.

> **Service**: {{service_name}}
> **FR Reference**: FR-{{DOMAIN}}-{{NNN}} (nếu có)
> **Reviewer**: {{DBA / Tech Lead}}

---

## 1. Overview

| Aspect                   | Value                                                          |
| ------------------------ | -------------------------------------------------------------- |
| Migration type           | {{CREATE TABLE / ALTER TABLE / CREATE INDEX / DATA MIGRATION}} |
| Backward compatible      | {{Yes / No}}                                                   |
| Requires downtime        | {{No / Yes — estimated: N min}}                                |
| Data backfill needed     | {{No / Yes — estimated rows: N}}                               |
| Estimated execution time | {{< 1s / N seconds / N minutes}}                               |
| Lock type                | {{ACCESS EXCLUSIVE / SHARE / NONE}} → See §4                   |
| Affected table(s)        | {{table_name}} (~{{N}} rows currently)                         |
| Rollback strategy        | {{Automatic / Manual SQL / Not possible — expand-contract}}    |

---

## 2. Forward Migration

```sql
-- V{{NNN}}__{{description}}.sql
-- Service: {{service_name}}
-- Author: {{author}}
-- Date: {{YYYY-MM-DD}}

-- TODO: Replace with actual migration SQL
```

### Examples by Type

#### CREATE TABLE

```sql
CREATE TABLE {{table_name}} (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    -- columns
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- constraints
    CONSTRAINT chk_{{constraint}} CHECK ({{condition}})
);

-- Indexes (use CONCURRENTLY for production — see §5)
CREATE INDEX idx_{{table}}_{{column}} ON {{table_name}} ({{column}});
```

#### ALTER TABLE (Add Column — zero-downtime)

```sql
-- Step 1: Add nullable column (no lock, instant)
ALTER TABLE {{table_name}} ADD COLUMN {{new_column}} {{type}};

-- Step 2: Backfill (separate migration — see §6)
-- Step 3: Add NOT NULL constraint (after backfill complete)
-- ALTER TABLE {{table_name}} ALTER COLUMN {{new_column}} SET NOT NULL;
```

#### ALTER TABLE (Rename Column — expand-contract)

```sql
-- Phase 1 (Expand): Add new column, keep old
ALTER TABLE {{table_name}} ADD COLUMN {{new_name}} {{type}};
-- Application writes to BOTH old and new columns

-- Phase 2 (Migrate): Backfill existing data
UPDATE {{table_name}} SET {{new_name}} = {{old_name}} WHERE {{new_name}} IS NULL;

-- Phase 3 (Contract — SEPARATE MIGRATION after code deploys):
-- ALTER TABLE {{table_name}} DROP COLUMN {{old_name}};
```

---

## 3. Rollback Migration

```sql
-- R{{NNN}}__undo_{{description}}.sql
-- ⚠️ Test rollback BEFORE applying forward migration to production

-- TODO: Replace with actual rollback SQL
```

### Rollback Verification Checklist

- [ ] Rollback SQL tested on staging with production-like data
- [ ] Application works correctly after rollback (backward compatible)
- [ ] No data loss from rollback (or data loss is acceptable + documented)
- [ ] Rollback execution time estimated: {{N seconds/minutes}}

---

## 4. Lock Analysis

> **Why this matters**: Long locks block ALL queries on the table → service downtime.

| Operation                                      | Lock Type          | Duration                      | Impact                    |
| ---------------------------------------------- | ------------------ | ----------------------------- | ------------------------- |
| `CREATE TABLE`                                 | None               | Instant                       | ✅ Safe                   |
| `ALTER TABLE ADD COLUMN` (nullable)            | `ACCESS EXCLUSIVE` | **Instant** (PG 11+)          | ✅ Safe                   |
| `ALTER TABLE ADD COLUMN` (with DEFAULT)        | `ACCESS EXCLUSIVE` | **Instant** (PG 11+)          | ✅ Safe                   |
| `ALTER TABLE ADD COLUMN NOT NULL` (no default) | `ACCESS EXCLUSIVE` | Full table scan ⚠️            | ❌ Requires downtime      |
| `ALTER TABLE DROP COLUMN`                      | `ACCESS EXCLUSIVE` | Instant                       | ✅ Safe (marks invisible) |
| `ALTER TABLE ALTER TYPE`                       | `ACCESS EXCLUSIVE` | Full table rewrite ⚠️         | ❌ Requires downtime      |
| `CREATE INDEX`                                 | `SHARE`            | Proportional to table size ⚠️ | ❌ Blocks writes          |
| `CREATE INDEX CONCURRENTLY`                    | None               | 2-3x longer than above        | ✅ Safe                   |
| `DROP INDEX`                                   | `ACCESS EXCLUSIVE` | Instant                       | ✅ Safe                   |
| `DROP INDEX CONCURRENTLY`                      | None               | Near-instant                  | ✅ Safe                   |

### Lock Duration Estimate

```
Table size: {{N}} rows
Estimated lock duration: {{N}} seconds
Acceptable? {{Yes / No — need zero-downtime approach}}
```

---

## 5. Index Strategy

### New Indexes

```sql
-- ✅ ALWAYS use CONCURRENTLY in production (no write lock)
-- ⚠️ Cannot run inside a transaction block
-- ⚠️ If build fails, drops invalid index: DROP INDEX CONCURRENTLY IF EXISTS idx_xxx;

CREATE INDEX CONCURRENTLY idx_{{table}}_{{column}}
    ON {{table_name}} ({{column}});

-- Partial index (only index relevant rows — saves space + faster)
CREATE INDEX CONCURRENTLY idx_{{table}}_{{column}}_active
    ON {{table_name}} ({{column}})
    WHERE status = 'ACTIVE';

-- Composite index (follow left-prefix rule)
CREATE INDEX CONCURRENTLY idx_{{table}}_{{col1}}_{{col2}}
    ON {{table_name}} ({{col1}}, {{col2}});
```

### Index Decisions

| Column(s)      | Index Type       | Reason                   | Expected Queries              |
| -------------- | ---------------- | ------------------------ | ----------------------------- |
| {{column}}     | B-tree           | Equality + range queries | `WHERE {{column}} = ?`        |
| {{column}}     | GIN              | Full-text search / JSONB | `WHERE {{column}} @> ?`       |
| {{col1, col2}} | Composite B-tree | Multi-column filter      | `WHERE col1 = ? AND col2 = ?` |

---

## 6. Large Dataset Migration (Backfill)

> Khi cần update/backfill > 100K rows, KHÔNG dùng single UPDATE — sẽ lock bảng quá lâu.

### Batch Processing Rules

- Chạy dưới dạng **application job** (hoặc psql script riêng), **KHÔNG** đóng gói trong Flyway migration — Flyway migration phải nhanh, idempotent, reversible.
- Batch size: 500–2000 rows/batch. Tune theo `work_mem` + đo trên staging.
- Dùng `FOR UPDATE SKIP LOCKED` để không block concurrent writer.
- Progress logging mỗi batch; `pg_sleep(0.05–0.2s)` giữa các batch để giảm load.
- Idempotent: query `WHERE {{new_column}} IS NULL` để có thể resume sau crash.
- Monitor: replication lag, connection count, I/O; pause nếu lag vượt ngưỡng.

### Dual-Write Strategy (critical migration)

| Phase | Code behavior | DB operation | Ship separately? |
|---|---|---|---|
| 1 — Expand | Code writes **both** old + new column | `ALTER TABLE ADD COLUMN` (nullable) | ✅ Ship trước |
| 2 — Backfill | Không đổi | Backfill job (batch rules ở trên) | Chạy sau khi Phase 1 ổn định |
| 3 — Verify | Không đổi | `SELECT COUNT(*) WHERE {{new_column}} IS NULL` → 0 | — |
| 4 — Switch | Code reads **new** column only | Không đổi | ✅ Ship riêng |
| 5 — Contract | Code chỉ dùng new column | `DROP COLUMN {{old_name}}` | ✅ Ship riêng (sprint sau) |

> Full SQL của backfill job KHÔNG nằm trong file migration spec này — thuộc application/ops script.

---

## 7. Migration Testing

### Pre-Production Checklist

- [ ] Migration tested on empty database (fresh schema)
- [ ] Migration tested on staging with production-like data volume
- [ ] Flyway checksum unchanged from development → staging → production
- [ ] Execution time measured on staging: {{N}} seconds
- [ ] Lock duration measured: {{N}} seconds (acceptable?)
- [ ] Rollback tested: forward → rollback → forward = same result
- [ ] Application starts successfully after migration
- [ ] All existing tests pass after migration
- [ ] No orphaned data or constraint violations

### Data Volume Estimate

| Table     | Current Rows | Growth Rate | 6-Month Projection |
| --------- | ------------ | ----------- | ------------------ |
| {{table}} | {{N}}        | {{N/day}}   | {{N}}              |

---

## 8. Zero-Downtime Migration Patterns

### Pattern: Expand-Contract (Column Rename/Type Change)

```
Sprint N:   [EXPAND]   Add new column, code writes both
Sprint N+1: [MIGRATE]  Backfill data, verify
Sprint N+2: [CONTRACT] Drop old column, code reads new only
```

### Pattern: Shadow Table (Major restructure)

```
Sprint N:   Create new table structure
Sprint N+1: Dual-write (old + new table)
Sprint N+2: Backfill historical data
Sprint N+3: Switch reads to new table
Sprint N+4: Drop old table
```

### Decision Matrix

| Change Type         | Pattern                         | Sprints | Risk   |
| ------------------- | ------------------------------- | ------- | ------ |
| Add nullable column | Direct migration                | 1       | Low    |
| Add NOT NULL column | Expand → Default → Set NOT NULL | 1-2     | Low    |
| Rename column       | Expand-Contract                 | 3       | Medium |
| Change column type  | Expand-Contract                 | 3       | Medium |
| Split table         | Shadow Table                    | 4-5     | High   |
| Merge tables        | Shadow Table                    | 4-5     | High   |
| Drop table          | Deprecate → Remove              | 2       | Low    |
