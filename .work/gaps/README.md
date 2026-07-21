# SDLC Gap Tracking

Ngày phát hiện: 2026-07-21 | Audit toàn bộ hệ sinh thái SDLC (5 rules, 8 skills, 35 agents, 9 workflows, 6 scripts)

## Gap Inventory

| # | Gap | Severity | Effort | Status |
|---|-----|----------|--------|--------|
| [1](gap-01-sdlc-gate-agent.md) | Thiếu `sdlc-gate` forward pipeline agent | CRITICAL | L | 🟢 done |
| [2](gap-02-automation-fixbug.md) | Automation thiếu fixbug flow (undocumented exclusion) | MEDIUM | S | 🟢 done |
| [3](gap-03-validation-codebase-gate.md) | Validation script thiếu `codebase-gate` case | LOW | XS | 🟢 done |
| [4](gap-04-pipeline-rules-naming.md) | Pipeline rules cross-cutting names không nhất quán | LOW | XS | 🟢 done |
| [5](gap-05-automation-task-flow.md) | Automation thiếu `task-flow.md` ref file | LOW | S-M | 🟢 done |

## Quy ước

- Mỗi gap được track trong file riêng với format: phân tích, impact, fix plan, checklist
- Đánh dấu status: `open` → `in-progress` → `done` / `wontfix`
- Xử lý theo priority: CRITICAL → MEDIUM → LOW
- Mỗi gap có checklist các bước cần làm
- Link đến các file liên quan trong repo
