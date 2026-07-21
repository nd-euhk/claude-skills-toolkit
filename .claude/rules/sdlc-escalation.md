# SDLC Escalation

Escalation chains and fail-safe patterns. Every SDLC entry point must follow
these rules when the current lane cannot handle the request.

## Escalation Lanes (lightest → heaviest)

```
quick → automation → orchestrator
  │         │            │
  └─────────┴────────────┘
         reverse
```

- **quick** handles only trivial tasks (≤2 files, no API/schema/security/billing)
- **automation** handles autonomous execution of well-understood work
- **orchestrator** handles everything with full human-in-the-loop safety
- **reverse** is a peer lane for codebase→specs work, can escalate to orchestrator

### fixbug Flow: Orchestrator-Only

The `fixbug` flow is **only available through orchestrator**. It requires human
diagnosis judgment (stack trace analysis, root cause hypothesis, fix scope
evaluation) that automation and quick cannot safely provide.

- **Never escalate from quick to fixbug** — quick does not diagnose bugs. If a
  bug is discovered during quick flow, escalate to orchestrator with
  `flow=fixbug`.
- **Never escalate from automation to fixbug** — automation has no fixbug flow.
  If the human input contains "bug"/"lỗi"/"fix", explicitly escalate to
  orchestrator with `flow=fixbug` (see automation SKILL.md §Step 2).
- **Orchestrator handles fixbug directly** — no further escalation needed.

## When to Escalate

### From quick → orchestrator (or automation)

| Trigger | Action |
|---------|--------|
| Trivial gate fails (any of 5 criteria) | Stop, propose orchestrator with flow=task |
| Triage grill reveals non-trivial scope | Stop, propose orchestrator or automation |
| GATE-light fails (any of 4 checks) | Stop — gate failure signals scope was underestimated |
| Review finds bugs or security issues | Escalate — the change has broader impact than expected |
| Human uncertain about scope during grill | Default to orchestrator |

### From automation → orchestrator

| Trigger | Action |
|---------|--------|
| Grilling cannot meet exit criteria after 2 rounds | Fallback to orchestrator for deeper discovery |
| Workflow dispatch fails (script missing, timeout) | Report failure, offer orchestrator as fallback |
| Any phase gate returns FAIL | Report the phase + criteria, propose orchestrator |
| Human requests more control mid-grilling | Respect immediately, transfer context |
| Requirements too ambiguous for autonomous execution | Propose orchestrator before any work |

### From orchestrator (always the terminal lane)

Orchestrator has no upward escalation — it handles anything. If orchestrator
cannot proceed:
- **Missing foundation**: invoke `sdlc-preflight`, stop if unresolved
- **Unclear requirements**: continue HITL discovery until clarity emerges
- **Technical blocker**: report to human with concrete options

## Escalation Protocol

When escalating:

1. **Preserve context** — summarize what was gathered (user intent, grilling results, files identified)
2. **State the reason** — which trigger fired, what evidence supports it
3. **Propose the target** — which entry point + flow is recommended
4. **Ask once** — do not repeatedly suggest escalation if the human declines

```
⚠️  [current lane] không phù hợp: [lý do cụ thể]
   Đề xuất: [target lane] với flow [flow-type].
   [context summary nếu có].
   Bạn có muốn chuyển không?
```

## Fail-Safe Principles

- **Never downgrade safety** — escalate to a heavier lane, never from orchestrator to quick
- **Borderline = escalate** — "có thể" không đủ. Cần chắc chắn
- **One escalation decision** — ask once, respect the answer, do not loop
- **Context travels** — when switching lanes, carry gathered context so the human isn't re-interviewed
- **Crash = escalate** — if a subagent or workflow crashes irrecoverably, fall back to orchestrator
