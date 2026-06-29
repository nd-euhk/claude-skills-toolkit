---
title: "CR-{NNN}: {Short Description}"
type: NEW | CHANGE
status: draft | approved | implementing | done
created: YYYY-MM-DD
requested_by: {name/role}
approved_by:
target_sprint: Sprint {N}
depends_on: []
referenced_by: []
changelog:
  - draft | YYYY-MM-DD | Created
---

# CR-{NNN}: {Short Description}

## 1. Change Type

- [ ] **NEW** — Nghiệp vụ hoàn toàn mới (thêm feature)
- [ ] **CHANGE** — Thay đổi nghiệp vụ đã có (sửa feature/rule hiện tại)

## 2. Change Description

| Aspect | Before | After |
|--------|--------|-------|
| {what changes} | {old value/behavior} | {new value/behavior} |

## 3. Business Reason

{Tại sao thay đổi này cần thiết — 2-3 câu}

## 4. Blast Radius

> Chạy `./scripts/blast-radius.sh {target-file}` để tìm tự động.

### Tài liệu bị ảnh hưởng

| # | File | Thay đổi | Đã update? |
|---|------|---------|----------|
| 1 | `docs/business/business-rules/{rule}.md` | Sửa rule gốc | ☐ |
| 2 | `agent_docs/features/FR-{DOM}-{NNN}--{slug}.md` | Sửa Gherkin, Process | ☐ |
| 3 | `agent_docs/tech-design/{service}-service.md` | Sửa domain model/constant | ☐ |
| 4 | `agent_docs/contracts/api-{domain}.yaml` | Sửa / Không đổi | ☐ |
| 5 | `agent_docs/backend/{svc}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md` | Sửa logic steps | ☐ |
| 6 | `agent_docs/backend/{svc}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md` | Sửa expected values | ☐ |
| 7 | `agent_docs/service-feature-matrix.md` | Sửa / Không đổi | ☐ |
| 8 | `agent_docs/frontend/{app}/api-routing.md` | Sửa / Không đổi | ☐ |

### Code bị ảnh hưởng

| # | File | Thay đổi | Đã update? |
|---|------|---------|----------|
| 1 | `projects/{svc}/src/.../Service.java` | {mô tả} | ☐ |
| 2 | `projects/{svc}/src/.../ServiceTest.java` | Sửa assertions | ☐ |

### Data bị ảnh hưởng

| Aspect | Impact | Action |
|--------|--------|--------|
| Existing DB data | {No impact / Need recalculate / Need migrate} | {None / Script} |
| DB schema | {No change / New column / New table} | {None / Migration} |
| Cache | {No impact / Need invalidation} | {None / Clear cache} |

## 5. Implementation Plan

### Cho feature MỚI (NEW):

```
1. ☐ Viết FR spec: agent_docs/features/FR-{DOM}-{NNN}--{slug}.md
2. ☐ Viết impl spec: agent_docs/backend/{svc}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md
3. ☐ Viết test spec: agent_docs/backend/{svc}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md
4. ☐ Update contracts: agent_docs/contracts/api-{domain}.yaml
5. ☐ Update routing: service-feature-matrix.md, api-routing.md
6. ☐ Validate: check-fr-routing.sh, check-traceability.sh
7. ☐ Agent implement (autonomous overnight)
8. ☐ Review + merge
9. ☐ Update roadmap.md
```

### Cho feature THAY ĐỔI (CHANGE):

```
1. ☐ Blast radius: ./scripts/blast-radius.sh {target}
2. ☐ Update ALL blast radius files (top-down order — xem bảng ở §4)
3. ☐ Tạo spec PR: spec({domain}): CR-{NNN} {description}
4. ☐ Review + merge spec PR
5. ☐ Agent implement code changes (TDD: sửa test expected → RED → sửa code → GREEN)
6. ☐ Regression check: ./gradlew test
7. ☐ Tạo code PR: feat({service}): CR-{NNN} {description}
8. ☐ Review + merge code PR
9. ☐ Update roadmap.md
10. ☐ Close CR
```

## 6. Closing Checklist

- [ ] All blast radius files updated (mọi file trong bảng §4 đã checked)
- [ ] Changelog updated trong frontmatter mọi file đã sửa
- [ ] Spec PR merged
- [ ] Code PR merged
- [ ] Full test suite passes: `./gradlew test` exit code 0
- [ ] No regression in other services
- [ ] roadmap.md updated
- [ ] requirements-matrix.md updated (nếu traceability thay đổi)
- [ ] CR status → `done`
- [ ] Stakeholders notified
