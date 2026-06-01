# Shared Template Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify shared template architecture changes are correct and working, commit design doc.

**Architecture:** Templates moved from orchestrator-specific to `.claude/templates/` shared location. Subagents reference default templates via `## Templates` section. Orchestrator briefs simplified to reference agent defaults.

**Tech Stack:** Claude Code plugin architecture, markdown templates, bash verification

---

### Task 1: Verify template files are complete

**Files:**
- Check: `.claude/templates/**/*.md`

- [ ] **Step 1: Count and verify template files**

```bash
find .claude/templates -type f -name "*.md" | sort
```

Expected: 15 files across srs/ (3), impl/ (3), tst/ (2), contracts/ (2), agt/ (4), cr/ (1)

- [ ] **Step 2: Verify no templates remain in old location**

```bash
test ! -d .claude/skills/orchestrator/templates && echo "PASS: old dir removed" || echo "FAIL: old dir still exists"
```

Expected: PASS

---

### Task 2: Verify subagent `## Templates` sections

**Files:**
- Check: `.claude/agents/{srs,hld,lld,imp,tst,sprint}.md`

- [ ] **Step 1: Verify each subagent has Templates section**

```bash
for agent in srs hld lld imp tst sprint; do
  if grep -q "^## Templates" ".claude/agents/${agent}.md"; then
    echo "  ${agent}: PASS"
  else
    echo "  ${agent}: FAIL"
  fi
done
```

Expected: All 6 agents PASS

- [ ] **Step 2: Verify Templates section is placed before Anti-Patterns**

```bash
for agent in srs hld lld imp tst sprint; do
  templates_line=$(grep -n "^## Templates" ".claude/agents/${agent}.md" | cut -d: -f1)
  antipatterns_line=$(grep -n "^## Anti-Patterns" ".claude/agents/${agent}.md" | cut -d: -f1)
  if [ "$templates_line" -lt "$antipatterns_line" ]; then
    echo "  ${agent}: PASS (Templates at line $templates_line, Anti-Patterns at $antipatterns_line)"
  else
    echo "  ${agent}: FAIL (wrong order)"
  fi
done
```

Expected: All PASS

- [ ] **Step 3: Verify template paths use .claude/templates/**

```bash
grep -r "\.claude/templates/" .claude/agents/srs.md .claude/agents/hld.md .claude/agents/lld.md .claude/agents/imp.md .claude/agents/tst.md .claude/agents/sprint.md | head -20
```

Expected: Template paths point to `.claude/templates/` not `orchestrator/templates/`

---

### Task 3: Verify orchestrator briefs are simplified

**Files:**
- Check: `.claude/skills/orchestrator/references/agent-brief-templates.md`

- [ ] **Step 1: Verify briefs reference agent defaults**

```bash
grep -c "default template\|default format\|\.claude/templates/" .claude/skills/orchestrator/references/agent-brief-templates.md
```

Expected: Non-zero count (briefs now reference agent defaults or template paths)

- [ ] **Step 2: Verify old output paths are removed**

```bash
grep "projects/{project}/specs" .claude/skills/orchestrator/references/agent-brief-templates.md || echo "PASS: old hardcoded paths removed"
```

Expected: PASS (old hardcoded paths removed)

---

### Task 4: Commit design doc

**Files:**
- Create: `docs/superpowers/specs/2026-06-01-shared-template-architecture-design.md`
- Create: `docs/superpowers/plans/2026-06-01-shared-template-architecture.md`

- [ ] **Step 1: Stage and commit design documents**

```bash
git add docs/superpowers/specs/2026-06-01-shared-template-architecture-design.md docs/superpowers/plans/2026-06-01-shared-template-architecture.md
git commit -m "docs: add shared template architecture design for orchestrator subagents

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 2: Verify commit**

```bash
git log -1 --oneline
git status
```

Expected: Clean working tree (design docs committed, plugin files in .claude/ are not tracked)
