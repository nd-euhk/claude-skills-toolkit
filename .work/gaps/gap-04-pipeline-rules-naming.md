# GAP-4: Pipeline Rules Cross-Cutting Names Không Nhất Quán

**Severity:** LOW | **Effort:** XS | **Status:** done

## Phân Tích

`sdlc-pipeline.md:19` liệt kê forward pipeline CROSS-CUTTING agents với tên rút gọn:

```
| CROSS-CUTTING | `sdlc-lld-error-handling`, `caching-strategy`, `performance-test`,
  `frontend-architecture`, `frontend-test-strategy` | ...
```

Thực tế tất cả 5 agents đều có prefix `sdlc-lld-`:

| Tên trong pipeline rule | Tên thực tế |
|------------------------|------------|
| `sdlc-lld-error-handling` | `sdlc-lld-error-handling` ✅ |
| `caching-strategy` | `sdlc-lld-caching-strategy` ❌ |
| `performance-test` | `sdlc-lld-performance-test` ❌ |
| `frontend-architecture` | `sdlc-lld-frontend-architecture` ❌ |
| `frontend-test-strategy` | `sdlc-lld-frontend-test-strategy` ❌ |

## Impact

Thấp — bảng chỉ để minh họa concept, không dùng để resolve agent. Nhưng gây confusion khi ai đó cố tìm agent `caching-strategy` thay vì `sdlc-lld-caching-strategy`.

## Fix Plan

### Checklist

- [x] Sửa `sdlc-pipeline.md:19` — dùng full agent names với prefix `sdlc-lld-`:
  ```
  | CROSS-CUTTING | `sdlc-lld-error-handling`, `sdlc-lld-caching-strategy`,
    `sdlc-lld-performance-test`, `sdlc-lld-frontend-architecture`,
    `sdlc-lld-frontend-test-strategy` | ...
  ```

## Files Liên Quan

- `.claude/rules/sdlc-pipeline.md:19` — forward pipeline phase table
