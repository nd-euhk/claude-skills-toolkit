# Error Handling Patterns — sdlc-explore v3

Tất cả error handling patterns cho cả explore pipeline (Phase 4) và system-wide merge (Phase 7). Mỗi pattern đều có human-in-the-loop — Claude PHẢI dùng AskUserQuestion, không tự quyết định.

## Overview

| Pattern | Context | Trigger | Hành vi |
|---------|---------|---------|---------|
| **FR partial fail** | Explore Phase 4 | 1+ EPIC gate fail | AskUserQuestion: Retry / Skip / Abort |
| **LLD blocking fail** | Explore Phase 4 | Gate fail sau 3 retries | AskUserQuestion: Retry / Skip LLD / Abort |
| **IMP/TST partial fail** | Explore Phase 4 | 1+ group gate fail | AskUserQuestion: Retry / Skip / Abort |
| **C4 gate fail** | Merge Phase 7 | Gate fail sau 2 retries | AskUserQuestion: Retry C4 / Skip / Abort |
| **Events/APIs partial** | Merge Phase 7 | 1+ event/API fail | AskUserQuestion: Retry failed / Skip / Abort |

## Explore Pipeline Patterns (Phase 4)

### Pattern 1: FR-Discovery Partial Failure (per EPIC)

**Khi:** Workflow trả về FR-Discovery gate fail cho 1+ EPIC.

```
→ Hiển thị: "FR-Discovery gate failed for EPIC {code}. Other EPICs passed."
→ AskUserQuestion: (header: "FR Gate Failure")
   - "Thử lại EPIC bị fail" → re-invoke workflow với fromPhase='FR-Discovery' (completed EPICs tự skip)
   - "Bỏ qua EPIC này" → tiếp tục với FRs đã khám phá (không có FR cho EPIC bị fail)
   - "Dừng pipeline" → dừng explore, cập nhật state với kết quả partial
```

### Pattern 2: LLD Failure → Blocking

**Khi:** Workflow trả về LLD gate fail cho service sau 3 retries.

```
→ Hiển thị: "LLD gate failed for {service} after 3 retries."
→ Hiển thị feedback từ gate verifier (nếu có)
→ AskUserQuestion: (header: "LLD Gate Failure")
   - "Thử lại LLD" → re-invoke workflow với fromPhase='LLD'
   - "Bỏ qua LLD" → tiếp tục không có tech-design.md (IMP+TST thiếu context, Service Notes kém chi tiết)
   - "Dừng pipeline" → dừng explore, cập nhật state với kết quả partial
```

### Pattern 3: IMP/TST Group Partial Failure (per EPIC)

**Khi:** Workflow (full mode) trả về 1+ IMP hoặc TST group gate fail.

```
→ Hiển thị: "IMP gate failed for EPIC {code}" hoặc "TST gate failed for EPIC {code}"
→ AskUserQuestion: (header: "IMP/TST Gate Failure")
   - "Thử lại" → spawn agents thủ công cho group bị fail, hoặc re-invoke với fromPhase='IMP+TST'
   - "Bỏ qua" → tiếp tục với groups đã pass (EPIC bị fail sẽ không có impl/test specs)
   - "Dừng pipeline" → dừng explore, cập nhật state với kết quả partial
```

## System-Wide Merge Patterns (Phase 7)

### Pattern M1: C4 Gate Failure

**Khi:** Merge workflow trả về C4 gate fail sau 2 retries.

```
→ Hiển thị: "C4 gate failed after 2 retries."
→ Hiển thị feedback từ gate verifier (nếu có)
→ AskUserQuestion: (header: "C4 Gate Failure")
   - "Thử lại C4" → re-invoke merge workflow với fromPhase='C4+Coding+Errors'
   - "Bỏ qua C4" → gọi workflow với fromPhase='HardBoundaries+CrossCutting' (context hạn chế)
   - "Dừng merge" → dừng merge, báo cáo kết quả partial
```

### Pattern M2: Events/APIs Partial Failure

**Khi:** Merge workflow trả về partial: Events X/N, APIs Y/N.

```
→ Hiển thị: "{N} events failed to generate." hoặc "{M} APIs failed."
→ AskUserQuestion: (header: "Events/APIs Partial")
   - "Thử lại các mục fail" → re-invoke với fromPhase='Events+APIs'
   - "Chấp nhận kết quả partial" → tiếp tục merge với những gì đã tạo
   - "Dừng merge" → dừng merge
```

## Manual Override — Khi Workflow Không Khả Dụng

Fallback khi `Workflow` tool không khả dụng:

1. Báo: "Workflow tool unavailable. Falling back to manual Phase 4 orchestration."
2. Thực thi Phase 4 thủ công — spawn agents tuần tự:
   - Preflight (1 Explore agent check existing outputs)
   - FR discovery per EPIC (1 agent per EPIC code)
   - Gate verifier (1 agent per FR EPIC)
   - LLD (1 agent, writes tech-design.md)
   - Gate verifier (1 agent for LLD)
   - IMP + TST per EPIC (parallel per EPIC group)
   - Gate verifier (1 agent per IMP/TST group)
   - Service Notes (1 agent)
3. Kết quả tương đương — chỉ khác cơ chế thực thi.

## State Update Sau Lỗi

Khi có partial failure, state update ghi nhận `status: "partial"`:

```js
state.history.push({
  action: 'explore',
  projects: [serviceName],
  timestamp: now,
  status: 'partial',  // không phải 'completed'
  failedPhases: ['FR-Discovery:EPIC_WAL', 'LLD']
})
```
