# GAP-2: Automation Skill Thiếu fixbug Flow

**Severity:** MEDIUM | **Effort:** S | **Status:** done ✅

## Phân Tích

SDLC routing table (`sdlc-routing.md`) và entry gate (`sdlc-entry-gate.md`) đều liệt kê `fixbug` là một first-class flow. Tuy nhiên flow này chỉ available qua orchestrator, không qua automation.

### Flow Coverage Matrix

| Flow | orchestrator | automation | Ghi chú |
|------|-------------|------------|---------|
| task | ✅ `flow-task.md` | ✅ inline + workflow script | |
| cr | ✅ `flow-cr.md` | ✅ `cr-flow.md` | |
| cook | ✅ `flow-cook.md` | ✅ `cook-flow.md` + workflow script | |
| fixbug | ✅ `flow-fixbug.md` | ❌ **Không hỗ trợ** | Chỉ có keyword hint ở dòng 95 |
| reverse | → `sdlc-codebase` skill | N/A | |

### Evidence

`sdlc-automation/SKILL.md:82-92` — Flow detection chỉ offer 4 options:

```javascript
options: [
  { label: "task", ... },
  { label: "cr", ... },
  { label: "cook", ... },
  { label: "Không phù hợp", description: "Chuyển sang sdlc-orchestrator hoặc sdlc-quick" }
]
```

Dòng 95 có keyword hint: `"bug"/"lỗi"/"fix" → gợi ý flow phù hợp trong câu hỏi` — nhưng gợi ý đó không dẫn đến fixbug option vì không có.

## Impact

- Human input chứa "bug"/"lỗi"/"fix" khi dùng automation sẽ không thấy fixbug option
- Phải fallback sang orchestrator — thêm 1 bước chuyển context
- Rules không document rõ rằng fixbug chỉ dành cho orchestrator

## Phân Tích: Có Nên Thêm fixbug vào Automation?

**Lý do KHÔNG nên:**
- Fixbug cần diagnosis sâu (stack trace, log analysis, root cause hypothesis)
- Debugging agents cần human judgment để xác nhận hypothesis
- Scope fix thường không rõ ràng upfront (không giống task/cook — đã có specs)
- Risk of wrong fix cao hơn nếu autonomous

**Lý do NÊN:**
- Bug đơn giản (typo, null check, config) có thể autonomous
- Consistency với routing table

**Khuyến nghị:** Document rõ trong rules rằng fixbug là **orchestrator-only flow** (không automation, không quick). Lý do: cần human diagnosis judgment.

## Fix Plan

### Checklist

- [x] Cập nhật `sdlc-escalation.md` — thêm section "fixbug Flow: Orchestrator-Only" với escalation rules từ quick/automation
- [x] Cập nhật `sdlc-automation/SKILL.md:95` — thay keyword hint bằng explicit escalation instruction: bug/lỗi/fix → tự động escalate sang orchestrator với flow=fixbug
- [x] Cập nhật `sdlc-routing.md` — thêm cột "Available via" vào intent→flow table, fixbug marked "orchestrator only"
- [x] Cập nhật `sdlc-entry-gate.md` — thêm "Orchestrator-only flow" annotation vào fixbug row
- [x] CHANGELOG entry (2.21.1)

## Files Liên Quan

- `.claude/rules/sdlc-routing.md:16` — fixbug flow definition
- `.claude/rules/sdlc-entry-gate.md:39` — fixbug foundation requirements
- `.claude/rules/sdlc-escalation.md` — escalation chains
- `.claude/skills/sdlc-automation/SKILL.md:82-96` — flow detection
- `.claude/skills/sdlc-orchestrator/references/flow-fixbug.md` — fixbug procedure
