# Subagent Configuration Reference

Complete reference for all YAML frontmatter fields available when creating subagents. Use this to understand each field, its valid values, defaults, and effects on subagent behavior.

## Table of Contents

- [Frontmatter Overview](#frontmatter-overview)
- [Required Fields](#required-fields)
- [Optional Fields](#optional-fields)
- [Field Combinations & Constraints](#field-combinations--constraints)
- [Complete Example](#complete-example)
- [Validation Checklist](#validation-checklist)
- [Scope Storage](#scope-storage)
- [Troubleshooting Configuration](#troubleshooting-configuration)
- [Next Steps](#next-steps)

## Frontmatter Overview

Subagent files use YAML frontmatter (between `---` delimiters) to configure the subagent:

```yaml
---
name: subagent-name
description: What the subagent does and when to use it
model: sonnet
tools: Read, Write, Bash
permissionMode: default
disallowedTools: Edit
skills: skill-name-1, skill-name-2
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./validate.sh"
---

[System prompt body follows below]
```

## Required Fields

### `name`

**Required.** Unique identifier for the subagent. Used internally for references and in CLI commands.

**Rules:**
- Lowercase letters and hyphens only (no spaces, underscores, numbers)
- Maximum 64 characters
- Should be descriptive and action-oriented (e.g., `db-analyzer`, `code-reviewer`)
- Must be unique within the scope (session, project, user, plugin)

**Examples:**
```yaml
name: db-analyzer        # ✅ Good
name: code-reviewer      # ✅ Good
name: Test_Runner        # ❌ Invalid (underscores, capitals)
name: database-query-execution-and-analysis-tool  # ❌ Too long
```

### `description`

**Required.** Natural language description that triggers Claude's delegation to this subagent. This is the PRIMARY signal Claude uses to decide when to delegate.

**Rules:**
- Maximum 1024 characters
- Should follow pattern: `[Action]. Use when [trigger contexts]. [Scope/constraints].`
- Must include 3+ specific trigger phrases (not vague language)
- Should be concrete and actionable
- No marketing language

**Good pattern:**
```yaml
description: >-
  Execute read-only database queries for data analysis. Use when analyzing
  data, generating reports, or exploring table structure. SELECT only;
  write operations blocked.
```

**Poor patterns:**
```yaml
description: Database query subagent              # Too vague
description: >-
  Execute database operations. Use when needed.   # "when needed" is vague
```

For detailed guidance on writing descriptions, see `delegation-signals.md`.

## Optional Fields

### `model`

**Optional.** AI model for this subagent to use. Defaults to `sonnet`.

**Valid values:**
- `sonnet` - Balanced capability/speed (default)
- `opus` - Most capable, slower (use for complex reasoning)
- `haiku` - Fast, cheaper (use for simple tasks)
- `inherit` - Use same model as parent conversation (for consistency)

**Effects:**
- Determines reasoning power and response quality
- Affects latency and cost
- Inheriting is useful when subagent work depends on parent context

**Examples:**
```yaml
model: haiku              # Fast, read-only tasks
model: opus              # Complex analysis requiring deep reasoning
model: inherit           # Keep consistency with parent conversation
```

**When to choose:**
- **haiku**: Read-only analysis, fast iteration, cost-sensitive
- **sonnet**: General purpose, balanced (default)
- **opus**: Complex reasoning, multi-step logic, production systems
- **inherit**: Subagent work chains with parent (needs parent's reasoning level)

### `tools`

**Optional.** Allowlist of tools the subagent can use. If omitted, inherits all tools from parent conversation.

**Valid tool names:**
- `Read` - Read files
- `Write` - Write new files
- `Edit` - Edit existing files
- `Bash` - Execute bash commands
- `Grep` - Search file contents
- `Glob` - Find files by pattern
- `Agent` - Launch nested subagents (see depth limits below)
- `Skill` - Invoke skills dynamically at runtime
- `AskUserQuestion` - Ask user for input
- And any MCP tools available in parent conversation

**Về Skill:** Có hai cách để subagent sử dụng skill:
- **`skills` trong frontmatter** — Nội dung skill được inject trực tiếp vào system prompt khi agent khởi tạo. Subagent có thể tham chiếu skill content mà không cần gọi `Skill` tool. KHÔNG cần khai báo `Skill` trong `tools` nếu chỉ dùng cơ chế này.
- **`Skill` tool** — Cho phép subagent gọi skill động tại runtime (tương tự như cách phiên chính gọi `/skill-name`). Cần khai báo `Skill` trong `tools` nếu muốn dùng cơ chế này.

### `Agent` Tool — Spawn Nested Subagents

Khi được cấp `Agent` tool (hoặc kế thừa từ parent), subagent có thể spawn nested subagents để phân tách các tác vụ phức tạp.

**Depth limits:**
| Chế độ | Giới hạn |
|--------|----------|
| **Foreground subagents** | Có thể spawn ở bất kỳ độ sâu nào |
| **Background subagents** | Từ độ sâu 5 trở lên, KHÔNG nhận `Agent` tool và không thể spawn thêm |

Giới hạn này cố định để tránh runaway concurrent trees.

**Ngăn nested spawning:** Bỏ `Agent` khỏi `tools` hoặc thêm vào `disallowedTools`:
```yaml
tools: Read, Write, Edit, Bash    # Không có Agent → không thể spawn subagent con
disallowedTools: Agent             # Hoặc chặn Agent khi kế thừa tất cả tools
```

**Format:**
```yaml
tools: Read, Grep, Glob           # Comma-separated list
tools: Read, Write, Edit, Bash    # Spaces after commas
```

**Principle of least privilege:**
- Only grant tools the subagent actually needs
- More restrictive = more secure

**Examples:**

```yaml
# Read-only analysis
tools: Read, Grep, Glob, Bash

# Code editor
tools: Read, Write, Edit, Bash

# Database analyst
tools: Bash, Read

# Background researcher
tools: Read, Grep, Glob
```

**Note:** If both `tools` and `disallowedTools` are specified, `disallowedTools` removes from `tools` list (intersection logic).

### `disallowedTools`

**Optional.** Denylist of tools to block. Removes these from the inherited or allowlist.

**Format:**
```yaml
disallowedTools: Edit, Bash       # Comma-separated
```

**When to use:**
- Start with all tools inherited, block specific ones
- Useful when you want "most tools except X"

**Examples:**

```yaml
# Allow everything except Write and Edit
disallowedTools: Write, Edit

# Start with all, deny dangerous tools
disallowedTools: Bash, Agent
```

**Rules:**
- If `tools` is specified, `disallowedTools` is applied to that list
- If `tools` is omitted, `disallowedTools` removes from all inherited tools
- Tool names must be exact (case-sensitive)

### `permissionMode`

**Optional.** Controls how the subagent handles permission prompts. Defaults to `default`.

**Valid values:**
- `default` - Standard permission checking; interactive prompts to user
- `acceptEdits` - Auto-accept file edits (Edit/Write); prompt for others
- `dontAsk` - Auto-deny interactive prompts; explicit tool access still works
- `bypassPermissions` - Skip all permission checks (use cautiously)
- `plan` - Read-only mode (blocks all write operations)

**Behavior by mode:**

| Mode | Permission Prompts | File Edits | Bash | Result |
|------|-------------------|------------|------|--------|
| `default` | ✅ Show to user | Ask | Ask | Interactive |
| `acceptEdits` | ✅ (except edits) | Auto-accept | Ask | Edits auto-approved |
| `dontAsk` | ❌ Auto-deny | Auto-deny | Works | No interaction |
| `bypassPermissions` | ❌ Skipped | Auto-allow | Works | No checks |
| `plan` | ❌ Auto-deny | Blocked | Works (RO) | Read-only |

**Examples:**

```yaml
# Interactive; user approves everything
permissionMode: default

# Auto-approve file edits; ask for other permissions
permissionMode: acceptEdits

# Background execution; no interactive prompts
permissionMode: dontAsk

# Read-only research
permissionMode: plan

# Complete trust (production subagents only)
permissionMode: bypassPermissions
```

See `permission-modes.md` for detailed behavior in foreground/background execution.

### `skills`

**Optional.** Preload skill nội dung vào system prompt của subagent khi khởi tạo. Toàn bộ `SKILL.md` body được inject — subagent có thể tham chiếu trực tiếp đến skill instructions mà không cần gọi `Skill` tool.

**⚠️ KHÔNG cần khai báo `Skill` trong `tools` nếu chỉ dùng cơ chế preload này.** `skills` trong frontmatter và `Skill` tool là hai cơ chế độc lập.

**Format:**
```yaml
skills: skill-name-1, skill-name-2
```

**Khi nào dùng `skills` (preload):**
- Skill luôn cần trong mọi lần thực thi của subagent (nền tảng)
- Muốn skill content có sẵn ngay từ đầu, không cần invoke
- VD: `code-quality-standards`, `security-best-practices`

**Khi nào dùng `Skill` tool (động):**
- Skill chỉ cần trong một số tình huống nhất định
- Muốn tiết kiệm token khi skill không phải lúc nào cũng dùng
- Cần gọi skill với tham số hoặc vào thời điểm cụ thể
- VD: `Skill(sequential-thinking)` khi cần phân tích phức tạp

**Examples:**

```yaml
# Preload: skill luôn có sẵn trong context
skills: code-review-standards

# Preload nhiều skill
skills: security-analysis, performance-optimization

# Kết hợp: preload skill nền + Skill tool cho skill tùy chọn
skills: code-quality-standards
tools: Read, Write, Edit, Bash, Skill
# → code-quality-standards luôn có sẵn. Có thể gọi Skill(sequential-thinking) khi cần.
```

**Important:**
- Subagents KHÔNG kế thừa skills từ parent conversation
- Phải liệt kê tường minh tất cả skill cần preload
- Toàn bộ nội dung skill được load (tăng token usage)
- `skills` field KHÔNG thay thế `Skill` tool — chúng bổ trợ cho nhau

**Phân biệt ba cơ chế:**
| Cơ chế | Cách hoạt động | Cần khai báo gì |
|--------|---------------|-----------------|
| `skills` field | Inject SKILL.md vào system prompt lúc khởi tạo | `skills: skill-name` trong frontmatter |
| `Skill` tool | Gọi skill động tại runtime như function call | `Skill` trong `tools` list |
| `Agent` tool | Spawn nested subagent (có thể có skills riêng) | `Agent` trong `tools` list |

### `hooks`

**Optional.** Define lifecycle hooks that run during the subagent's execution. Hooks enable conditional tool validation, lifecycle events, and integration with external systems.

**Supported hook events:**

| Event | When it fires | Input | Use case |
|-------|---------------|-------|----------|
| `PreToolUse` | Before tool execution | Tool name | Validate before execution |
| `PostToolUse` | After tool execution | Tool name | Run linters, formatters |
| `Stop` | When subagent finishes | (none) | Cleanup operations |

**Format:**

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
  Stop:
    - type: command
      command: "./scripts/cleanup.sh"
```

**Matcher syntax:**
- Single tool: `"Bash"`, `"Edit"`
- Multiple tools: `"Edit|Write"`, `"Read|Grep|Glob"`
- Wildcard: Not supported; list explicitly

**Examples:**

```yaml
# Validate SQL queries before execution
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"

# Run linter after code edits
hooks:
  PostToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "eslint --fix"

# Cleanup database connection
hooks:
  Stop:
    - type: command
      command: "./scripts/cleanup-db.sh"
```

For detailed hook implementation, see `advanced-patterns.md` and `tool-scoping.md`.

## Field Combinations & Constraints

### Valid Combinations

```yaml
# Minimal (most permissive)
---
name: basic-agent
description: Does basic tasks
---

# Tool-restricted, read-only
---
name: analyzer
description: Analyzes code
tools: Read, Grep, Glob
permissionMode: plan
model: haiku
---

# Trusted editor
---
name: code-fixer
description: Fixes bugs
tools: Read, Edit, Write, Bash
permissionMode: acceptEdits
model: sonnet
---

# Validated database access
---
name: db-reader
description: Read-only queries
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./validate-query.sh"
---
```

### Invalid Combinations

```yaml
# ❌ Invalid tool name (case-sensitive)
tools: read, write, edit         # Should be: Read, Write, Edit

# ❌ Conflicting modes (if parent uses bypassPermissions)
permissionMode: plan             # Cannot override parent bypass

# ❌ Inconsistent constraints
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Edit"            # Edit not in tools list
      hooks: [...]
# This is OK actually (hook won't apply but no error)

# ❌ Invalid field names
permssion_mode: default          # Typo in field name
toolss: Read                     # Typo in field name
```

## Complete Example

```yaml
---
name: data-analyst
description: >-
  Execute read-only SQL queries to analyze data. Use when analyzing data
  patterns, generating reports, or exploring table structure. SELECT
  queries only; write operations blocked.
version: 1.0.0
model: opus
tools: Bash, Read, Write
permissionMode: dontAsk
skills: data-analysis-standards
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-query.sh"
---

You are a data analyst specializing in SQL analysis...
```

## Validation Checklist

Before deploying, verify:

- [ ] `name` is lowercase-hyphen, ≤64 chars, unique
- [ ] `description` includes 3+ trigger phrases, ≤1024 chars
- [ ] `model` is sonnet/opus/haiku/inherit (or omitted)
- [ ] `tools` uses exact tool names (Read, Write, Edit, Bash, Grep, Glob, etc.)
- [ ] `permissionMode` is valid: default/acceptEdits/dontAsk/bypassPermissions/plan
- [ ] `hooks` matchers use exact tool names
- [ ] YAML syntax is valid (proper indentation, no typos in field names)
- [ ] File has frontmatter delimiters (`---` before and after)
- [ ] System prompt (body) follows frontmatter

See `validation-workflow.md` for full validation process.

## Scope Storage

Where to store subagent files (determines visibility):

| Location | Scope | Priority |
|----------|-------|----------|
| `.claude/agents/` | Current project | High (2) |
| `~/.claude/agents/` | All projects | Medium (3) |
| `--agents` CLI | Current session | Highest (1) |
| Plugin `agents/` | Where plugin installed | Low (4) |

When multiple subagents share the same name, higher priority location wins.

## Troubleshooting Configuration

### Subagent doesn't load
- Check YAML syntax (indentation, `---` delimiters)
- Verify `name` is lowercase-hyphen
- Ensure file is in correct directory

### Subagent doesn't delegate
- Check `description` for vague language
- Add 3+ specific trigger phrases to description
- Review `delegation-signals.md` for better descriptions

### Tool access denied
- Verify tool is in `tools` list (case-sensitive)
- Check `disallowedTools` isn't blocking it
- Verify tool name is exact (Read, not read)

### Permissions prompting unexpectedly
- Check `permissionMode` setting
- Verify parent conversation permission context
- Use `permissionMode: dontAsk` for background execution

### Hooks not triggering
- Verify hook script is executable
- Check hook `matcher` uses exact tool names (case-sensitive)
- Ensure hook `command` path is correct

## Next Steps

- **Writing descriptions:** See `delegation-signals.md`
- **Permission mode details:** See `permission-modes.md`
- **Tool access patterns:** See `tool-scoping.md`
- **Advanced hooks:** See `advanced-patterns.md`
- **Validation workflow:** See `validation-workflow.md`
