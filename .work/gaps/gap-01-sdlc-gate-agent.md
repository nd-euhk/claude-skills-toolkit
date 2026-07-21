# GAP-1: Thiếu `sdlc-gate` Forward Pipeline Agent

**Severity:** CRITICAL | **Effort:** L | **Status:** done ✅

## Phân Tích

Pipeline rules (`sdlc-pipeline.md:67`) quy định:

> "Every phase agent output MUST pass its corresponding gate before the next phase starts. Gate agents are read-only — they verify, never modify."

Hiện tại chỉ có `codebase-gate` agent (phục vụ reverse pipeline). Forward pipeline hoàn toàn thiếu dedicated gate agent.

### So sánh hiện trạng

| Pipeline | Gate Agent | Coverage |
|----------|-----------|----------|
| Reverse | `codebase-gate` ✅ | 7 phases: HLD(6 criteria), LLD(5), LLD-Synthesis(4), SRS(4), SRS-Synthesis(4), IMP(5), TST(5) |
| Forward | ❌ None | Gate criteria tồn tại dưới dạng manual checklist trong `sdlc-orchestrator/references/procedures.md:356-404` |

### Gate Criteria Hiện Có Cho Forward (từ procedures.md)

| Phase | Criteria Count | Key Checks |
|-------|---------------|------------|
| SRS | 4 | Gherkin Given/When/Then, NFR quantified, traceability matrix, no impl details |
| HLD | 7 | C4 container diagram, ADR structure, ADR index, superseded links, bounded context, event taxonomy, no per-service internals |
| LLD | 3 | 9 sections, no new architectural decisions, per-FR work package |
| CROSS-CUTTING | 7 | error-handling (≥8 categories), caching (L0-L3), perf-test (quantified), frontend-arch, frontend-test-strategy, YAML frontmatter, scope=output |
| IMP | 6 | execution flow, business rules mapped, data impact, error mapping, security, LLD references |
| TST | 6 | unit cases, integration cases, E2E scenarios, perf thresholds, fixtures/mocks, IMP references |

## Impact

1. **Không consistency** — reverse pipeline có gate agent structured, forward pipeline verify thủ công
2. **Không retry context** — `codebase-gate` có retry mechanism (3 attempts, previousFailure context). Forward pipeline manual check không có
3. **Không regression detection** — khi retry phase, `codebase-gate` phát hiện criteria previously-passed-now-failing. Forward không có
4. **Orchestrator + Automation phải duplicate gate logic** — mỗi entry point phải tự implement gate check thay vì spawn chung một agent

## Fix Plan

Tạo `sdlc-gate` agent (`.claude/agents/sdlc/sdlc-gate.md`) với cấu trúc đối xứng `codebase-gate`:

### Checklist

- [ ] Tạo `.claude/agents/sdlc/sdlc-gate.md` với:
  - Phase detection: `srs`, `hld`, `lld`, `cross-cutting`, `imp`, `tst`
  - Per-phase criteria (lấy từ procedures.md:356-404, bổ sung cross-cutting criteria)
  - Structured output: `GATE_VERDICT: PASS|FAIL` + detailed report
  - Retry context support (attempt, previousFailure)
  - Regression detection
  - Per-entity breakdown (cho LLD, IMP, TST fan-out)
- [ ] Thêm `sdlc-gate` case vào `sdlc-validate-agent-output.sh`
- [ ] Thêm `sdlc-gate` hook vào `.claude/settings.json` (nếu cần)
- [ ] Cập nhật `sdlc-orchestrator/references/procedures.md` — thay manual gate checklist bằng spawn template cho `sdlc-gate`
- [ ] Cập nhật `sdlc-automation/SKILL.md` + workflow scripts — dùng `sdlc-gate` thay vì manual check
- [ ] Cập nhật `sdlc-pipeline.md` Gate Protocol section — thêm `sdlc-gate` (forward)
- [ ] Version bumps: `sdlc-gate` 1.0.0, orchestrator + automation + pipeline rule
- [ ] CHANGELOG entry

### Agent Design (đối xứng với codebase-gate)

```yaml
---
name: sdlc-gate
description: >-
  Verify forward pipeline SDLC artifacts against phase-specific gate criteria.
  Use when validating SRS, HLD, LLD, cross-cutting, IMP, or TST outputs during
  the forward pipeline, running post-phase quality gates before proceeding to
  the next phase, or checking if forward pipeline artifacts meet minimum criteria.
  Read-only — never modifies files. Returns structured PASS/FAIL with specific
  failures for retry. Phase-aware — loads correct criteria set per phase.
version: 1.0.0
model: sonnet
maxTurn: 15
tools: Read, Bash
permissionMode: acceptEdits
---
```

Key differences từ codebase-gate:
- Phase set: `srs`, `hld`, `lld`, `cross-cutting`, `imp`, `tst` (không có lld-synthesis, srs-synthesis, srs-verify)
- Criteria khác nhau (lấy từ procedures.md forward gate checklist)
- Cross-cutting phase criteria (7 checks — không tồn tại trong reverse pipeline vì reverse cross-cutting agents tự verify)
- Input detection: services + domains từ orchestrator prompt
- Không đọc file từ `agent_docs/features/FR-*.md` cho SRS gate (vì SRS tạo ra features, không đọc ngược)

## Files Liên Quan

- `.claude/rules/sdlc-pipeline.md:65-73` — Gate Protocol
- `.claude/agents/codebase/codebase-gate.md` — reference implementation (reverse)
- `.claude/skills/sdlc-orchestrator/references/procedures.md:356-404` — forward gate criteria
- `.claude/scripts/sdlc-validate-agent-output.sh` — validation script
- `.claude/skills/sdlc-automation/SKILL.md` — automation gate handling
