# Sprint Gate Check Criteria

Load this file when verifying the **sprint** phase. Run every criterion below. For each: report PASS, FAIL (with specific evidence), or SKIP (if artifact not found).

## 1. Board Accuracy

Read `.work/board.md`. Cross-reference with `agent_docs/features/FR-*.md` status:
- Board status must match actual feature status
- No feature in "Done" that still has open work
- No feature in "Todo" that is already complete

## 2. Roadmap Completeness

Read `agent_docs/roadmap.md`:
- Must have a "Current" sprint with goal and features
- Must have a "Next" sprint with goal and features
- Sprint dates must be specified

## 3. Backlog Priority Alignment

Read `.work/backlog.md`. Cross-reference with PRD/SRS MoSCoW priorities:
- Priority order in backlog must match MoSCoW from PRD
- No P0 items buried below P2 items

## 4. Ready-for-Implementation Gate

Read `.work/backlog.md` "Ready for Implementation" section:
- Every feature listed must have SRS + HLD + LLD + IMP + TST all complete
- Verify by checking existence of artifacts for each listed FR
- Flag any feature in Ready that's missing spec artifacts
