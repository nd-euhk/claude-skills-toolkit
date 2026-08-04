---
name: sdlc-quick
description: >-
  SDLC quick — làn nhẹ cho task đơn giản không cần full specs pipeline.
  Triage grill MỘT LẦN, nếu xác nhận trivial thì thực thi trực tiếp qua
  guard test → implement → GATE-light → review → optional push.
  Dùng khi có task nhỏ, sửa nhanh, thay đổi đơn giản: "sửa nhanh",
  "quick fix", "sửa nhỏ", "đơn giản", "nhỏ", "lặt vặt", "minor",
  "trivial", "typo", "config", "hotfix nhẹ", "chỉnh text", "đổi màu",
  "thêm field đơn giản", "sửa validation message". Khác với
  sdlc-orchestrator (full pipeline HITL) và sdlc-automation (autonomous
  full pipeline), skill này BỎ QUA toàn bộ SRS/HLD/LLD/IMP/TST specs
  và REFACTOR-full/GATE-full, chỉ giữ guard test tối thiểu + GATE-light.
  Tự động phát hiện task không trivial → escalation về orchestrator.
version: 1.0.1
allowed-tools: Read, Write, Edit, Bash, Glob, Skill, Agent, AskUserQuestion
---

# SDLC Quick

Điểm vào thứ 3 trong bộ SDLC — chuyên xử lý task **đơn giản** không cần full
specs pipeline. Bạn grill human **1-3 câu triage**, xác nhận tính trivial, rồi
thực thi trực tiếp. Bạn **không** tự viết code — bạn điều phối subagents và skills.

| | sdlc-orchestrator | sdlc-automation | **sdlc-quick** |
|---|---|---|---|
| **Tương tác** | Từng phase (Plan→Review→Spawn) | Một lần upfront (4 rounds) | **Triage grill (2-3 câu)** |
| **Pipeline** | SRS→HLD→LLD→IMP∥TST | Autonomous workflow | **Không specs, chỉ guard test+GATE-light** |
| **TDD cycle** | Full (baseline→RED→GREEN→INTERFERENCE→REFACTOR→GATE 2 lớp) | Full autonomous | **RED→GREEN (1 TC) + GATE-light** |
| **Phù hợp khi** | Cần review từng bước, domain mới | Đã rõ requirements, muốn expedite | **Task ≤1-2 file, không API/schema/security** |

---

## Flow Tổng Quan

```
Trivial Gate (5 criteria)
    │  PASS
    ▼
Triage Grill (2-3 câu xác nhận)
    │
    ├─ Ultra-Trivial ──→ Implement trực tiếp ──→ GATE-light (4 checks) ──→ Review ──→ Push
    │   (typo, config, copy, CSS)
    │
    └─ Logic-Trivial ──→ RED (1 guard test) → GREEN (implement) ──→ GATE-light ──→ Review ──→ Push
        (validation, field, error msg)
```

> **Khác biệt với orchestrator/automation**: Quick flow KHÔNG check foundation files
> (`project-overview.md`, `user-context.md`) vì không chạy SRS/HLD/LLD/IMP/TST —
> không cần project context để sinh specs.

---

## Hard Boundaries

Đây là các quy tắc KHÔNG THỂ NEGOTIATE:

- **Bạn điều phối, không thực thi** — không viết code, chỉ spawn subagents
- **Trivial gate trước khi grill** — 5 criteria tự động kiểm tra. Fail bất kỳ → escalation
- **Triage grill bắt buộc** — không skip grill để "đoán" tính trivial
- **Không tự hạ tiêu chí trivial** — nếu borderline, luôn escalate. An toàn > nhanh
- **Không specs pipeline** — không SRS, HLD, LLD, IMP, TST. Đây là toàn bộ điểm của quick flow
- **Không REFACTOR-full, không GATE-full** — chỉ GATE-light (4 checks)
- **Escalation là default cho borderline** — "có thể trivial" = escalate
- **Không tự sửa sprint files** — luôn qua `Skill(sprint, "--board")`

---

## Preflight (chạy mỗi lần invoke)

### Bước 1: Git State Check

```bash
git branch --show-current && git status --porcelain
```

Nếu dirty → `AskUserQuestion`:

```javascript
AskUserQuestion({
  questions: [{
    question: "Working tree có uncommitted changes. Xử lý thế nào?",
    header: "Git",
    options: [
      { label: "Stash", description: "git stash — lưu tạm changes" },
      { label: "Commit", description: "Commit changes trước khi tiếp tục" },
      { label: "Tiếp tục", description: "Giữ nguyên dirty tree ⚠️ Có thể gây conflict" },
      { label: "Abort", description: "Dừng pipeline" }
    ],
    multiSelect: false
  }]
})
```

Nếu "Abort" → dừng, báo cáo git state. Xem `references/error-handling.md#e11`.

### Bước 2: Trivial Gate (Tự động)

Kiểm tra 5 criteria. **Fail bất kỳ criteria nào → escalation ngay, không grill.**

| # | Criteria | Cách kiểm tra |
|---|---|---|
| G1 | **File count ≤ 2** | Hỏi human hoặc estimate từ context. Nếu không rõ → fail-safe (coi như >2) |
| G2 | **Không API/schema/migration mới** | Có endpoint mới? DB migration? Schema thay đổi? → fail |
| G3 | **Không security/billing/auth/data-integrity** | Đụng đến auth middleware? Billing logic? PII? → fail |
| G4 | **Không service/boundary mới** | Service mới? Module boundary mới? → fail |
| G5 | **Logic bounded & localized** | Thay đổi có thể gây cascading effect? → fail |

> **Nguyên tắc fail-safe**: Nếu không chắc chắn về bất kỳ criteria nào → coi như FAIL và escalate.
> Không bao giờ "đoán" là trivial. Borderline = escalate.
>
> Ví dụ PASS/FAIL cho từng criteria (G1-G5): `references/triage-grill.md#trivial-gate-criteria`

Nếu **PASS tất cả 5 criteria**:
```
🟢 Trivial Gate: PASS (5/5)
   → Chuyển sang triage grill để xác nhận với human.
```

Nếu **FAIL bất kỳ criteria nào**:
```
🔴 Trivial Gate: FAIL — [criteria bị fail + lý do]
   → Task này không phù hợp với quick flow.
   Đề xuất: /sdlc-orchestrator (flow task) hoặc /sdlc-automation.
```

Xem `references/escalation.md` → Trigger 1-5 cho message templates đầy đủ với từng tình huống escalate.

### Bước 3: Triage Grill (1-3 câu)

Đây là **lần duy nhất** bạn tương tác với human. Mục tiêu: xác nhận task thực sự
trivial trước khi thực thi. **Hỏi tuần tự, mỗi lần một câu, đợi trả lời.**

| Round | Nội dung | Mục đích |
|---|---|---|
| 1. Scope Confirm | "Mô tả ngắn gọn thay đổi — file nào, dòng nào, làm gì?" | Xác nhận G1+G5 |
| 2. Safety Check | "Có đụng đến API, schema, auth, billing, hoặc data integrity không?" | Xác nhận G2+G3+G4 |
| 3. Impact (conditional) | Chỉ hỏi nếu round 1-2 có dấu hiệu borderline: "Thay đổi này có thể ảnh hưởng code khác không?" | Confirm G5 |

> **Câu hỏi mẫu, AskUserQuestion templates, và exit criteria:**
> → `references/triage-grill.md` — đầy đủ Round 1-3 templates, decision matrix, path phân loại

> **Exit criteria tối thiểu**: Phải xác nhận được ít nhất file count (≤2) + không API/schema +
> không security impact. Thiếu → escalate. Xem `references/error-handling.md#e21` cho response template.

### Bước 4: Route

Dựa trên kết quả triage grill:

| Kết quả | Hành động |
|---|---|
| **Xác nhận trivial, ultra-nhỏ** (typo, config, copy, CSS, constant) | → **Ultra-Trivial Path** (không guard test) |
| **Xác nhận trivial, có logic** (validation, error msg, utility, field) | → **Logic-Trivial Path** (có guard test) |
| **Borderline / không chắc** | → **Escalation** (đề xuất orchestrator) |
| **Rõ ràng không trivial** | → **Escalation** (bắt buộc) |

---

## Làn Nhẹ Execution

### Path A: Ultra-Trivial (typo, config, copy, CSS, constant)

Cho thay đổi **không có logic** — không cần guard test.

1. **Xác nhận lần cuối**: "Đây là thay đổi [loại: typo/config/copy]. Không cần test. Xác nhận?"
2. **Implement**: Spawn GREEN agent với mô tả trực tiếp:
   ```javascript
   Agent({subagent_type: "sdlc-tdd-be-green", description: "Quick implement [mô tả]",
     permissionMode: "acceptEdits",
     prompt: "[QUICK — Ultra-Trivial] Thay đổi: [mô tả]. Files: [danh sách].
       Implement trực tiếp, không test. Tối thiểu, không thêm gì ngoài mô tả."})
   ```
   Frontend: dùng `sdlc-tdd-fe-green`.
3. **Verify**: Chạy test suite hiện có → không regression
4. Chuyển sang **GATE-light** → **Review** → **Push** → **Sprint**

### Path B: Logic-Trivial (validation, error msg, utility, field, small logic)

Cho thay đổi **có logic nhưng bounded** — guard test bắt buộc.

1. **RED — Viết 1 guard test**: Spawn RED agent:
   ```javascript
   Agent({subagent_type: "sdlc-tdd-be-red", description: "Quick RED: [mô tả test]",
     permissionMode: "acceptEdits",
     prompt: "[QUICK — Logic-Trivial] Viết ĐÚNG 1 test case cho: [mô tả]. Files: [danh sách].
       Test phải fail (RED). Nếu pass sẵn → STALE. Không REFACTOR-light, không INTERFERENCE.
       Return DONE|BLOCKED|STALE."})
   ```
   Frontend: dùng `sdlc-tdd-fe-red`.
2. **Xử lý RED result**:
   | Code | Hành động |
   |---|---|
   | DONE | Test đỏ → proceed GREEN |
   | STALE | Accidental green → skip implement, chuyển GATE-light |
   | BLOCKED | Không viết được test → escalate |
3. **GREEN — Implement**: Chỉ khi RED=DONE. Spawn GREEN agent:
   ```javascript
   Agent({subagent_type: "sdlc-tdd-be-green", description: "Quick GREEN: [mô tả]",
     permissionMode: "acceptEdits",
     prompt: "[QUICK — Logic-Trivial] Implement code tối thiểu để pass test: [mô tả TC].
       Files: [danh sách]. Chỉ đủ pass test, không refactor/thêm abstraction.
       Nếu test đã pass sẵn (STALE) → skip, return ngay."})
   ```
   Frontend: dùng `sdlc-tdd-fe-green`.
4. **Verify GREEN**: Test suite phải pass. Fail → báo cáo, escalate.
5. Chuyển sang **GATE-light** → **Review** → **Push** → **Sprint**

> **RED**: Quick flow rút gọn — 1 TC, không INTERFERENCE, không REFACTOR-light. Return DONE|BLOCKED|STALE.
> **GREEN**: Nhận context trực tiếp từ RED output, không cần IMP specs. Implement tối thiểu.

### GATE-light (4 checks)

Sau khi implement (cả 2 path), chạy GATE-light:

```javascript
// Backend: 1. Test suite pass  2. Hard boundaries  3. Query safety  4. External call resilience
Agent({subagent_type: "sdlc-tdd-be-gate", description: "Quick GATE-light",
  permissionMode: "acceptEdits",
  prompt: "[QUICK — GATE-light] Mode: light. 4 checks. Báo cáo PASS/FAIL + criteria fail."})

// Frontend: 1. Token safety  2. XSS protection  3. State coverage  4. Hard boundaries
Agent({subagent_type: "sdlc-tdd-fe-gate", description: "Quick GATE-light",
  permissionMode: "acceptEdits",
  prompt: "[QUICK — GATE-light] Mode: light. 4 checks. Báo cáo PASS/FAIL."})
```

| Kết quả | Hành động |
|---|---|
| PASS (4/4) | Tiếp tục → Code Review |
| FAIL | **Escalate** — gate fail gợi ý scope lớn hơn trivial. Đề xuất orchestrator. |

### Code Review

```bash
Skill("sdlc-review", "--code")
```

Review findings:
- **Minor (typo/style)** → fix ngay, re-run test suite
- **Bug/security** → escalate (scope có thể không trivial)
- **Cần refactor** → ghi nhận, escalate nếu đáng kể

### Git Push

```bash
Skill("git")
```

Hỏi human trước khi push. Message format: `quick: [mô tả ngắn gọn]`

### Sprint Update

```bash
Skill("sprint", "--board")
```

Cập nhật board status. Non-blocking — nếu fail, báo cáo và tiếp tục.

---

## Báo Cáo Kết Quả

```
🏁 Quick Flow hoàn thành — [mô tả]
   📋 Path: [Ultra-Trivial | Logic-Trivial]
   🧪 Guard Test: [DONE | STALE (accidental green) | SKIPPED (ultra-trivial)]
   ✅ Implement: [mô tả ngắn gọn thay đổi]
   🚦 GATE-light: PASS (4/4)
   👀 Review: [findings hoặc "Không có"]
   📦 Git: [commit hash] ([đã push | chưa push])
   📋 Sprint: [board update hoặc "Không cập nhật được"]
   ⏱️  Tổng thời gian: ~[5-15] phút
```

---

## When NOT to Use Quick

**Bắt buộc escalate** — đề xuất `/sdlc-orchestrator` hoặc `/sdlc-automation` khi:

- **Trivial gate fail** — bất kỳ criteria nào không đạt
- **Không chắc chắn về scope** — "có thể chỉ 1 file nhưng tôi không rõ"
- **Đụng đến API/schema/auth/billing/data-integrity** — kể cả "chỉ thêm 1 field vào response"
- **Thay đổi >2 file** — dù mỗi file chỉ 1 dòng
- **Feature mới** — dù nhỏ đến đâu. "Thêm field" là feature mới → flow cr
- **Human muốn review kỹ** — preference cá nhân
- **Codebase chưa quen** — project mới, kiến trúc lạ

**Ví dụ thực tế:**

| Task | Quick? | Lý do |
|---|---|---|
| "Sửa lỗi chính tả trong error message" | ✅ Path A | typo, 1 file, không logic |
| "Đổi màu nút submit từ xanh sang đỏ" | ✅ Path A | CSS, 1 file, không logic |
| "Thêm validation email không được trống" | ✅ Path B | logic nhỏ, 1 file, có guard test |
| "Thêm field phone vào form đăng ký" | ❌ | API/schema mới → flow cr |
| "Sửa logic tính thuế trong billing" | ❌ | G3: billing → flow cr |
| "Đổi tên function dùng chung (ảnh hưởng 8 file)" | ❌ | G1: >2 files + G5: cascading → flow cr |

Phát hiện tín hiệu trên trong trivial gate hoặc triage grill → dừng:

```
⚠️  Quick flow không được khuyến nghị: [lý do]
   Đề xuất: /sdlc-orchestrator (flow task) hoặc /sdlc-automation.
   Bạn có muốn chuyển không?
```

> **Escalation message templates đầy đủ (5 triggers)**: `references/escalation.md`

---

## Skill & Agent Reference

### Skills (invoke qua Skill tool)

| Skill | Mục đích |
|---|---|
| `sdlc-review` | Review code mới (--code) |
| `sprint` | Cập nhật board sau khi hoàn thành |
| `git` | Commit và push |

### Subagents (spawn qua Agent tool)

| Agent | Dùng cho | Khác biệt so với cook flow |
|---|---|---|
| `sdlc-tdd-be-red` | Viết 1 guard test backend (Path B) | **Rút gọn**: 1 TC, không INTERFERENCE, không REFACTOR-light |
| `sdlc-tdd-be-green` | Implement backend (Path A+B) | **Rút gọn**: nhận context trực tiếp, không cần IMP specs |
| `sdlc-tdd-fe-red` | Viết 1 guard test frontend (Path B) | **Rút gọn**: như backend |
| `sdlc-tdd-fe-green` | Implement frontend (Path A+B) | **Rút gọn**: như backend |
| `sdlc-tdd-be-gate` | GATE-light backend (4 checks) | **Light mode only** |
| `sdlc-tdd-fe-gate` | GATE-light frontend (4 checks) | **Light mode only** |

---

## Reference Index

| File | Nội dung | Khi nào đọc |
|---|---|---|
| `references/triage-grill.md` | Trivial gate criteria chi tiết (G1-G5 với ví dụ), triage grill templates, exit criteria | Trước và trong khi triage grill |
| `references/escalation.md` | Escalation patterns: message templates, handoff sang orchestrator/automation, borderline decision tree | Khi trivial gate fail hoặc grill phát hiện borderline |
| `references/error-handling.md` | Error categories: preflight, grill, subagent crash, gate fail, review escalation | Khi gặp lỗi hoặc review error pattern |
