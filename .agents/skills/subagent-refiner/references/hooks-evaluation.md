# Hooks Evaluation Guide

Đánh giá chi tiết hooks trong subagent. Mỗi hook phải được kiểm tra về event, matcher, type, exit codes, error handling và cấu trúc.

## 1. Event Correctness

Hook có dùng đúng event không?

| Event | When it fires | Dùng cho |
|-------|---------------|----------|
| `PreToolUse` | Trước khi tool được thực thi | Validation, blocking, conditional access |
| `PostToolUse` | Sau khi tool thực thi thành công | Logging, linting, cleanup |
| `PostToolUseFailure` | Sau khi tool thực thi thất bại | Error logging, recovery |
| `Stop` / `SubagentStop` | Khi subagent kết thúc | Cleanup, summary |
| `UserPromptSubmit` | Khi user gửi prompt | Input validation |
| `SessionStart` | Khi session bắt đầu | Setup, environment check |
| `SessionEnd` | Khi session kết thúc | Cleanup, teardown |
| `PreCompact` | Trước khi context compaction | Save state, backup |

**Lỗi thường gặp:**
- Dùng `Stop` thay vì `PreToolUse` để validate tool calls
- Dùng `PostToolUse` cho validation (nên dùng PreToolUse)

## 2. Matcher Precision

Matcher là regex, case-sensitive.

**Nguyên tắc:**
- ✅ Chính xác: `^(Write|Edit)$` - matches exactly Write hoặc Edit
- ✅ File extension: `\.js$` - matches .js files
- ❌ Quá rộng: `.*` - matches everything (performance killer)
- ❌ Quá hẹp: regex không match được intended targets

**Các sự kiện không cần matcher:**
- `Stop`, `SubagentStop`, `SessionEnd`, `UserPromptSubmit`, `SessionStart` - có thể bỏ qua trường matcher

**MCP tools:** `mcp__<server>__<tool>` format (e.g., `mcp__memory__create_entities`)

## 3. Type Decision

| Type | Dùng khi | Không dùng khi |
|------|----------|----------------|
| `command` | Logic xác định (linting, validation) | Cần context/reasoning |
| `prompt` | Quyết định thông minh (chỉ cho Stop, SubagentStop, UserPromptSubmit, PermissionRequest, PreToolUse) | Deterministic logic |

## 4. Exit Codes (Command Hooks)

```
exit 0 = SUCCESS (không có lỗi)
exit 2 = BLOCKING ERROR (stderr hiển thị TRỰC TIẾP cho Claude - Claude có thể fix)
exit 1 = NON-BLOCKING ERROR (stderr chỉ hiện trong verbose mode, Claude không thấy)
```

**Quy tắc:** Nếu hook cần thông báo lỗi cho Claude → dùng `exit 2`. Nếu không → dùng `exit 0` hoặc `exit 1`.

## 5. Error Handling

Mỗi hook phải có:
- **timeout:** <1s cho sync, <10s cho async
- **onError:** `warn`, `fail`, hoặc `continue`
- **Validation:** Script parse input JSON đúng cách, xử lý edge cases

## 6. JSON Structure

**⚠️ CRITICAL: Tất cả hooks PHẢI có nested `"hooks": [...]` array.**

```json
// ✅ CORRECT
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [              // ← REQUIRED wrapper
          {
            "type": "command",
            "command": "./scripts/validate.sh",
            "timeout": 5000,
            "onError": "warn"
          }
        ]
      }
    ]
  }
}

// ❌ WRONG (missing nested hooks array)
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",      // ← ERROR
        "command": "..."
      }
    ]
  }
}
```

## 7. Command Hook Input Parsing

**⚠️ COMMON MISTAKE:** Environment variable substitution KHÔNG hoạt động.

```bash
# ❌ WRONG
"env": {"FILE_PATH": "${arguments.file_path}"}  # Không hoạt động!

# ✅ CORRECT
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
```

Command hooks nhận data qua **stdin as JSON**, không phải environment variables.

## 8. Security Checklist

- [ ] Hook scripts có validate input không?
- [ ] Có nguy cơ command injection từ `$COMMAND` không?
- [ ] Scripts có quyền thực thi không (`chmod +x`)?
- [ ] Hook có dùng `shell: powershell` cho Windows scripts không?
- [ ] `bypassPermissions` có thực sự cần thiết không?

## 9. Common Patterns

**Read-only database access:**
```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
```

**Code review with auto-linting:**
```yaml
hooks:
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
```
