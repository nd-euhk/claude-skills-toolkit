# Error Handling — SDLC Quick

Các error scenario và fallback pattern cho skill `sdlc-quick`.

---

## Error Categories

### E1: Preflight Failures

#### E1.1 Git dirty — human chọn Abort

**Detect**: `AskUserQuestion` trả về "Abort"
**Response**:
```
⏹️  Quick flow dừng theo yêu cầu.
   Working tree: [git status summary]
   Đề xuất: commit hoặc stash changes trước khi chạy lại.
```
**Next step**: Dừng hoàn toàn. Không retry, không fallback.

#### E1.2 Trivial gate fail — preflight

**Detect**: Trivial gate (5 criteria) có ≥1 FAIL
**Response**: Xem `references/escalation.md` → Trigger 1
**Next step**: Escalate. Không grill.

---

### E2: Triage Grill Failures

#### E2.1 Không đạt exit criteria sau grill

**Detect**: Sau 3 rounds, thiếu ≥1 exit criteria bắt buộc
**Response**:
```
⚠️  Chưa đủ thông tin để xác nhận trivial.
   Thiếu: [list missing criteria]
   Không thể proceed với quick flow nếu chưa chắc chắn về scope.

   Đề xuất:
   1. Chuyển sang /sdlc-orchestrator (phù hợp khi scope chưa rõ)
   2. Tự research và quay lại quick flow sau
```
**Next step**: `AskUserQuestion` cho 2 options. Default → escalate.

#### E2.2 Human muốn skip triage

**Detect**: Human nói "skip", "tôi biết nó trivial", "không cần hỏi"
**Response**:
```
⚠️  Triage grill là bắt buộc trong quick flow — không thể skip.
   Mục đích: xác nhận task thực sự trivial trước khi bỏ qua full specs pipeline.
   Nếu bạn muốn bỏ qua grill → dùng /sdlc-automation hoặc /sdlc-orchestrator.
```
**Next step**: Giữ nguyên. Nếu human insist → escalate.

#### E2.3 Human không thể trả lời round 2 (Safety Check)

**Detect**: Round 2 trả về "Không chắc"
**Response**: Xem `references/escalation.md` → Trigger 3
**Next step**: Escalate. Không thể proceed nếu không chắc về safety.

---

### E3: Subagent Failures

#### E3.1 RED agent fail (Path B)

**Detect**: `sdlc-tdd-be-red` hoặc `sdlc-tdd-fe-red` return BLOCKED
**Response**:
```
🔴 Không thể viết guard test — RED agent blocked.

   Lý do: [từ agent output]
   Điều này có thể có nghĩa:
   - Codebase không có test infrastructure phù hợp
   - Scope thay đổi rộng hơn dự kiến (cần setup test phức tạp)
   - Không thể isolate thay đổi để test độc lập

   Đề xuất: Chuyển sang /sdlc-orchestrator (flow task)
   - Setup test infrastructure nếu thiếu
   - Hoặc flow fixbug nếu đây là bug cần test phức tạp

   Options:
   1. Chuyển orchestrator
   2. Thử lại RED với approach khác (max 1 retry)
```
**Next step**: `AskUserQuestion`. Max 1 retry, sau đó escalate.

#### E3.2 GREEN agent fail (Path A hoặc B)

**Detect**: `sdlc-tdd-be-green` hoặc `sdlc-tdd-fe-green` fail
**Response**:
```
🛑 Implement thất bại: [error từ agent]

   Options:
   1. Thử lại (max 1 retry)
   2. Chuyển sang orchestrator
```
**Next step**: `AskUserQuestion`. Max 1 retry.

#### E3.3 RED agent return STALE (accidental green)

**Detect**: RED agent báo STALE — test pass ngay không cần implement
**Response**:
```
🟡 Guard test accidental green — code đã có sẵn behavior mong muốn.

   Điều này có thể có nghĩa:
   - Task đã được implement từ trước (trùng lặp)
   - Hoặc behavior đã tồn tại trong codebase

   Options:
   1. Bỏ qua implement, chạy GATE-light để verify
   2. Chuyển sang orchestrator nếu cần điều tra thêm
```
**Next step**: Nếu human chọn 1 → chuyển thẳng GATE-light (skip GREEN).

---

### E4: Gate Failures

#### E4.1 GATE-light FAIL

**Detect**: `sdlc-tdd-be-gate` hoặc `sdlc-tdd-fe-gate` return FAIL
**Response**: Xem `references/escalation.md` → Trigger 4
**Next step**: Escalate. Không retry — gate fail = scope lớn hơn trivial.

---

### E5: Review Escalation

#### E5.1 Code review phát hiện vấn đề lớn

**Detect**: `sdlc-review-codechange` return findings ở mức bug hoặc security
**Response**: Xem `references/escalation.md` → Trigger 5
**Next step**: Đề xuất orchestrator (flow cr hoặc fixbug).

#### E5.2 Review phát hiện cần refactor đáng kể

**Detect**: Review findings yêu cầu refactor > phạm vi file hiện tại
**Response**:
```
👀 Review đề xuất refactor ngoài phạm vi quick flow:
   [danh sách refactor findings]

   Refactor rộng không phù hợp với quick flow.
   Đề xuất: /sdlc-orchestrator (flow task) nếu refactor đáng kể.
   Hoặc: bỏ qua refactor suggestions, chỉ fix bug/security findings.
```
**Next step**: Hỏi human chọn hướng.

---

### E6: Sprint Update Failures

#### E6.1 Sprint skill fails

**Detect**: `Skill("sprint")` fails
**Response**:
```
⚠️  Sprint update thất bại: [error]
   Code đã được implement và review thành công, nhưng board chưa được cập nhật.
   Đề xuất: Chạy /sprint --board thủ công sau khi kết thúc.
```
**Next step**: Tiếp tục — non-blocking error.

---

## General Fallback Pattern

Khi gặp bất kỳ error không có trong danh sách trên:

```
⚠️  Lỗi không mong đợi trong quick flow: [error]
   Phase hiện tại: [phase]
   Đề xuất: Chuyển sang /sdlc-orchestrator để xử lý với human review.
   Quick flow không được thiết kế để xử lý edge cases phức tạp.
```

**Nguyên tắc chung**: Quick flow fail-safe. Khi có lỗi, luôn fallback về orchestrator
thay vì cố gắng fix trong quick flow (vốn không có cơ chế xử lý phức tạp).
