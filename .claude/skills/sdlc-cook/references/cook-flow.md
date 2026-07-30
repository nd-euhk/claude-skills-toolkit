# Cook Flow Details — sdlc-cook

Chi tiết TDD orchestration, bash commands, và GATE specs. Controller load file này khi
thực thi Bước 5 (TDD Orchestration) trong cook flow. Dùng chung với
`references/agent-templates.md` — file này mô tả procedure, agent-templates.md mô tả
cách spawn từng agent.

---

## Readiness Check

1. Đọc `.work/board.md` và `.work/backlog.md` trong worktree
2. Tìm task human muốn cook
3. Route theo status:

| Status | Hành động |
|---|---|
| **ready** | Tiếp tục |
| **TODO** | Từ chối: "Task chưa có specs đầy đủ. Chạy flow task trước." |
| **in progress** | Cảnh báo: "Task đang được triển khai. Tiếp tục hay spawn thêm developer?" |
| **review** | Cảnh báo: "Task đang review. Chạy cook lại từ đầu hay chỉ fix review findings?" |
| **done** | Cảnh báo: "Task đã done. Muốn sửa gì thêm? Nếu là bug → flow fixbug." |
| **Không tìm thấy** | Từ chối: "Task không tồn tại trên board." |

---

## Verify Cook Prerequisites

```bash
FR_ID="<FR-ID từ human input hoặc board>"

# Feature spec
test -f agent_docs/features/$FR_ID.md && echo "✅ $FR_ID feature spec" || echo "⚠️ MISSING: $FR_ID"

# IMP + TST specs
for spec in implementation test-specs; do
  for dir in agent_docs/backend/*/ agent_docs/frontend/*/; do
    test -f ${dir}${spec}/${FR_ID}-*.md 2>/dev/null && echo "✅ ${dir}${spec}/${FR_ID}" || true
  done
done

# Hard-boundaries và tech-design
test -f agent_docs/hard-boundaries.md && echo "✅ hard-boundaries.md" || echo "⚠️ MISSING"
ls agent_docs/tech-design/*-service.md 2>/dev/null && echo "✅ tech-design" || echo "⚠️ No tech-design"
```

**Thiếu IMP hoặc TST specs** → từ chối cook: "Chưa có IMP/TST specs. Chạy flow task để tạo specs trước."

---

## TDD Orchestration (Bước 5)

### 5.1: Đọc Specs và Trích xuất Test Cases

```bash
# Đọc TST spec
cat agent_docs/{backend,frontend}/{service,app}/test-specs/${FR_ID}-test.md
# Đọc IMP spec
cat agent_docs/{backend,frontend}/{service,app}/implementation/${FR_ID}-impl.md
# Đọc feature context
cat agent_docs/features/${FR_ID}.md
```

Trích xuất danh sách TCs: ID (N), tên, layer (unit/integration/e2e), risk (CRITICAL|HIGH|MEDIUM|LOW).
Thứ tự: CRITICAL → HIGH → MEDIUM → LOW.

### 5.2: Xác định Backend / Frontend

| FR có | Hành động |
|---|---|
| `backend_service` | Dùng `sdlc-tdd-be-*` agents |
| `frontend_app` | Dùng `sdlc-tdd-fe-*` agents |
| Cả hai | Backend trước, frontend sau. Song song chỉ khi xác nhận với human |

### 5.3: Capture Baseline

Dùng `.claude/scripts/baseline` harness script (không spawn agent). Detect framework →
run test suite → parse output → ghi `.work/baselines/YYYYMMDD-FR-{ID}-{BE|FE}.json`.
Script tự gán TC IDs, tạo `tc_index`, `by_file`, và trích xuất `pre_existing_failures`.

> **Template đầy đủ** (framework detection, parse commands, verify): `agent-templates.md` → Section 1.

Nếu có pre-existing failures → báo cáo human. Đây không phải interference.

### 5.4: Per-TC RED Cycle

Cho MỖI test case, spawn RED agent làm mini-orchestrator. RED agent nội bộ: viết test →
verify RED → accidental green detection (3 sabotage attempts) → spawn GREEN (implement
tối thiểu) → INTERFERENCE-LIGHT (same-file check) → spawn REFACTOR-light (cleanup).

> **Template đầy đủ** (Agent prompt với tất cả biến, expected behavior, return codes):
> `agent-templates.md` → Section 2.

**Sau mỗi TC, kiểm tra kết quả:**
- DONE → tiếp tục TC tiếp theo
- SKIPPED (accidental green) → tiếp tục TC tiếp theo
- INTERFERENCE → **dừng**, báo cáo human: broken test, culprit TC, files changed
- BLOCKED (3 sabotage attempts failed) → **dừng**, báo cáo human
- STALE (ambiguous spec) → báo cáo human, quyết định skip hay dừng

### 5.5: Tổng hợp Per-TC

```
✅ TC-1: DONE — {test name}
✅ TC-2: DONE — {test name}
⏭️ TC-3: SKIPPED — accidental green
⚠️ TC-4: INTERFERENCE — broke {test} in {file}
```

Nếu có INTERFERENCE → không proceed đến GATE. Human quyết định.

### 5.6: GATE Light (4 critical checks)

Spawn gate agent với mode light: L1 (Test Suite + INTERFERENCE-FULL qua baseline compare),
L2 (Hard Boundaries), L3 (Query/Token Safety), L4 (External Call Resilience / State Coverage).

> **Template đầy đủ** (BE/FE gate prompts, return codes): `agent-templates.md` → Section 5.

- ALL 4 PASS → tiếp tục REFACTOR full
- INTERFERENCE DETECTED → dừng, báo cáo human
- FAIL (khác interference) → spawn fix agents, retry GATE light (max 2)

### 5.7: REFACTOR Full

Spawn refactor agent mode full: 6 categories (Security, Data Integrity, Performance,
Resilience, Observability, Code Quality) + framework-specific compliance.

> **Template đầy đủ** (BE/FE categories, prompt): `agent-templates.md` → Section 6.

### 5.8: GATE Full (10 gates)

Spawn gate agent mode full: L1-L4 re-verify + F5-F10. INTERFERENCE-FULL skip trong GATE
full (test có thể đã rename/reorg sau REFACTOR).

> **Template đầy đủ** (BE/FE gates, return codes): `agent-templates.md` → Section 7.

- ALL 10 PASS → code ready. Tiếp tục Bước 6.
- FAIL → fix từng failure, retry GATE full (max 2)

---

## Post-TDD Steps

### Code Review

```bash
Skill("sdlc-review", "--code")
```

Review code mới chống lại IMP và TST specs. Issues → spawn fix → lặp đến khi pass.

### Git Commit & Push

```bash
Skill("git")
```

Commit message format: `feat({FR_ID}): {feature name}` với body liệt kê TCs đã hoàn thành.
**Xác nhận với human trước khi push** lên shared/protected branch.

### Sprint Update

```bash
Skill("sprint", "--all")
```

Board: `in progress` → `in review` → `done`. Cập nhật backlog, roadmap.
