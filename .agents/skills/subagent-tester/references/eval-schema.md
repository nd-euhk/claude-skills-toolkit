# Evaluation Schema Reference — Subagent Tester

Complete JSON schemas for all evaluation data files created during the subagent-tester pipeline.

---

## evals.json — Test Case Definitions

**Location:** `./evals/<subagent-name>/evals.json`

**Purpose:** Central registry of all test cases for a subagent. Defines what the subagent is being tested on.

**Schema:**

```json
{
  "subagent_name": "string (required) — name of subagent being tested",
  "subagent_path": "string (required) — path to subagent .md file",
  "description": "string (required) — one-line purpose of subagent",
  "evals": [
    {
      "id": "integer (required) — unique eval identifier (1, 2, 3, ...)",
      "name": "string (required) — short eval scenario name",
      "prompt": "string (required) — complete user prompt for this test case",
      "expected_output": "string (required) — description of good output",
      "files": [
        "string (optional) — file paths that should be created or modified"
      ]
    }
  ]
}
```

**Example:**

```json
{
  "subagent_name": "code-reviewer",
  "subagent_path": ".claude/agents/code-reviewer.md",
  "description": "Test code-reviewer subagent for bug detection and code quality analysis",
  "evals": [
    {
      "id": 1,
      "name": "Review PR diff for bugs",
      "prompt": "Review the changes in this PR for bugs, security issues, and code quality problems. The diff is in src/auth.ts and src/database.ts.",
      "expected_output": "Structured review with file paths, line numbers, severity ratings, and fix suggestions. Finds real bugs, no false positives.",
      "files": ["review-report.md"]
    },
    {
      "id": 2,
      "name": "Check code quality against style guide",
      "prompt": "Check src/components/ against our style guide: no console.log, max function length 50 lines, proper TypeScript types. Flag violations.",
      "expected_output": "List of style violations with file paths, line numbers, and rule references. Clean output, no false positives.",
      "files": ["style-report.md"]
    }
  ]
}
```

---

## eval_metadata.json — Assertions Per Eval

**Location:** `<workspace>/iteration-N/eval-M/eval_metadata.json`

**Purpose:** Define what "success" means for a specific eval. Contains assertions Claude will check against outputs.

**Schema:**

```json
{
  "eval_id": "integer (required) — which eval this metadata applies to",
  "subagent_path": "string (required) — path to subagent .md file",
  "assertions": [
    {
      "text": "string (required) — assertion to verify",
      "type": "string (required) — category: 'delegation', 'quality', 'tool_scoping', 'permission', 'efficiency', 'structure', 'functionality'",
      "target": "string (required) — where to look for this assertion"
    }
  ]
}
```

**Subagent-specific assertion types:**

| Type | Description | Example Target |
|------|-------------|---------------|
| `delegation` | Claude delegates to correct subagent | Agent tool call log |
| `quality` | Output is accurate, specific, well-structured | Final response content |
| `tool_scoping` | Declared tools are sufficient for task | Subagent execution — no tool-missing errors |
| `permission` | Permission mode is appropriate | No unnecessary prompts or denials |
| `efficiency` | Subagent completes within token/time budget | timing.json metrics |
| `structure` | Output follows expected format/schema | Output directory structure |
| `functionality` | Subagent completes intended task | Task objective met |

**Example:**

```json
{
  "eval_id": 1,
  "subagent_path": ".claude/agents/code-reviewer.md",
  "assertions": [
    {
      "text": "Claude delegates to code-reviewer subagent for PR review task",
      "type": "delegation",
      "target": "Agent tool call with subagent_type='code-reviewer'"
    },
    {
      "text": "Output includes file paths and line numbers for each finding",
      "type": "quality",
      "target": "Final response — file:line references"
    },
    {
      "text": "Subagent finds at least 3 real issues (not false positives)",
      "type": "functionality",
      "target": "Review report — verified findings"
    },
    {
      "text": "Subagent has Read tool for code access and Grep for pattern search",
      "type": "tool_scoping",
      "target": "Subagent definition — tools field"
    },
    {
      "text": "Output is structured with severity, file, line, and suggestion per finding",
      "type": "structure",
      "target": "Review report format"
    }
  ]
}
```

---

## grading.json — Assertion Results

**Location:** `<workspace>/iteration-N/eval-M/with_subagent/grading.json` and `baseline/grading.json`

**Purpose:** Record whether each assertion passed or failed. Includes evidence quotes from outputs.

**Schema:**

```json
{
  "eval_id": "integer (required) — which eval this grades",
  "configuration": "string (required) — 'with_subagent' or 'baseline'",
  "assertions_evaluated": [
    {
      "text": "string (required) — assertion text (from eval_metadata.json)",
      "passed": "boolean (required) — true if assertion passed",
      "evidence": "string (required) — quote or reference from output proving pass/fail"
    }
  ],
  "summary": {
    "assertions_total": "integer — total assertions evaluated",
    "assertions_passed": "integer — count of passed assertions",
    "pass_rate": "float (0.0–1.0) — assertions_passed / assertions_total"
  }
}
```

**Example (with_subagent):**

```json
{
  "eval_id": 1,
  "configuration": "with_subagent",
  "assertions_evaluated": [
    {
      "text": "Claude delegates to code-reviewer subagent for PR review task",
      "passed": true,
      "evidence": "Agent tool call: subagent_type='code-reviewer' with prompt containing PR review request"
    },
    {
      "text": "Output includes file paths and line numbers for each finding",
      "passed": true,
      "evidence": "Response: 'src/auth.ts:42 — missing null check', 'src/database.ts:128 — SQL injection risk'"
    },
    {
      "text": "Subagent finds at least 3 real issues (not false positives)",
      "passed": true,
      "evidence": "Found 5 issues: null check (auth.ts:42), SQL injection (database.ts:128), missing error handler (auth.ts:67), race condition (database.ts:203), hardcoded secret (auth.ts:15)"
    },
    {
      "text": "Subagent has Read tool for code access and Grep for pattern search",
      "passed": true,
      "evidence": "Subagent tools: Read, Grep, Glob, Bash — sufficient for code review"
    },
    {
      "text": "Output is structured with severity, file, line, and suggestion per finding",
      "passed": true,
      "evidence": "Each finding has: [SEVERITY] file:line — description → suggestion format"
    }
  ],
  "summary": {
    "assertions_total": 5,
    "assertions_passed": 5,
    "pass_rate": 1.0
  }
}
```

**Example (baseline — lower pass rate):**

```json
{
  "eval_id": 1,
  "configuration": "baseline",
  "assertions_evaluated": [
    {
      "text": "Claude delegates to code-reviewer subagent for PR review task",
      "passed": false,
      "evidence": "No Agent tool call — Claude reviewed code directly without subagent delegation"
    },
    {
      "text": "Output includes file paths and line numbers for each finding",
      "passed": true,
      "evidence": "Mentions auth.ts and database.ts with some line references"
    },
    {
      "text": "Subagent finds at least 3 real issues (not false positives)",
      "passed": false,
      "evidence": "Found 2 issues: missing error handling (auth.ts), long function (database.ts). Missed SQL injection and hardcoded secret."
    },
    {
      "text": "Subagent has Read tool for code access and Grep for pattern search",
      "passed": false,
      "evidence": "No subagent used — baseline doesn't involve subagent tool scoping"
    },
    {
      "text": "Output is structured with severity, file, line, and suggestion per finding",
      "passed": false,
      "evidence": "Output is narrative prose without structured format — no severity ratings or consistent suggestion format"
    }
  ],
  "summary": {
    "assertions_total": 5,
    "assertions_passed": 1,
    "pass_rate": 0.2
  }
}
```

---

## timing.json — Execution Metrics

**Location:** `<workspace>/iteration-N/eval-M/with_subagent/timing.json` and `baseline/timing.json`

**Purpose:** Track resource usage (tokens, wall-clock time) for each eval run.

**Schema:**

```json
{
  "total_tokens": "integer (required) — total tokens consumed",
  "duration_ms": "integer (required) — wall-clock execution time in milliseconds",
  "model": "string (required) — model used (e.g., 'claude-sonnet-4-6')",
  "timestamp": "string (optional) — ISO 8601 timestamp"
}
```

**Example:**

```json
{
  "total_tokens": 4215,
  "duration_ms": 12450,
  "model": "claude-sonnet-4-6",
  "timestamp": "2026-06-03T10:35:22Z"
}
```

---

## benchmark.json — Aggregated Results

**Location:** `<workspace>/iteration-N/benchmark.json`

**Purpose:** Summary statistics across all evals for an iteration. Generated by `aggregate_benchmark.rb`.

**Schema:**

```json
{
  "subagent_name": "string — name of subagent being tested",
  "iteration": "integer — iteration number (1, 2, 3, ...)",
  "timestamp": "string — ISO 8601 timestamp",
  "evals": [
    {
      "eval_id": "integer",
      "with_subagent": {
        "pass_rate": "float",
        "assertions_passed": "integer",
        "assertions_total": "integer",
        "avg_tokens": "integer",
        "avg_duration_ms": "integer"
      },
      "baseline": {
        "pass_rate": "float",
        "assertions_passed": "integer",
        "assertions_total": "integer",
        "avg_tokens": "integer",
        "avg_duration_ms": "integer"
      },
      "delta": {
        "pass_rate": "float — with_subagent - baseline (positive = improvement)",
        "tokens": "integer",
        "duration_ms": "integer"
      }
    }
  ],
  "summary": {
    "with_subagent_avg_pass_rate": "float",
    "baseline_avg_pass_rate": "float",
    "improvement": "float",
    "avg_tokens_with_subagent": "integer",
    "avg_tokens_baseline": "integer",
    "token_cost": "integer",
    "avg_duration_ms_with_subagent": "integer",
    "avg_duration_ms_baseline": "integer",
    "duration_cost_ms": "integer"
  }
}
```

---

## Workspace Directory Structure

```
./evals/                                      ← Project root
├── <subagent-name>/
│   ├── evals.json                           ← Test case definitions
│   └── workspace/
│       ├── iteration-1/
│       │   ├── eval-1/
│       │   │   ├── eval_metadata.json        ← Assertions for eval-1
│       │   │   ├── with_subagent/
│       │   │   │   ├── outputs/              ← Files created by agent
│       │   │   │   ├── grading.json          ← Pass/fail results
│       │   │   │   └── timing.json           ← Execution metrics
│       │   │   └── baseline/
│       │   │       ├── outputs/
│       │   │       ├── grading.json
│       │   │       └── timing.json
│       │   ├── eval-2/
│       │   │   └── (same structure)
│       │   └── benchmark.json                ← Aggregated results (Ruby output)
│       ├── iteration-2/
│       │   └── (same structure, updated subagent)
│       └── iteration-3/
│           └── (same structure)
```

## aggregate_benchmark.py — The Aggregation Script

The Python script reads all `grading.json` and `timing.json` files from an iteration directory and produces `benchmark.json`.

**Invocation:**

```bash
python .claude/skills/subagent-tester/scripts/aggregate_benchmark.py ./evals/<subagent-name>/workspace/iteration-N
```

**Example:**

```bash
python .claude/skills/subagent-tester/scripts/aggregate_benchmark.py ./evals/code-reviewer/workspace/iteration-1
```

**Output:**

```
✓ Benchmark aggregated: workspace/iteration-1/benchmark.json

Summary:
  Evals processed: 2
  With Subagent pass rate: 90.0%
  Baseline pass rate: 50.0%
  Improvement: +40.0 percentage points
  Token cost: +700
  Duration cost: +4000ms
```

**Logic:**

1. Discover all `eval-N/` directories
2. For each eval:
   - Read `with_subagent/grading.json` → extract pass_rate
   - Read `baseline/grading.json` → extract pass_rate
   - Read `with_subagent/timing.json` → extract total_tokens, duration_ms
   - Read `baseline/timing.json` → extract total_tokens, duration_ms
   - Calculate delta (with_subagent - baseline)
3. Compute summary statistics:
   - Average pass rates across all evals
   - Average tokens and duration across all evals
   - Calculate improvement (with_subagent - baseline)
4. Write `benchmark.json` with all results
