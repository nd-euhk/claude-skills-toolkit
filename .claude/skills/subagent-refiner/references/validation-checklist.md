# Validation Checklist (7 Phases)

Bảng kiểm tra toàn diện cho validation subagent.

## Phase 1: Configuration

- [ ] `name` field tồn tại, lowercase-hyphen, ≤64 ký tự, unique
- [ ] `description` field tồn tại, ≤1024 ký tự, có trigger phrases cụ thể
- [ ] YAML frontmatter syntax hợp lệ (không lỗi parse)
- [ ] Tất cả field names viết đúng chính tả (model, không phải modeI)
- [ ] `tools` và `disallowedTools` không xung đột

## Phase 2: Delegation

- [ ] Description có trigger phrases Claude sẽ nhận diện không?
- [ ] Ví dụ: "Use when validating code before commit" → Claude sẽ nhận diện "validate code"
- [ ] Có cụm từ như "Use proactively" để khuyến khích delegation không?
- [ ] Description có đủ cụ thể để tránh false triggers không?

## Phase 3: Prompt (System Prompt Body)

- [ ] Có cấu trúc rõ ràng (Purpose → Key behaviors → Constraints → Examples)?
- [ ] Subagent hiểu rõ nhiệm vụ của mình không?
- [ ] Có hướng dẫn cụ thể về output format không?
- [ ] Có xử lý error cases không?
- [ ] Token hiệu quả (không lãng phí context window)?

## Phase 4: Tools

- [ ] Tuân thủ principle of least privilege?
- [ ] Mỗi tool được cấp có lý do chính đáng không?
- [ ] Có tool nào thiếu cần thêm không?
- [ ] Nếu dùng `tools` (allowlist), đã liệt kê đầy đủ chưa?
- [ ] Nếu dùng `disallowedTools` (denylist), đã chặn đúng tools nguy hiểm chưa?
- [ ] Bash được scoped với command patterns nếu cần?
- [ ] Subagent có thực sự cần Write/Edit không?

## Phase 5: Permissions

- [ ] `permissionMode` phù hợp với use case?
  - `default` → Interactive, từng bước cần approval
  - `acceptEdits` → Auto-accept file edits
  - `dontAsk` → Auto-deny prompts (read-only pattern)
  - `plan` → Read-only exploration
  - `bypassPermissions` → Chỉ dùng khi thực sự cần
- [ ] Nếu `background: true`, permission mode đã được cân nhắc chưa?
- [ ] Plugin subagents: permissionMode bị ignore (theo thiết kế của Claude Code)

## Phase 6: Hooks

- [ ] Nếu có hooks, đã validate cấu trúc JSON chưa? (nested `"hooks": [...]` array)
- [ ] Event đúng cho mục đích?
- [ ] Matcher chính xác (không quá rộng, không quá hẹp)?
- [ ] Exit codes đúng (0=success, 2=blocking, 1=non-blocking)?
- [ ] Timeout và onError được set?
- [ ] Command scripts parse stdin JSON đúng cách?
- [ ] Plugin subagents: hooks bị ignore (theo thiết kế của Claude Code)

## Phase 7: Testing / Production Readiness

- [ ] Subagent đã được test với real delegation scenarios chưa?
- [ ] Có cần `maxTurns` để giới hạn số lượt không?
- [ ] `memory` scope có phù hợp không (user/project/local)?
- [ ] `skills` preload có hữu ích không?
- [ ] `mcpServers` có cần thiết không?
- [ ] `isolation: worktree` có cần cho parallel execution không?
- [ ] `effort` level có phù hợp với task không?

## Severity Classification

| Mức độ | Tiêu chí |
|--------|----------|
| 🔴 **Critical** | Vi phạm bảo mật, hook sai gây hại, tool access quá rộng, Bash không giới hạn |
| 🟡 **Important** | Model không phù hợp, thiếu error handling, permission mode chưa tối ưu, thiếu maxTurns |
| 🟢 **Nice-to-have** | Prompt có thể rõ hơn, description có thể cải thiện, thiếu ví dụ |

## Remediation Priority

1. **Fix Critical issues trước** - Đây là các vấn đề ảnh hưởng đến bảo mật và an toàn
2. **Important issues** - Cải thiện độ tin cậy và hiệu suất
3. **Nice-to-have** - Polish, không ảnh hưởng đến functionality
