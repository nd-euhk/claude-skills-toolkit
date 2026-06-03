---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
version: 1.1.0
allowed-tools: Read,Write,Bash(*),WebSearch,WebFetch,AskUserQuestion
---

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions to refine the idea. Once you understand what you're building, present the design and get user approval.

## Gate: No Implementation Before Design Approval

Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY project regardless of perceived simplicity.

## Anti-Pattern: "This Is Too Simple To Need A Design"

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## Workflow

### Phase 1: Explore Project Context

Check the current project state — files, docs, recent commits. Before asking detailed questions, assess scope: if the request describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately. Don't spend questions refining details of a project that needs to be decomposed first.

If the project is too large for a single spec, help the user decompose into sub-projects: what are the independent pieces, how do they relate, what order should they be built? Then brainstorm the first sub-project through the normal design flow. Each sub-project gets its own spec → plan → implementation cycle.

### Phase 2: Offer Visual Companion

When you anticipate visual questions (mockups, layouts, diagrams), offer the browser-based companion once for consent. **This offer MUST be its own message** — do not combine it with clarifying questions or context:

> "Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams, comparisons, and other visuals as we go. This feature is still new and can be token-intensive. Want to try it? (Requires opening a local URL)"

Wait for the user's response. If they accept, read `references/visual-companion.md` for the full guide before proceeding. If they decline, continue text-only.

### Phase 3: Clarify Requirements

Ask questions to understand purpose, constraints, success criteria, and scope.

**Question patterns:**
- **Use AskUserQuestion for choice-based questions** — up to 4 options per question, batch up to 4 independent questions in one call
- **Use AskUserQuestion open-form** (`options: []`) for free-text exploration questions
- **For complex open-ended topics** — fall back to text-based one-at-a-time
- **Prefer multiple choice** when possible — easier for the user to answer

### Phase 4: Propose Approaches & Present Design

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Lead with your recommended option and explain why

**Presenting the design:**
- Scale each section to its complexity: a few sentences if straightforward, up to 200-300 words if nuanced
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

For guidance on designing with clear boundaries and working in existing codebases, see `references/design-principles.md`.

### Phase 5: Write Spec, Review, Transition

**Write the spec:**
- Save to `.work/brainstorming/BRAIN-YYYYMMDD--<topic>--design.md` (user preferences override this default)
- Keep the spec focused and actionable
- Commit the design document to git
- Remind the user to add `.work/brainstorming/visual-companion/` to `.gitignore` if not already present

**Spec self-review** — check with fresh eyes:
1. **Placeholder scan:** Any "TBD", "TODO", incomplete sections, or vague requirements? Fix them.
2. **Internal consistency:** Do any sections contradict each other? Does the architecture match the feature descriptions?
3. **Scope check:** Is this focused enough for a single implementation plan, or does it need decomposition?
4. **Ambiguity check:** Could any requirement be interpreted two different ways? If so, pick one and make it explicit.

Fix issues inline. For a more thorough review, optionally dispatch a subagent using `references/spec-review-prompt.md`.

**User review gate** — after the self-review passes, ask the user:

> "Spec written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan."

Wait for the user's response. If they request changes, make them and re-run the self-review. Only proceed once the user approves.

**Transition:**
- Present the final spec summary and suggest the appropriate next step
- For features needing full SDLC: suggest the orchestrator skill
- For simple changes: suggest direct implementation
- Do NOT invoke any implementation skill directly — let the user decide

## Key Principles

- **Batch interactive questions** using AskUserQuestion — group independent choices, use open-form for free-text
- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **Explore alternatives** — always propose 2-3 approaches before settling
- **Incremental validation** — present design, get approval before moving on
- **Be flexible** — go back and clarify when something doesn't make sense

## Visual Companion

A browser-based companion for showing mockups, diagrams, and visual options. Available as a tool — not a mode. Accepting the companion means it's available for questions that benefit from visual treatment; it does NOT mean every question goes through the browser.

To start a session, read `references/visual-companion.md` for the complete guide.
