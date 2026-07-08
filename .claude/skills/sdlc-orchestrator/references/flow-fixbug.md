# Flow: fixbug

**Trigger:** Bug report, error, crash, behavior không mong đợi.
**Precondition:** Incident tồn tại — có thể đã rõ hoặc chưa rõ thông tin bug.

## Entry Decision: Known hay Unknown?

Parse human input để xác định sub-flow:

| Sub-Flow | Signals | Hành động |
|---|---|---|
| **Known Bug** | Root cause + affected services + reproduction steps đã rõ; human cung cấp diagnosis đầy đủ; "đã biết nguyên nhân", "lỗi đã rõ" | Ghi nhận → document → update specs → TDD fix → verify |
| **Unknown Bug** | Chỉ có symptoms/error reports; "chưa rõ", "cần debug", "điều tra"; stack trace không giải thích; "có bug" không chi tiết | Debug → discover → document → update specs → TDD fix → verify |

**Rõ ràng** → thông báo sub-flow, xin xác nhận nhanh.
**Ambiguous** → invoke `Skill(grilling)`: "Đã biết nguyên nhân chưa? Có root cause + affected services + reproduction steps không?"

---

## Sub-Flow A: Known Bug

### Bước 1: Grilling Interview

Invoke `Skill(grilling)` để thu thập thông tin bug có cấu trúc:
- Bug là gì? (title + tóm tắt 1 đoạn)
- Symptoms? (error messages, wrong behavior, performance issues)
- Root cause? (component nào, tại sao)
- Reproduction steps?
- Severity? (P0 critical, P1 high, P2 medium, P3 low)
- Môi trường? (production, staging, dev)
- Có workaround không?
- Proposed fix? (file nào thay đổi, approach gì)

### Bước 2: Document Bug

Tạo bug record: `agent_docs/{backend,frontend}/{service,app}/bugs/BUG-{NNN}--{slug}.md`

Template + cách xác định BUG-NNN: `references/procedures.md` → Section 2.1 "Bug Document".

### Bước 3: Impact Assessment

`references/procedures.md` → Section 3.2 "Impact Assessment".

Xác định:
- Bug ảnh hưởng FR-IDs nào?
- Cần cập nhật IMP spec? (error handling, validation, execution flow)
- Cần cập nhật TST spec? (regression tests, BVA, error scenarios)
- Bug có tiết lộ gap trong higher-level specs không? (SRS/HLD/LLD)

### Bước 4: Update Specifications

`references/procedures.md` → Section 3.3 "Spec Update".

1. **EnterPlanMode** → Plan agent mô tả IMP/TST spec changes
2. Human review → approve
3. Spawn agent(s): `sdlc-imp` và/hoặc `sdlc-tst`
4. **Minor updates** (<~20 dòng, 1 edge case): orchestrator Edit trực tiếp. Lớn hơn → spawn subagent

### Bước 5: TDD Fix Cycle

Đây là bước CỐT LÕI. Orchestrator điều phối TDD subagents để fix bug:

```
Cho mỗi bug:
  RED (sdlc-tdd-be-red hoặc sdlc-tdd-fe-red)
  ├─ Viết regression test (tái hiện bug)
  ├─ Verify RED (test fails — bug confirmed)
  ├─ Accidental green? → sanity→explore→sabotage→verify→revert
  ├─ Spawn GREEN (fix code tối thiểu)
  └─ Spawn REFACTOR-light (cleanup fix area only)
```

**Routing theo service:**
- Backend bug → spawn `sdlc-tdd-be-red`
- Frontend bug → spawn `sdlc-tdd-fe-red`
- Cả hai → tuần tự (backend trước, frontend sau)

**Template spawn:** `references/procedures.md` → Section 1.2 "TDD Fix Cycle — fixbug".

**Sau khi RED return:**
- **DONE** → tiếp tục Bước 6 (Verify)
- **BLOCKED** (3 attempts failed) → dừng, báo cáo human với code map từ Explore agent
- **STALE** (ambiguous spec) → báo cáo human, cần làm rõ bug doc hoặc spec

### Bước 6: Verify Fix

`references/procedures.md` → Section 3.4 "Fix + Verify Pattern".

**Verify sequence:**
1. Spawn `sdlc-tdd-be-gate --mode=light` (4 critical checks):
   - L1: Test Suite — tất cả tests pass (cũ + regression mới)
   - L2: Hard Boundaries — không cross-service DB access
   - L3: Query Safety — không raw SQL concatenation
   - L4: External Call Resilience — timeout + fallback
2. Xác nhận bug doc `status` → `fixed`
3. IMP/TST specs nhất quán với fix
4. Update sprint artifacts nếu bug ảnh hưởng board tasks

**GATE light FAIL:**
- Báo cáo failures cho human
- Spawn developer fix từng failure
- Chạy lại GATE light (max 2 lần)
- Vẫn fail → human quyết định: skip gate, manual verify, hoặc abort

---

## Sub-Flow B: Unknown Bug

### Bước 1: Triage & Debug

1. Invoke `Skill(debugging)` để phân tích:
   - Parse stack traces, error messages, logs
   - Xác định failing component (service, module, function)
   - Đưa ra root cause hypothesis
   - Nếu cần logs hoặc monitoring data → `Skill(sdlc-scout)` để khám phá service/component

2. Invoke `Skill(problem-solving)` để đánh giá:
   - Các possible fixes?
   - Trade-offs (risk, effort, side effects)?
   - Đề xuất approach tốt nhất

### Bước 2: Grilling Interview

Invoke `Skill(grilling)` để lấp gaps mà debugging không trả lời được:
- Bug được phát hiện như thế nào? (user report, monitoring, testing)
- Reproduction steps? (nếu chưa rõ từ logs)
- Severity? (P0 critical, P1 high, P2 medium, P3 low)
- Môi trường? (production, staging, dev)
- Có workaround không?
- Có recent changes liên quan có thể gây ra bug không?

### Bước 3: Document Bug

Tạo bug record (cùng cấu trúc như Known Bug Bước 2). Status bắt đầu là `in-progress`.

### Bước 4: Impact Assessment

`references/procedures.md` → Section 3.2 "Impact Assessment".

### Bước 5: Update Specifications

`references/procedures.md` → Section 3.3 "Spec Update".

### Bước 6: TDD Fix Cycle

Giống hệt Known Bug Bước 5. Dùng template: `references/procedures.md` → Section 1.2.

### Bước 7: Verify Fix

Giống hệt Known Bug Bước 6. Dùng pattern: `references/procedures.md` → Section 3.4.

---

## Concrete Example

### Known Bug Example

```
Human: "Sửa bug BUG-order-001: OrderService timeout khi PaymentService chậm.
        Root cause: không có timeout config cho PaymentClient.
        Proposed fix: thêm 5s timeout + circuit breaker."

Orchestrator:
  1. Grilling → xác nhận severity P1, affected FR-ORDER-003
  2. Document → tạo BUG-order-001--payment-timeout.md
  3. Impact → cần update IMP spec (error handling section) + TST spec (regression test)
  4. Spec update → EnterPlanMode → Plan approved → sdlc-imp + sdlc-tst update
  5. TDD fix:
     - Spawn sdlc-tdd-be-red:
       ├─ Viết regression test: "should timeout after 5s when PaymentService slow"
       ├─ Test FAILS (RED) — PaymentService call hangs không timeout
       ├─ Spawn sdlc-tdd-be-green:
       │   └─ Implement: thêm timeout=5s + CircuitBreaker trong PaymentClient.java
       └─ Spawn sdlc-tdd-be-refactor --mode=light:
           └─ Extract timeout constant, rename config vars
     - RED return DONE
  6. Verify:
     - Spawn sdlc-tdd-be-gate --mode=light
     - L1-L4: ALL PASS
     - Bug doc status → fixed
     - Sprint update: board → done
```

### Unknown Bug Example

```
Human: "Production bị lỗi 500 ở /api/orders, không rõ nguyên nhân"

Orchestrator:
  1. Debugging → parse stack trace: NullPointerException ở OrderService.java:142
     → Hypothesis: order.getCustomer() null khi customer bị xóa
  2. Grilling → xác nhận: P1, production, không workaround,
     recent change: thêm cascade delete customer
  3. Document → tạo BUG-order-002--npe-deleted-customer.md
  4. Impact → FR-ORDER-001 (get order), FR-ORDER-003 (payment)
     → Cần update IMP: thêm null check, error handling
     → Cần update TST: regression test cho deleted customer scenario
  5. Spec update → EnterPlanMode → approved → sdlc-imp + sdlc-tst update
  6. TDD fix cycle (giống Known Bug Bước 5)
  7. Verify (giống Known Bug Bước 6)
```

---

## Error Handling trong Fixbug Flow

| Tình huống | Hành động |
|---|---|
| RED return BLOCKED (3 attempts) | Dừng fix cycle. Báo cáo human với code map. Human kiểm tra thủ công. |
| RED return STALE (ambiguous) | Dừng bug đó. Báo cáo human: bug doc hoặc spec cần làm rõ. |
| GATE light FAIL | Báo cáo failures. Fix từng failure. Chạy lại GATE light (max 2 lần). Vẫn fail → human quyết định. |
| Debugging không tìm ra root cause | Báo cáo human với findings. Option: thêm logging/monitoring, hoặc accept risk. |
| Bug doc không có IMP/TST spec để reference | Cảnh báo: "Không có specs cho feature này. TDD fix sẽ chỉ dựa trên code hiện có. Cân nhắc chạy flow task để tạo specs." |
| Subagent crash / timeout | Báo cáo human. Option: retry (max 2), manual fix, hoặc abort. |

---

## Fixbug Flow Summary

```
                        ┌──────────────────┐
                        │  Sub-Flow A      │
                        │  Known Bug        │
                        │                  │
                        │  1. Grilling     │
                        │  2. Document     │
                        │  3. Impact       │
                        │  4. Spec Update  │
                        │  5. TDD Fix      │
                        │  6. Verify       │
                        └──────────────────┘

Entry Decision ─────────┤
  (Known/Unknown?)      │
                        ┌──────────────────┐
                        │  Sub-Flow B      │
                        │  Unknown Bug     │
                        │                  │
                        │  1. Debug        │
                        │  2. Grilling     │
                        │  3. Document     │
                        │  4. Impact       │
                        │  5. Spec Update  │
                        │  6. TDD Fix      │
                        │  7. Verify       │
                        └──────────────────┘
```

**Khác biệt chính với cook flow:**
- **1 bug = 1 TDD cycle** (không per-TC)
- **Regression test** thay vì feature test
- **Chỉ GATE light** (4 checks) — không REFACTOR full, không GATE full
- **Fix tối thiểu** — không implement feature mới
- **Không code review + git push** — fixbug không tự push (human quyết định)
