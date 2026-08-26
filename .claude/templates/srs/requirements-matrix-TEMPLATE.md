---
title: "Requirements Traceability Matrix — {{project_name}}"
version: "2.0"
status: current
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
updated_by: "{{author}}"

depends_on:
  - ../features/README.md          # FR index
  - ../ownership/ownership-map.yaml # Owner resolution (H-36)
  # - ../../docs/product/SRS.md    # Source SRS (nếu có)

referenced_by:
  # - ../../docs/product/release-criteria.md
  # - ../features/*                 # FR files

changelog:
  - 2.0 | YYYY-MM-DD | H-36 — add git artifact columns (branch, PR, merge_commit, changed_paths, owner, merged_at)
  - 1.0 | YYYY-MM-DD | Initial matrix
---

# Requirements Traceability Matrix

Single source of truth (SSOT) để trace **ngược** mỗi FR về PRD feature và BRD objective, đồng thời **forward** tới impl spec + test spec + git artifacts (branch, PR, commit).

> **Canonical location**: `agent_docs/traceability/requirements-matrix.md`
> **Verify script**: `scripts/check-traceability.sh` (chạy trong CI) — populate Git Artifacts table từ `gh pr list` + `git log`
> **Update trigger**: khi thêm/sửa/xoá FR; khi release criteria thay đổi; sau mỗi PR merge
> **v2.0 (H-36)**: Thêm Git Artifacts table để trace code ↔ commit ↔ PR ↔ FR chain

## Functional Requirements — Spec Layer

| FR-ID        | FR Title              | PRD Feature (Phase 2)  | BRD Objective (Phase 1) | Layer | Impl Spec                | Test Spec                | Status         |
| ------------ | --------------------- | ---------------------- | ----------------------- | ----- | ------------------------ | ------------------------ | -------------- |
| FR-AUTH-001  | Register user         | F-AUTH-01 Login flow   | OBJ-1 User acquisition  | BE+FE | [impl](../backend/user-service/implementation/FR-AUTH-001--register-impl.md) | [test](../backend/user-service/test-specs/FR-AUTH-001--register-test.md) | ✅ GREEN        |
| FR-AUTH-002  | Login user            | F-AUTH-01 Login flow   | OBJ-1 User acquisition  | BE+FE | —                        | —                        | 🟡 IN_PROGRESS |
| FR-AUTH-003  | Reset password        | F-AUTH-02 Account mgmt | OBJ-2 Retention         | BE    | —                        | —                        | ⬜ PLANNED     |

## Git Artifacts — Implementation Layer (H-36)

Auto-populated bởi `scripts/check-traceability.sh --populate`. 1 row per FR đã merge. Reviewer trace: 1 commit → FR + impl + test + owner trong < 1 phút.

| FR-ID        | Branch                      | PR                                           | Merge Commit | Owner             | Merged At         | Changed Paths                                                                   |
| ------------ | --------------------------- | -------------------------------------------- | ------------ | ----------------- | ----------------- | ------------------------------------------------------------------------------- |
| FR-AUTH-001  | `agent/FR-AUTH-001`         | [#123](https://github.com/org/repo/pull/123) | `abc123de`   | @team-backend     | 2026-04-15 10:32  | `projects/auth-service/src/main/**` (12), `agent_docs/backend/auth-service/**` (2) |
| FR-AUTH-002  | `agent/FR-AUTH-002`         | (not merged yet)                             | —            | @team-backend     | —                 | —                                                                               |
| FR-AUTH-003  | —                           | —                                            | —            | @team-backend     | —                 | —                                                                               |

## Non-Functional Requirements

| NFR-ID        | Category     | Constraint                   | Verified Where?                          | Owner     |
| ------------- | ------------ | ---------------------------- | ---------------------------------------- | --------- |
| NFR-PERF-001  | Performance  | P95 < 200ms per API call     | `agent_docs/performance/nfr-mapping.md`  | Tech Lead |
| NFR-SEC-001   | Security     | OWASP Top 10 compliance      | `agent_docs/hard-boundaries.md`          | Security  |
| NFR-AVAIL-001 | Availability | 99.5% uptime                 | `agent_docs/operations/sla-targets.md`   | SRE       |

## Legend

### Spec Layer

| Field               | Meaning                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| **FR-ID**           | Functional Requirement ID — pattern `FR-{DOMAIN}-{NNN}` (`{DOMAIN}` = one uppercase token, no hyphen; compound area → qualifier vào slug: `FR-PAYMENT-001--billing`) |
| **PRD Feature**     | Epic feature từ Phase 2 PRD (format `F-{AREA}-{NN} {title}`)            |
| **BRD Objective**   | Business objective từ Phase 1 BRD (format `OBJ-{N} {title}`)            |
| **Layer**           | `BE` / `FE` / `BE+FE` — lấy từ FR frontmatter                           |
| **Impl Spec**       | Link tới implementation spec (Phase 8)                                  |
| **Test Spec**       | Link tới test spec (Phase 9)                                            |
| **Status**          | ⬜ PLANNED / 🟡 IN_PROGRESS / ✅ GREEN / 🔴 RED / ⚠️ BLOCKED             |

### Git Artifacts Layer (H-36)

| Field               | Meaning                                                                            | Source                               |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| **Branch**          | Branch name theo convention `agent/FR-{DOMAIN}-{NNN}` (or `.fe` suffix cho dual-lane) | `git branch`                         |
| **PR**              | Pull Request URL + number                                                          | `gh pr list --search "FR-XXX"`       |
| **Merge Commit**    | Short SHA của merge commit                                                         | `git log --merges --grep "FR-XXX"`   |
| **Owner**           | Module owner từ ownership-map.yaml (derived FR's backend_service/frontend_pages)   | `ownership-map.yaml` lookup         |
| **Merged At**       | Timestamp khi PR merge (UTC)                                                       | `gh pr view {#} --json mergedAt`     |
| **Changed Paths**   | Summary paths changed (glob + count)                                               | `git diff {commit}^..{commit} --stat` |

## Update Rules

1. **Spec Layer — bắt buộc update khi**:
   - Thêm FR mới (Phase 5 SRS) — thêm row vào cả 2 tables
   - Sửa FR (thay đổi PRD/BRD link, layer, status) — update Spec Layer row
   - Production incident phát hiện missing scenario — update test spec link + status

2. **Git Artifacts Layer — auto-populated**:
   - `./scripts/check-traceability.sh --populate` chạy sau mỗi merge → refresh Git Artifacts table
   - Yêu cầu: `gh` CLI authenticated + git log có commits với `FR-ID:` footer (H-35)
   - Weekly cron: `0 2 * * 1 ./scripts/check-traceability.sh --populate` (chạy Monday 02:00 UTC)

3. **Update frequency**: sau mỗi PR merge (auto) — hoặc manual khi muốn refresh.

4. **Verify**:
   - `./scripts/check-traceability.sh` chạy trong CI — flag FR missing impl/test spec + Git Artifacts chain broken
   - `./scripts/trace-fr.sh <merge-commit-sha>` → output full chain cho 1 commit
   - Thủ công: đọc matrix cross-check với `agent_docs/features/FR-*.md`

## Anti-Patterns

- ❌ **Không update matrix khi thêm FR** → traceability gãy → release criteria không verify được
- ❌ **Status conflict** (FR GREEN trong matrix nhưng RED trong `status.json`) → investigate CI
- ❌ **Link impl/test spec không resolve** → `check-traceability.sh` báo missing file
- ❌ **BRD Objective orphan** (FR không link tới OBJ nào) → either FR thừa hoặc BRD chưa cover
- ❌ **Multiple FR cùng PRD feature + layer** → check xem có dedup hoặc split không
- ❌ **NFR không có "Verified Where?"** → non-testable NFR → sửa lại thành measurable
- ❌ **Git Artifacts table stale** (FR GREEN nhưng Branch column trống) → chạy `check-traceability.sh --populate`
- ❌ **Commit không có FR-ID footer** (H-35) → `trace-fr.sh` không resolve được → agent phải sửa commit message convention

## Example Filled Row

```markdown
| FR-PRED-001  | Submit prediction | F-PRED-01 Core game | OBJ-3 Engagement | BE | [impl](../backend/prediction-service/implementation/FR-PRED-001--submit-prediction-impl.md) | [test](../backend/prediction-service/test-specs/FR-PRED-001--submit-prediction-test.md) | ✅ GREEN |
```

→ Reader click "impl" link → tới file spec cụ thể. Status ✅ = merged PR, test xanh.
