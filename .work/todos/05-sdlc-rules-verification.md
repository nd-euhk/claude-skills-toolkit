# SDLC Rules — Kiểm Chứng Trước Khi Simplify SKILL.md

**Ngày tạo:** 2026-07-20
**Ngày cập nhật:** 2026-07-20
**Độ ưu tiên:** High
**Trạng thái:** 0/4 done (Rules đã tạo ✅, cần kiểm chứng)

## Mục Tiêu

Kiểm chứng 5 rule files trong `.claude/rules/` hoạt động đúng trước khi cắt
duplication khỏi `orchestrator/SKILL.md`, `automation/SKILL.md`, `quick/SKILL.md`.

## Nguyên Tắc Phân Tách

| Tầng | Chứa gì | Ai load |
|------|---------|---------|
| **Rules** (`.claude/rules/`) | Nguyên tắc cross-cutting: routing logic, pipeline phases, entry gate protocol, escalation chains, orchestration protocol | Auto-load khi session start |
| **SKILL.md** | Entry-point-specific: procedure thực thi, AskUserQuestion templates, grilling rounds, dispatch args | Load khi skill trigger |

## Rules Đã Tạo

| # | File | Mục đích | Dòng |
|---|------|----------|------|
| 1 | `sdlc-routing.md` | Intent → flow → entry point. Priority rules. Resolution procedure | ~50 |
| 2 | `sdlc-pipeline.md` | Phase sequencing forward + reverse + TDD cycle + gate protocol | ~75 |
| 3 | `sdlc-entry-gate.md` | Git check + foundation gate (phân biệt với skill `sdlc-preflight`) | ~60 |
| 4 | `sdlc-escalation.md` | Escalation chains: quick→automation→orchestrator. Trigger tables. Fail-safe principles | ~55 |
| 5 | `sdlc-orchestration.md` | Agent spawning, context isolation, parallel safety table, status protocol | ~55 |

## Cần Kiểm Chứng

### 1. Rules có tự động được load vào context không?

- [ ] Start session mới, kiểm tra xem Claude có nhận biết nội dung rules không
- [ ] Hỏi Claude: "route task 'sửa lỗi đăng nhập' trong SDLC" — Claude có resolve được flow=fixbug không?
- [ ] Hỏi Claude: "preflight cần kiểm tra gì?" — Claude có đọc từ `sdlc-entry-gate.md` không?
- [ ] Xác nhận rules không conflict với SKILL.md hiện tại (rules là principles, SKILL.md là procedures)

### 2. Rules có cover đủ logic hiện tại không?

- [ ] **Routing:** 5 flow (task/cr/fixbug/cook/reverse) + 3 entry point (orchestrator/automation/quick) + priority rules
- [ ] **Pipeline:** Forward đủ 6 phase + CROSS-CUTTING, Reverse đủ 10 phase, TDD cycle đủ các bước
- [ ] **Entry gate:** Git check 4 options, foundation requirements per flow, flow verification
- [ ] **Escalation:** quick→orchestrator (5 triggers), automation→orchestrator (5 triggers), orchestrator terminal
- [ ] **Orchestration:** Agent spawning rules, context isolation, parallel safety, workflow dispatch, status protocol

### 3. Sau khi có rules, SKILL.md cắt gì?

- [ ] **orchestrator:** Bỏ flow detection keyword hints (~42 dòng), bỏ git check template (~20 dòng), bỏ foundation gate requirements (~25 dòng), chỉ giữ reference 1-2 dòng tới rules
- [ ] **automation:** Bỏ toàn bộ Bước 2 flow detection (~23 dòng), bỏ Bước 3 foundation gate (~17 dòng), chỉ giữ automation-specific notes
- [ ] **quick:** Bỏ git check template (~20 dòng), giữ Trivial Gate + Triage Grill (quick-specific)
- [ ] Tổng tiết kiệm: ~150 dòng duplicate

### 4. Có edge case nào rules không cover?

- [ ] Multiple intents overlap (vd: "sửa bug + thêm field mới") — rules có priority rule #1 (safety first)
- [ ] Human explicitly requests specific entry point — rules có priority rule #4 (explicit overrides inference)
- [ ] Foundation missing + human declines preflight — rules cover "stop if unresolved"
- [ ] Agent crash mid-pipeline — escalation rules cover "crash = escalate"
- [ ] CROSS-CUTTING scope detection — pipeline rules cover "auto-detected from architecture"

## Impact Sau Khi Cắt

| File | Trước | Sau | Tiết kiệm |
|------|-------|-----|-----------|
| orchestrator/SKILL.md | 325 dòng | ~195 dòng | ~130 dòng |
| automation/SKILL.md | 345 dòng | ~280 dòng | ~65 dòng |
| quick/SKILL.md | 342 dòng | ~322 dòng | ~20 dòng |
| **Tổng SKILL.md** | **1,012** | **~797** | **~215 dòng** |
| **+ Rules (mới)** | 0 | ~295 dòng | (net +~80 dòng nhưng DRY) |

## Notes

- Giữ nguyên tắc: rules dạy Claude CÁCH nghĩ, SKILL.md bảo Claude LÀM gì
- Không hardcode skill/agent name trong rules — chỉ dùng capability description
- Nếu kiểm chứng phát hiện rules thiếu → bổ sung rules, không quay lại pattern cũ
- Sau khi kiểm chứng OK → cập nhật 3 SKILL.md + bump versions + CHANGELOG
