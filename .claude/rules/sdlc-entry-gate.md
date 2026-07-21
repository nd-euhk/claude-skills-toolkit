# SDLC Entry Gate

Shared entry gate executed by every SDLC entry point before any pipeline work
begins. Do not duplicate this logic in individual skills. Distinct from the
`sdlc-preflight` skill (which creates foundation files) — this rule governs
when and how to invoke it.

## Step 1: Git State Check

Check repository state before any work:

```bash
git branch --show-current && git status --porcelain
```

If the working tree is dirty, ask the human once with these options:
- **Stash** — save changes temporarily
- **Commit** — commit before proceeding
- **Continue** — proceed with a dirty tree (risk of conflicts)
- **Abort** — stop the pipeline

Abort ends the session immediately. Any other choice proceeds to Step 2.

## Step 2: Foundation Gate

Verify required foundation files exist in `agent_docs/`:

```bash
for f in project-overview.md user-context.md conventions.md; do
  test -f agent_docs/$f && echo "found: $f" || echo "missing: $f"
done
```

Requirements by flow:

| Flow | Minimum required | On missing |
|------|------------------|------------|
| `task` | `project-overview.md` + `user-context.md` | Invoke `sdlc-preflight` skill, verify again, stop if still missing |
| `cr` | Warn if missing, ask human before invoking `sdlc-preflight` skill |
| `cook` | Verify ready-status + feature specs + IMP + TST specs exist. Missing specs → reject cook, propose task flow |
| `fixbug` | `project-overview.md` recommended but not required. **Orchestrator-only flow** — not available through automation or quick. Requires human diagnosis judgment for root cause analysis and fix scope evaluation |
| `reverse` | None required (reverse pipeline produces foundation from code) |
| `quick` | **Skip entirely** — quick flow does not run specs, foundation is irrelevant |

## Step 3: Flow Verification

After foundation is confirmed, verify the flow choice:

- Re-read the user's request against the resolved flow
- If the scope appears larger than the flow can handle → escalate before any work
- If the flow requires foundation files that are missing and cannot be created → stop

## Reporting

Report entry gate outcome compactly:

```
🏗️ Entry Gate: [branch] | Git: [clean|dirty→stashed|committed|continued] | Foundation: [status per file]
```

Do not proceed past the entry gate with unresolved dirty state or missing
required foundation files.
