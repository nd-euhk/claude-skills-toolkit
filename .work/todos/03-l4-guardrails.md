# L4 — Guardrails: Cải Thiện

**Ngày tạo:** 2026-07-08
**Độ ưu tiên:** Medium
**Trạng thái:** pending

## Mục Tiêu

Nâng cấp guardrails từ "rất tốt" (4/5) lên "xuất sắc" (5/5) qua 4 cải tiến.

## Todo

### 1. Token Budget & Cost Enforcement

**Vấn đề:** Không có giới hạn token usage hoặc cost. Một agent runaway có thể tiêu tốn không giới hạn tokens.

**Giải pháp:**
- Thêm token budget per phase (configurable trong foundation files):
  - SRS: max 200K tokens
  - HLD: max 150K tokens
  - LLD (per service): max 100K tokens
  - IMP (per feature): max 80K tokens
  - TST (per feature): max 80K tokens
  - TDD per-TC: max 50K tokens
- Orchestrator enforce budget — nếu agent vượt quá → dừng, báo cáo human
- Tích hợp vào preflight check: kiểm tra budget config trong `conventions.md`

**Tham khảo:** Harness.io Autonomous Workers — cost tracking per pipeline step

---

### 2. Agent Timeout & Stuck Detection

**Vấn đề:** Không có timeout cho long-running agents. Một agent bị stuck (loop, retry vô hạn) không được phát hiện.

**Giải pháp:**
- Thêm timeout per agent type:
  - Specs agents: 600s (10 phút)
  - TDD agents: 300s (5 phút)
  - Codebase agents: 900s (15 phút, do phải scan nhiều file)
- Orchestrator monitor: nếu agent không produce output trong N giây → flag stuck, hỏi human
- Tích hợp stuck detection pattern: "nếu agent lặp lại cùng 1 action > 3 lần → escalate"

**Tham khảo:** harness-rs — DAG với retry/backoff/replanning

---

### 3. Approval Routing

**Vấn đề:** Hiện tại human-in-the-loop là generic — bất kỳ human nào cũng approve mọi phase. Không phân biệt ai nên review gì.

**Giải pháp:**
- Định nghĩa approval roles trong `conventions.md`:
  - Product Owner → approve SRS
  - Architect → approve HLD
  - Tech Lead → approve LLD, IMP
  - QA Lead → approve TST
  - Developer → approve TDD implementation
- Orchestrator gợi ý role khi request approval
- Optional: nếu chỉ có 1 người (solo dev), tự động skip role check

**Tham khảo:** aharness — FSM với typed submissions và approval routing

---

### 4. Rollback Mechanism khi Gate Fail

**Vấn đề:** Khi gate fail, pipeline dừng nhưng không có cơ chế rollback tự động. Changes từ agent vẫn nằm trong working tree.

**Giải pháp:**
- Trước mỗi agent spawn: tự động tạo git checkpoint (lightweight tag)
- Khi gate fail: orchestrator hỏi human "rollback changes của agent này?"
- Nếu human đồng ý → `git reset --hard` về checkpoint trước đó
- Checkpoint naming: `_checkpoint/<FR-ID>/<phase>-<timestamp>`
- Integration vào orchestrator's spawn template

**Tham khảo:** harness-rs — DAG replanning on failure
