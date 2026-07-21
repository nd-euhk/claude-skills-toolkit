# GAP-3: Validation Script Thiếu `codebase-gate` Case

**Severity:** LOW | **Effort:** XS | **Status:** done ✅

## Phân Tích

`sdlc-validate-agent-output.sh` dùng `case "$PHASE"` để match phase name → validate output paths. Danh sách phases hiện tại:

```
sdlc-srs | codebase-srs | codebase-srs-verify
codebase-srs-synthesis
codebase-lld-synthesis
sdlc-hld | codebase-hld
sdlc-lld | codebase-lld
sdlc-lld-error-handling | codebase-cross-cutting-error-handling
sdlc-lld-caching-strategy | codebase-cross-cutting-caching-strategy
sdlc-lld-performance-test | codebase-cross-cutting-performance-test
sdlc-lld-frontend-architecture | codebase-cross-cutting-frontend-architecture
sdlc-lld-frontend-test-strategy | codebase-cross-cutting-frontend-test-strategy
sdlc-imp | codebase-imp
sdlc-tst | codebase-tst
sdlc-sprint-board
sdlc-sprint-backlog
sdlc-sprint-roadmap
* → "Unknown phase"
```

**Thiếu**: `codebase-gate`

## Impact

Thấp — `codebase-gate` là read-only agent (chỉ Read + Bash), nên hook có thể không được áp dụng. Nhưng nếu hook được áp dụng cho tất cả agents, sẽ in `Unknown phase 'codebase-gate'` ra stderr mỗi lần gate agent chạy.

## Fix Plan

### Checklist

- [x] Thêm `codebase-gate` case gộp với `sdlc-gate` (cùng pattern defense-in-depth, block Write/Edit/Bash, message dùng $PHASE variable)
  ```bash
  codebase-gate)
    # Read-only agent — no output validation needed
    exit 0
    ;;
  ```
- [x] (Đã có sẵn từ GAP-1) `sdlc-gate` case đã tồn tại — gộp chung `codebase-gate` vào cùng case

## Files Liên Quan

- `.claude/scripts/sdlc-validate-agent-output.sh:110-113` — catch-all case
- `.claude/agents/codebase/codebase-gate.md` — agent definition
