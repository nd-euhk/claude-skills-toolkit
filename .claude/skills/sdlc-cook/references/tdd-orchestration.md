# Pipeline Status, TDD Cycle & GATE Protocol

Baseline capture, TDD cycle orchestration, GATE protocol,
và board update protocol. Dùng bởi cook flow.

## TDD Cycle Execution

### Per-TC Cycle

```
Cho mỗi TC (theo thứ tự CRITICAL → HIGH → MEDIUM → LOW):
  ┌─────────────────────────────────────────────────┐
  │ RED (sdlc-tdd-be-red / sdlc-tdd-fe-red)          │
  │ ├─ Viết test                                     │
  │ ├─ Verify RED (test fails)                       │
  │ ├─ Accidental green? → sabotage ×3 → confirm     │
  │ ├─ Spawn GREEN (implement)                       │
  │ ├─ INTERFERENCE-LIGHT: run all tests trong file   │
  │ └─ Spawn REFACTOR-light (cleanup per-TC)         │
  └─────────────────────────────────────────────────┘
```

### RED Return Codes

| Code | Ý nghĩa | Hành động tiếp |
|------|---------|---------------|
| **DONE** | TC pass, interference-free | Tiếp tục TC tiếp theo |
| **SKIPPED** | Accidental green (đã có implementation) | Tiếp tục TC tiếp theo |
| **INTERFERENCE** | TC này break test khác trong file | Dừng — báo human fix interference |
| **BLOCKED** | Sau 3 sabotage vẫn xanh | Dừng — báo human kiểm tra |
| **STALE** | Ambiguous spec | Báo human làm rõ spec |

### INTERFERENCE Handling

Khi RED agent return `INTERFERENCE`:

```
⚠️ TC-{N} "should_..." gây INTERFERENCE:
  - Broken test: should_validate_email trong UserServiceTest.java:45
  - GREEN đã sửa: [UserService.java:120, UserValidator.java:34]
  - Nguyên nhân: thay đổi validation logic ảnh hưởng đến test đã pass

Options:
  (a) Agent fix interference trong worktree → chạy lại TC-{N}
  (b) Human fix thủ công → chạy lại TC-{N}
  (c) Revert TC-{N} changes → skip TC này
```

### Agent Spawn Reference

**TDD Agents:**

| Agent | Phase | Mode |
|-------|-------|------|
| `sdlc-tdd-be-red` | RED | Per-TC mini-orchestrator |
| `sdlc-tdd-be-green` | GREEN | Minimal implementation cho 1 TC |
| `sdlc-tdd-be-refactor` | REFACTOR | `--mode=light` (per-TC) hoặc `--mode=full` (sau GATE light) |
| `sdlc-tdd-be-gate` | GATE | `--mode=light` (4 checks) hoặc `--mode=full` (10 checks) |
| `sdlc-tdd-fe-red` | RED (FE) | Frontend variant |
| `sdlc-tdd-fe-green` | GREEN (FE) | Frontend variant |
| `sdlc-tdd-fe-refactor` | REFACTOR (FE) | Frontend variant |
| `sdlc-tdd-fe-gate` | GATE (FE) | Frontend variant |

**Sprint Agents:**

| Agent | Dùng khi |
|-------|---------|
| `sdlc-sprint-board` | Update task status |
| `sdlc-sprint-backlog` | Update feature priority, dependency, ready gate |
| `sdlc-sprint-roadmap` | Update feature-to-phase mapping |

---

## Baseline Capture

Baseline là point-in-time snapshot của test suite trước TDD cycle.
Được capture bởi workflow agent trong worktree.

### Capture Command

```bash
# Detect framework + run tests:
# Gradle:
./gradlew :{service}:test

# Sau đó parse với baseline.py:
.claude/scripts/baseline parse \
  --framework junit-xml \
  --test-output-dir {build/test-results/test/} \
  --fr-id {FR-ID} \
  --layer {be|fe} \
  --service {service} \
  --test-command "./gradlew :{service}:test"
```

### Baseline File Format

```json
{
  "fr_id": "FR-AUTH-001",
  "layer": "be",
  "service": "auth-service",
  "captured_at": "2026-07-29T14:00:00Z",
  "test_command": "./gradlew :auth-service:test",
  "total": 45,
  "passed": 43,
  "failed": 2,
  "skipped": 0,
  "pre_existing_failures": [
    "should_handle_expired_token",
    "should_log_security_event"
  ],
  "tc_index": {
    "1": { "method": "should_authenticate_valid_user", "file": "AuthServiceTest.java", "status": "PASS" },
    "2": { "method": "should_reject_invalid_password", "file": "AuthServiceTest.java", "status": "PASS" }
  },
  "by_file": {
    "AuthServiceTest.java": [
      { "tc_id": 1, "method": "should_authenticate_valid_user", "status": "PASS" },
      { "tc_id": 2, "method": "should_reject_invalid_password", "status": "PASS" }
    ]
  }
}
```

### Pre-existing Failures

Nếu baseline có `pre_existing_failures > 0`:
- Báo cáo human: "⚠️ Có {N} tests đang fail trước TDD cycle. Không phải interference."
- GATE light INTERFERENCE-FULL sẽ exclude những test này khi so sánh

---

## GATE Protocol

### GATE Light (4 Critical Checks)

Chạy sau khi tất cả TCs hoàn thành, không có INTERFERENCE.

| Gate | Nội dung | Check |
|------|---------|-------|
| **L1** | Test Suite + INTERFERENCE-FULL | Tất cả tests pass + baseline comparison (test nào pass trước mà giờ fail?) |
| **L2** | Hard Boundaries | Không cross-service DB access, không direct API call vi phạm boundary |
| **L3** | Query Safety | Không raw SQL concatenation, không N+1 query mới |
| **L4** | Resilience | Không exception nuốt, có retry/timeout trên external calls |

Spawn: `sdlc-tdd-be-gate` hoặc `sdlc-tdd-fe-gate` với mode `light`.

### GATE Full (10 Checks)

Chạy sau REFACTOR-full, khi GATE light PASS.

| Gate | Nội dung |
|------|---------|
| **L1-L4** | Như GATE light (trừ INTERFERENCE-FULL) |
| **F5** | Security — input validation, auth check, sensitive data exposure |
| **F6** | Data Integrity — transaction boundary, cascade, constraint |
| **F7** | Observability — log level phù hợp, metric cho critical path |
| **F8** | Error Handling — error code canonical, message không leak internal |
| **F9** | Performance — không blocking I/O trên hot path, cache cho repeated query |
| **F10** | Code Quality — naming convention, test readability, no dead code |

Spawn: `sdlc-tdd-be-gate` hoặc `sdlc-tdd-fe-gate` với mode `full`.

### Gate Failure Protocol

```
GATE {light|full} FAIL: {N}/{total} checks failed

Failed:
  - L2: Hard Boundary — UserService truy cập trực tiếp vào Payment DB
  - L3: Query Safety — raw SQL concatenation trong UserRepository.java:45

Retry: agent fix trong worktree → chạy lại gate (max 2 retries)
Sau 2 retries vẫn fail → báo human với failure details
```

---

## Board Update Protocol

sdlc-cook **không tự sửa board/backlog** — spawn subagent chuyên biệt:

```javascript
// Board: cập nhật task status
Agent({
  subagent_type: "sdlc-sprint-board",
  description: "Update board for FEAT-001",
  prompt: `FR-{DOM}-{NNN} → {status}. Feature FEAT-{NNN}. Assignee: sdlc-cook.`
})

// Backlog: cập nhật feature status (sau merge)
Agent({
  subagent_type: "sdlc-sprint-backlog",
  description: "Update backlog for FEAT-001",
  prompt: "FEAT-{NNN} status → ✅ Done."
})
```

### Status Transition Map

| TDD Event | Board Status |
|-----------|-------------|
| Worktree created, workflow dispatched | 🚧 In Progress |
| INTERFERENCE detected | ⛔ Blocked |
| PR created | 👀 In Review |
| PR merged | ✅ Done |
| PR closed (not merged) | 🔲 Todo |
| Workflow crash | ⛔ Blocked |

