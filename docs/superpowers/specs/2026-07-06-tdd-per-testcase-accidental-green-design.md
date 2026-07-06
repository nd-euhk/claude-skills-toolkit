# TDD Per-Testcase với Accidental Green Detection

## Summary

Refactor toàn bộ 8 TDD agents từ flow **all-at-once** (RED tất cả test → GREEN tất cả code → REFACTOR tất cả → GATE) sang flow **per-testcase** chuẩn TDD (RED₁ → GREEN₁ → REFACTOR₁ → RED₂ → ...). Đồng thời tích hợp **accidental green detection** — khi test vừa viết đã PASS do implementation của TC trước đó đã tổng quát đến mức cover luôn TC hiện tại.

## Motivation

### Vấn đề 1: Flow all-at-once phá vỡ TDD cycle

TDD chuẩn yêu cầu xử lý từng test case một. Flow all-at-once hiện tại gây ra:
- Không thể detect accidental green (test pass ngay khi viết) vì không có implementation nào tồn tại
- RED mất context về implementation đã có từ TC trước
- Khó trace bug — test nào gây ra lỗi trong số 10 test

### Vấn đề 2: Accidental green xảy ra thường xuyên

Khi giải quyết TC-001, developer thường viết solution tổng quát, vô tình cover luôn TC-002. TDD phải xử lý được tình huống này:
- **Vẫn viết test** — không có code tính năng nào tồn tại mà không có test bảo vệ
- **Sabotage để verify** — đảm bảo test không phải false positive
- **Skip implementation** — tiết kiệm thời gian, không viết code thừa

## Architecture

### Flow tổng thể

```
sdlc-orchestrator / workflow
  │
  ├── Pre-loop: đọc feature spec, extract danh sách TC theo priority
  │
  ├── for each TC (theo risk priority: CRITICAL → HIGH → MEDIUM → LOW):
  │     │
  │     spawn RED(TC-N) ──→ RED là mini-orchestrator:
  │       │
  │       ├── 1. Đọc test spec, viết test code cho TC-N
  │       │
  │       ├── 2. Chạy test ──┬── ĐỎ (expected) ──→ step 4a
  │       │                  └── XANH (accidental) ──→ step 3
  │       │
  │       ├── 3. Accidental Green Detection:
  │       │   ├── Check test không trivial
  │       │   ├── Spawn Explore(read-only) → map source code path test hit
  │       │   ├── Light Sabotage tại vị trí minimal → chạy test
  │       │   │   ├── ĐỎ → ✅ Revert → report "accidental-green: true"
  │       │   │   └── XANH → attempt sabotage vị trí khác / rewrite test
  │       │   │       ├── Max 3 attempts → BLOCKED → AskUserQuestion
  │       │   │       └── < 3 attempts → try again
  │       │   └── Revert sabotage ngay sau verify
  │       │
  │       ├── 4a. Test ĐỎ thật → spawn GREEN(TC-N) → spawn REFACTOR-light(TC-N)
  │       ├── 4b. Accidental green verified → skip GREEN, skip REFACTOR-light
  │       │
  │       └── 5. Return report cho orchestrator
  │
  ├── GATE(light) ← sau tất cả TC
  ├── REFACTOR(full, --mode=full) ← cross-cutting refactor
  └── GATE(full)
```

### Agent trách nhiệm

| Agent | Vai trò mới | Thay đổi chính |
|-------|-------------|----------------|
| **tdd-be-red** | Mini-orchestrator, per-testcase, accidental green detection | +Explore spawn, +sabotage flow, +3-attempt limit, +spawn GREEN |
| **tdd-fe-red** | Tương tự | Tương tự |
| **tdd-be-green** | Scope 1 TC, nhận skip flag | +skip protocol, scope nhỏ hơn |
| **tdd-fe-green** | Tương tự | Tương tự |
| **tdd-be-refactor** | 2 mode: --mode=light (per-TC) và --mode=full (cuối) | +mode detection, scope khác nhau |
| **tdd-fe-refactor** | Tương tự | Tương tự |
| **tdd-be-gate** | Không đổi | Đã có light/full |
| **tdd-fe-gate** | Không đổi | Đã có light/full |

## Accidental Green Detection (chi tiết)

### Trigger

Sau khi RED viết test và chạy — test PASS nhưng không có code implementation nào được viết cho TC này.

### Step-by-step

#### Step 3.1: Sanity Check

```
IF test is trivially true (assertTrue(true), expect(true).toBe(true), etc.):
    → rewrite test (+1 attempt)
    → continue
```

#### Step 3.2: Explore Source Code

Spawn **Explore** subagent (read-only) với prompt:

> "Test case [tên file] is passing without dedicated implementation. Map the source code execution path this test hits: which classes, methods, branches, and conditions are exercised. Identify the minimal code location where a small change would cause this test to fail."

Explore trả về structured code map:
- File + line number của method được gọi
- Condition/branch được hit
- Return value path
- Đề xuất 1-3 vị trí sabotage tiềm năng

#### Step 3.3: Light Sabotage

Tại 1 vị trí minimal nhất từ code map:

**Backend sabotage patterns:**
- Đảo logic: `>` ↔ `<=`, `==` ↔ `!=`
- Đổi dấu: `+` ↔ `-`
- Flip boolean return: `true` ↔ `false`
- Đổi hằng số: `100` → `101`

**Frontend sabotage patterns:**
- Đảo JSX condition: `{show && <Comp/>}` → `{!show && <Comp/>}`
- Đổi prop value: `disabled={false}` → `disabled={true}`
- Comment handler: `onClick={handler}` → `// onClick={handler}`
- Đổi text node: `"Submit"` → `"SUBMIT_WRONG"`

**Nguyên tắc:** Thay đổi nhỏ nhất có thể, đúng vị trí code path mà test hit. Không sửa logic rộng.

#### Step 3.4: Verify

Chạy test sau sabotage:
- **ĐỎ** → ✅ Test hợp lệ → revert sabotage NGAY → report "accidental-green: true"
- **XANH** → ⚠️ Thử vị trí khác hoặc rewrite test (attempt++)

#### Step 3.5: 3-Attempt Hard Limit

```
attempt = 0
max_attempts = 3

while attempt < max_attempts:
    thực hiện sabotage hoặc rewrite
    chạy test
    if ĐỎ: SUCCESS, revert, report -> EXIT
    attempt++

if attempt >= max_attempts:
    → TRẢ VỀ BLOCKED
    → Ghi report chi tiết: code map, vị trí đã sabotage, kết quả mỗi attempt
    → Orchestrator nhận BLOCKED → AskUserQuestion
```

**Mỗi attempt là:** 1 lần sabotage vị trí mới HOẶC 1 lần rewrite test logic.

**Explore (read-only) không tính là attempt.**

### Report Format

RED report (`.work/reports/{feature}-TC-{N}-red-report.md`):

```markdown
# RED Report: {feature} — TC-{N}: {test case name}

## Result: {DONE | BLOCKED | STALE}

## Test Details
- File: path/to/test
- Layer: unit | integration | e2e
- Risk: CRITICAL | HIGH | MEDIUM | LOW

## Verification
- Expected: RED (fail)
- Actual: {RED | GREEN (accidental)}

## Accidental Green (if applicable)
| Step | Action | Result |
|------|--------|--------|
| 1 | Sanity check | non-trivial ✅ |
| 2 | Explore source | hit: Service.java:42, condition `amount > 0` |
| 3 | Sabotage: flipped `>` to `<=` | Test turned RED ✅ |
| 4 | Revert | Sabotage reverted |

## Blocked (if applicable)
- Attempts: 3/3
- Failures: [chi tiết mỗi attempt]
- Recommendation: [human cần xem gì]

## Skip Flags (for GREEN)
- accidental-green: true → skip implementation
```

## Orchestrator Contract

### RED Exit Codes

| Code | Ý nghĩa | Orchestrator Action |
|------|---------|---------------------|
| `DONE` | Test hợp lệ, sẵn sàng cho GREEN (hoặc skip) | Tiếp tục TC tiếp theo |
| `BLOCKED` | Sau 3 attempts không verify được test | Dừng pipeline, `AskUserQuestion` |
| `STALE` | Input spec thiếu hoặc ambiguous | Dừng pipeline, báo cáo human |

### GREEN Changes

- Đọc RED report → nếu `accidental-green: true` → skip, return "SKIPPED: test already passes via existing implementation"
- Scope: chỉ implement code cho 1 TC (không phải toàn bộ feature)
- Input: RED report của chính TC đó + implementation spec

### REFACTOR Changes

Mode detection:
```
--mode=light (default khi được RED spawn):
  - Chỉ refactor code vừa viết trong TC này
  - Extract method, rename, inline cleanup
  - Không chạy cross-cutting concerns
  - Thời gian: < 1 phút

--mode=full (orchestrator spawn sau GATE light):
  - Refactor toàn bộ feature
  - Cross-cutting: dedup, consistency, architectural
  - Đầy đủ 6 categories (security, data, perf, resilience, obs, quality)
  - Thời gian: không giới hạn
```

### GATE Changes: Không

GATE agents đã có light/full mode từ trước, không cần thay đổi. Light mode chạy sau khi tất cả TC hoàn thành (trước REFACTOR full). Full mode chạy sau REFACTOR full.

## Rollout Plan

Cập nhật từng cặp agent, backend trước → frontend sau:

1. `tdd-be-red` — mini-orchestrator + accidental green detection
2. `tdd-be-green` — per-TC scope + skip protocol
3. `tdd-be-refactor` — light/full mode
4. `tdd-fe-red` — mini-orchestrator + accidental green detection
5. `tdd-fe-green` — per-TC scope + skip protocol
6. `tdd-fe-refactor` — light/full mode
7. `tdd-be-gate` + `tdd-fe-gate` — verify không cần đổi

## Edge Cases

1. **TC đầu tiên đã accidental green** — không thể, vì chưa có implementation nào. Nếu xảy ra → test là false positive → rewrite.
2. **3 sabotage vị trí khác nhau đều XANH** → BLOCKED. Có thể test không thực sự test gì, hoặc codebase có vấn đề.
3. **Explore không tìm thấy code path** → test có thể hit code từ dependency, không phải project code. Ghi nhận, skip sabotage, report để human review.
4. **Sabotage làm vỡ test khác** — revert ngay, chọn vị trí khác. Không tính là attempt nếu test khác fail.
5. **TC CRITICAL bị BLOCKED** → dừng toàn bộ pipeline, không xử lý các TC còn lại cho đến khi human unblock.
6. **TC LOW bị BLOCKED** → ghi nhận, tiếp tục các TC khác, report sau cùng.
