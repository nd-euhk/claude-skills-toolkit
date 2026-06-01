# INT-03: Directory Auto-Creation -- KET QUA

## Source

`skills/orchestrator/SKILL.md` line 96:

```
Report paths require directories.
Ensure `.work/plans/` and `.work/reports/` exist before writing.
Create with `mkdir -p` if needed.
```

## Verification

### SKILL.md Coverage

- **Directories mentioned**: `.work/plans/` and `.work/reports/`
- **Command specified**: `mkdir -p` (creates parent directories, no error if already exists)
- **Condition**: "if needed" (only when directories don't already exist)
- **Timing**: Before writing plan files (Common Phase: Plan Mode) and before writing report files (Phase 4: Summary in each workflow)

### Actual Directory State

Current state on the filesystem (verified via `ls -la`):

```
.work/plans/:
total 8
drwxrwxr-x 2 khuend khuend 4096 Jun  1 21:10 .
drwxrwxr-x 4 khuend khuend 4096 Jun  1 22:23 ..

.work/reports/:
total 8
drwxrwxr-x 2 khuend khuend 4096 Jun  1 21:10 .
drwxrwxr-x 4 khuend khuend 4096 Jun  1 22:23 ..
```

Both directories exist and are empty (no plan or report files yet).

### Workflow Integration

Each workflow uses these directories:

| Workflow | Plan path | Report path |
|----------|-----------|-------------|
| Task | `.work/plans/task-YYYYMMDD-{FR-name}--{slug}.md` | `.work/reports/task-YYYYMMDD-{FR-name}--{slug}.md` |
| CR | `.work/plans/cr-YYYYMMDD-{FR-name}--{slug}.md` | `.work/reports/cr-YYYYMMDD-{FR-name}--{slug}.md` |
| Cook | `.work/plans/cook-YYYYMMDD-{FR-name}--{slug}.md` | `.work/reports/cook-YYYYMMDD-{FR-name}--{slug}.md` |

The orchestrator must ensure both directories exist before writing to either path.

### Plan Mode Integration

The Common Phase: Plan Mode (SKILL.md lines 44-66) specifies:
- Step 3: `Agent(general-purpose)` writes plan to `.work/plans/{file}`
- Step 4: Human confirms via AskUserQuestion before proceeding to execution

The directory creation should happen in Step 2 or Step 3, before the first Write to `.work/plans/`.

### Report Writing Integration

Each workflow's Phase 4 (Summary) writes to `.work/reports/{file}`. Directory creation should happen before this Write.

## Assessment: PASS

The orchestrator SKILL.md explicitly instructs directory auto-creation using `mkdir -p` for both `.work/plans/` and `.work/reports/`. The command is correct (`mkdir -p` handles both creation and idempotency). Both directories currently exist on the filesystem. The instruction is positioned before any write operations (plan writing in Common Phase, report writing in Phase 4), ensuring no writes fail due to missing directories.

Minor note: The instruction says "Ensure ... exist before writing" but does not specify exactly where in the execution sequence to perform the mkdir. This is acceptable as the orchestrator can create them at first use (plan mode) and rely on `mkdir -p` idempotency for subsequent accesses.
