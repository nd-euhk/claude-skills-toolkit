# Flow: cr (Change Request)

**Trigger:** Thay đổi yêu cầu đối với feature hiện có.
**Precondition:** Target task phải tồn tại và đã được đánh giá status.

## Bước 1: Xác định Task Bị Ảnh Hưởng

1. Parse human input để xác định task(s) mà CR nhắm đến
2. Đọc `.work/board.md` để tìm task
3. Nếu task KHÔNG tìm thấy trên board → hỏi: "Task không có trên board. Feature request mới?" Nếu yes → route flow task

## Bước 2: Đánh giá Task Status

| Status | Hành động |
|---|---|
| **TODO** | "Task chưa code → đây là cập nhật yêu cầu." Route sang **flow task** |
| **ready** | Giống TODO — chưa có code. Route sang **flow task** |
| **in progress** | CR thực sự — code đang được viết. Tiếp tục Bước 3 |
| **review** | CR thực sự — code tồn tại, đang review. Tiếp tục Bước 3 |
| **done** | CR thực sự — code trong production. Tiếp tục Bước 3 (cẩn trọng) |

## Bước 3: Grilling Interview

Invoke `Skill(grilling)` để làm rõ:
- Thay đổi chính xác những gì? Tại sao?
- Phạm vi thay đổi? (services nào, APIs nào, features nào)
- Có ảnh hưởng architecture không? (cần HLD?)
- Có ảnh hưởng service internals không? (cần LLD?)
- Downstream impacts: features khác, dependent tasks, integrations?
- Mức độ khẩn cấp và rủi ro?

## Bước 4: Impact Analysis

Dựa trên grilling, xác định blast radius. Đây là bước QUAN TRỌNG NHẤT của CR flow.

### 4.1: Đọc Context

1. Đọc `agent_docs/features/README.md` — toàn bộ feature index + dependency graph
2. Đọc `agent_docs/features/FR-*.md` — affected feature specs
3. Đọc `agent_docs/architecture.md` — service topology + ADRs
4. Đọc `agent_docs/hard-boundaries.md` — cross-service constraints
5. Đọc `agent_docs/cross-cutting.md` — shared patterns (nếu có)
6. Đọc IMP specs: `agent_docs/{backend,frontend}/*/implementation/FR-*-impl.md`
7. Đọc TST specs: `agent_docs/{backend,frontend}/*/test-specs/FR-*-test.md`

### 4.2: Xác định Blast Radius

Tạo impact report có cấu trúc:

```markdown
## Impact Report: CR-{NNN}

### CR Summary
- **Yêu cầu:** [tóm tắt thay đổi]
- **Lý do:** [tại sao cần thay đổi]
- **Mức độ khẩn cấp:** [critical | high | medium | low]

### Affected Features
| FR-ID | Title | Mức độ ảnh hưởng | Ghi chú |
|-------|-------|-----------------|--------|
| FR-AUTH-001 | Login | HIGH — thay đổi auth flow | API contract thay đổi |
| FR-AUTH-002 | Registration | MEDIUM — shared validation | Không thay đổi API |

### Affected Services
| Service | Mức độ | Thay đổi cần thiết |
|---------|--------|-------------------|
| auth | HIGH | Thêm OAuth2 provider, update JWT claims |
| gateway | MEDIUM | Route config update, rate limit adjust |
| notification | LOW | Email template update |

### Affected APIs
| API | Thay đổi | Backward Compatible? |
|-----|---------|---------------------|
| POST /auth/login | Thêm field `provider` | ✅ Có (optional field) |
| GET /auth/me | Thêm field `provider_id` | ✅ Có (additive) |

### Phases Cần Chạy Lại
| Phase | Cần chạy? | Lý do |
|-------|----------|-------|
| SRS | ✅ Có | Business requirement thay đổi |
| HLD | ✅ Có | Thêm OAuth2 ADR |
| LLD | ✅ Có | API contract thay đổi |
| IMP | ✅ Có | Execution flow thay đổi |
| TST | ✅ Có | Test cases mới cho OAuth2 |

### Risk Assessment
- **Risk level:** [HIGH | MEDIUM | LOW]
- **Regression risk:** [services/features có thể bị ảnh hưởng]
- **Rollback strategy:** [làm sao để revert nếu CR gây vấn đề]
```

### 4.3: Báo cáo Human

Trình bày impact report cho human. Xác nhận:
- Blast radius chính xác?
- Phase scope hợp lý?
- Risk level chấp nhận được?

## Bước 5: Thực thi Specs Pipeline (Targeted)

Chạy **Specs Pipeline**, nhưng CHỈ cho phase bị ảnh hưởng:
- Architecture thay đổi → chạy HLD (và mọi thứ sau đó)
- API contract thay đổi → chạy LLD (và mọi thứ sau đó)
- Feature behavior thay đổi → chạy SRS (và mọi thứ sau đó)
- Chỉ implementation detail thay đổi → chỉ chạy IMP ∥ TST

**Đừng chạy lại phase không bị ảnh hưởng.** Xác nhận với human trong Plan step.

### Spawn Pattern

Giống flow task Bước 4. Dùng template: `references/procedures.md` → Section 1.1.

### Error Handling

| Tình huống | Hành động |
|---|---|
| Impact analysis phát hiện breaking change | Cảnh báo human: "CR này là BREAKING CHANGE. Cần version bump + migration plan." |
| CR ảnh hưởng code đã cook (done/review) | "Code đã tồn tại cho feature này. Sau khi update specs → cần flow cook để sync code với specs mới." |
| CR gây conflict với task đang in-progress | "Task {X} đang in-progress sẽ bị ảnh hưởng. Đề xuất: hoàn thành task hiện tại trước CR, hoặc merge CR vào task đang làm." |
| Subagent fail giữa pipeline | Xem `references/procedures.md` → Section 5.1. Retry (max 2), skip, hoặc abort. |
| Pipeline abort | Xem `references/procedures.md` → Section 5.5 |

## Bước 6: Rollback Strategy

Sau khi specs được update, xác nhận rollback plan với human:

1. **Specs rollback:** git revert commit của spec changes
2. **Code rollback (nếu đã cook):** git revert + re-run test suite
3. **Database migration rollback (nếu có):** down migration scripts
4. **Ghi nhận:** `agent_docs/README.md` Open Issues — "CR-{NNN} rollback plan: [link hoặc mô tả]"

## Bước 7: Cập nhật Sprint Artifacts

Dùng shared procedure: `references/procedures.md` → Section 3.5 "Sprint Artifact Update".

Đặc biệt với CR flow:
- Board: cập nhật task status nếu CR thay đổi scope
- Backlog: thêm CR note vào affected FR-IDs
- README routing table: cập nhật phase status mới, ghi nhận CR impact

---

## Concrete Example

```
Human: "CR: thêm OAuth2 login vào auth service. Google và GitHub providers."

Orchestrator:
  1. Task → FR-AUTH-001 (Login) status done (code đã production)
  2. Status → done → CR thực sự (cẩn trọng)
  3. Grilling:
     - Thêm OAuth2 flow: Google + GitHub
     - Auth service: thêm provider logic, JWT claims mới
     - Không breaking change (password login vẫn hoạt động)
     - Risk: MEDIUM — thay đổi auth flow
  4. Impact analysis:
     - Affected: FR-AUTH-001 (Login), FR-AUTH-002 (Registration — optional OAuth2 link)
     - Services: auth (HIGH), gateway (LOW)
     - APIs: POST /auth/login (additive), GET /auth/me (additive)
     - Phases cần chạy: SRS → HLD → LLD → IMP∥TST
     - Rollback: revert specs + OAuth2 code; password login không bị ảnh hưởng
  5. Pipeline:
     - SRS → update FR-AUTH-001 thêm OAuth2 scenarios
     - HLD → thêm ADR: OAuth2 Provider Strategy
     - LLD → update auth-service.md (OAuth2 section)
     - IMP∥TST → update implementation + test specs
  6. Rollback plan documented trong README
  7. Sprint: board updated, CR note added
```

---

## CR Flow Summary

```
Bước 1: Xác định Task → Bước 2: Đánh giá Status
                                │
                ┌───────────────┼───────────────┐
                ▼                               ▼
         TODO / ready                    in-progress / review / done
         (route flow task)              (CR thực sự)
                                              │
                                              ▼
                               Bước 3: Grilling Interview
                                              │
                                              ▼
                               Bước 4: Impact Analysis
                               (blast radius + phase scope)
                                              │
                                              ▼
                               Bước 5: Specs Pipeline
                               (chỉ phase bị ảnh hưởng)
                                              │
                                              ▼
                               Bước 6: Rollback Strategy
                                              │
                                              ▼
                               Bước 7: Sprint Update
```
