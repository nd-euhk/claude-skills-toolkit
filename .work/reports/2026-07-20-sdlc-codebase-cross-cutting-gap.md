# sdlc-codebase: Cross-Cutting Gap — Đánh Giá & Kế Hoạch

**Ngày:** 2026-07-20
**Context:** 5 subagent cross-cutting `sdlc-lld-*` đã được tạo + tích hợp vào forward pipeline (orchestrator, automation). Reverse pipeline (`sdlc-codebase`) chưa có cross-cutting phase tương ứng.

---

## I. Hiện Trạng

### Forward Pipeline (đã có cross-cutting)
```
SRS → HLD → LLD → CROSS-CUTTING → IMP ∥ TST
                        │
                        ├── sdlc-lld-error-handling       → error-handling.md
                        ├── sdlc-lld-caching-strategy      → caching-strategy.md
                        ├── sdlc-lld-performance-test      → performance-test.md
                        ├── sdlc-lld-frontend-architecture → frontend-architecture.md
                        └── sdlc-lld-frontend-test-strategy → frontend-test-strategy.md (Stage 2)
```

### Reverse Pipeline (chưa có cross-cutting)
```
Scout → HLD → LLD → SRS → IMP ∥ TST
                            ↑
                            codebase-lld-synthesis có sinh cross-cutting.md
                            nhưng là 1 file tổng hợp, không tương đương 5 file chuẩn
```

## II. Lỗ Hổng

5 file cross-cutting chuẩn không có agent nào trong reverse pipeline chịu trách nhiệm:

| Output File | Forward Agent | Reverse Agent | Template |
|------------|---------------|---------------|----------|
| `error-handling.md` | `sdlc-lld-error-handling` | ❌ | `templates/supporting/error-handling-TEMPLATE.md` (212 dòng) |
| `caching-strategy.md` | `sdlc-lld-caching-strategy` | ❌ | `templates/supporting/caching-strategy-TEMPLATE.md` (158 dòng) |
| `performance-test.md` | `sdlc-lld-performance-test` | ❌ | `templates/supporting/performance-test-TEMPLATE.md` (308 dòng) |
| `frontend-architecture.md` | `sdlc-lld-frontend-architecture` | ❌ | `templates/supporting/frontend-architecture-TEMPLATE.md` (300 dòng) |
| `frontend-test-strategy.md` | `sdlc-lld-frontend-test-strategy` | ❌ | `templates/supporting/frontend-test-strategy-TEMPLATE.md` (757 dòng) |

**Vị trí trong reverse pipeline:** Sau SRS (vì `performance-test.md` cần NFRs từ SRS), trước IMP+TST.

## III. Phân Tích: Tái Dụng Agent Forward

Các `sdlc-lld-*` agents đọc input từ `agent_docs/`:
- `architecture.md` §1+§6 — do HLD sinh ✅
- `tech-design/{name}-service.md` — do LLD sinh ✅
- `contracts/error-codes.md` — do LLD synthesis sinh ✅
- `features/FR-*.md` (NFRs) — do SRS sinh ✅
- `hard-boundaries.md` — do HLD sinh ✅
- `frontend/{app}/api-routing.md` — do LLD sinh ✅

→ **Tất cả input đều có sẵn trong reverse pipeline.** Các agent forward có thể tái dụng, chỉ cần thêm `--mode reverse` context: "EXTRACT patterns from code artifacts" thay vì "DESIGN standards".

**Khác biệt chính:**
- Forward: agent quyết định standards → authoritative
- Reverse: agent quan sát patterns từ code → mỗi claim cần code evidence (file:line), flag UNCERTAIN nếu không đủ

## IV. Danh Sách Cập Nhật

| # | File | Thay đổi |
|---|------|----------|
| 1 | `skills/sdlc-codebase/SKILL.md` | Pipeline diagram + Step 2.5 smart detection + subagent table + hard boundaries |
| 2 | `skills/sdlc-codebase/references/flow-reverse.md` | Thêm Phase CROSS-CUTTING (sau SRS, trước IMP+TST): scope detection, 2-stage spawn, expected outputs |
| 3 | `skills/sdlc-codebase/references/procedures.md` | Thêm Cross-Cutting Gate (6 checks), Explore patterns, progress reporting |
| 4 | `agents/sdlc/sdlc-lld-*.md` (5 files) | Thêm reverse mode context: "Khi reverse: extract từ code artifacts, flag UNCERTAIN" |
| 5 | `workflows/codebase/workflow-codebase-reverse.js` | Thêm cross-cutting phase: scope detection → Stage 1 ∥ 4 → barrier → Stage 2 |
| 6 | `scripts/sdlc-validate-agent-output.sh` | Đảm bảo codebase workflow context không bị chặn (nếu cần) |
| 7 | `.claude-plugin/plugin.json` | Tạo nếu chưa có, bump version |
| 8 | `CHANGELOG.md` | Thêm entries cho cross-cutting trong reverse pipeline |

### Pipeline mới sau cập nhật:
```
Scout → HLD → 🚦Gate → LLD → 🚦Gate → SRS → 🚦Gate → CROSS-CUTTING → 🚦Gate → IMP∥TST → 🚦Gate → Report
                                                    │
                          Stage 1 (∥): error-handling | caching-strategy | performance-test | frontend-architecture
                          Barrier: đợi error-handling + frontend-architecture
                          Stage 2: frontend-test-strategy
```

### Scope Detection (tự động từ file):
| File | Điều kiện chạy |
|------|---------------|
| `error-handling.md` | Luôn nếu có ≥1 backend service |
| `caching-strategy.md` | `architecture.md` §6 khai báo Redis/Caffeine |
| `performance-test.md` | `features/FR-*.md` có NFR-PERF-* quantified |
| `frontend-architecture.md` | `architecture.md` §1 có frontend service |
| `frontend-test-strategy.md` | frontend-architecture được chọn ở Stage 1 |

## V. Thứ Tự Thực Hiện

```
1. flow-reverse.md      — Thêm cross-cutting phase (scope detection, spawn, outputs)
2. procedures.md        — Gate criteria + Explore patterns + report templates
3. SKILL.md             — Pipeline diagram + subagent table + smart detection
4. sdlc-lld-*.md (x5)  — Thêm reverse mode context vào mỗi agent
5. workflow-codebase-reverse.js — Thêm cross-cutting phase vào workflow script
6. Validate              — Chạy thử dry-run với 1 codebase mẫu
7. Version + CHANGELOG  — Bump plugin version
```

---

*Report này tổng hợp đánh giá gap giữa forward cross-cutting agents và reverse pipeline. Dùng làm plan cho implementation tiếp theo.*
