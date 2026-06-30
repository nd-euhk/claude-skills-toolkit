# Workflow `workflow-sdlc-explore-pipeline.js` — Thiết kế mới

## Context

Workflow cũ (`workflow-sdlc-ex-backup.js`) có 7 phase, xử lý **tất cả services** trong 1 lần chạy (system-wide). Mâu thuẫn với "1 service mỗi lần" của `sdlc-explore`.

**Mục tiêu:** Workflow mới chỉ xử lý **1 service**, output `knowledge/` chuẩn SDLC. System-wide để merge tổng riêng ở cuối.

## Pipeline (5 Phase)

```
Phase 0: Preflight → Phase 1: FR Discovery (per EPIC) → Phase 2: LLD (1 agent) → Phase 3: IMP+TST (per EPIC, ∥) → Phase 4: Service Notes
```

| Phase | Cơ chế | Output |
|-------|--------|--------|
| **0. Preflight** | 1 Explore agent check existing | Skip completed phases |
| **1. FR Discovery** | `pipeline` per EPIC, gate x3 retry | `FR-{EPIC}-{NNN}--{slug}.md` |
| **2. LLD** | 1 agent, gate x3 retry | `tech-design.md` |
| **3. IMP + TST** | `pipeline` per EPIC, IMP∥TST, gate x2 retry | `FR-*-impl.md`, `FR-*-test.md` |
| **4. Service Notes** | 1 agent tổng hợp | `.work/system-wide-notes/{service}.md` |

## Dynamic

- **fromPhase** — skill chọn điểm bắt đầu, Preflight skip trước đó
- **Gate-gated** — fail sau retry → partial/skip, không crash
- **Architect mode** — dừng sau LLD

## Args

```js
{ projectName, runDate, slug, scoutReports, language, mode, focusedService, epicCodes, fromPhase }
```

## Khác biệt chính vs cũ

| Cũ | Mới |
|----|-----|
| FR per scout area | **FR per EPIC** |
| NFR-Inference, HLD, LLD-Merge riêng | **Không — merge tổng** |
| LLD tất cả services | **LLD 1 service** |
| FR Distribution | **Không cần — đã per EPIC** |
| Sửa system-wide trực tiếp | **Chỉ notes → merge tổng xử lý** |

## ⚠️ TBD: System-Wide Merge
