---
name: sdlc-flow-contract
description: >-
  Luồng Thay Đổi Giao Kèo Microservices (Breaking Contract Change) trong kho
  knowledge/. Xử lý khi API/Event/Error code thay đổi: cập nhật TẬP TRUNG tại
  02-central-contracts/ → dò tìm service bị ảnh hưởng → cascade xuống từng
  service. Chế độ thủ công với human-in-the-loop: xác nhận breaking change,
  duyệt impact map trước khi cascade.
user-invocable: false
version: 1.0.0
argument-hint: "<contract-name> <service>"
allowed-tools: Read, Write, Bash(*), Glob, Grep, Agent, Skill, TaskCreate, TaskUpdate, TaskGet, TaskList, EnterPlanMode, ExitPlanMode, AskUserQuestion
---

# Flow contract: Thay Đổi Giao Kèo Microservices (Breaking Contract Change)

Bạn thực thi luồng thay đổi giao kèo — luồng NGUY HIỂM NHẤT trong microservices.
Một service thay đổi API/Event/Error code có thể làm sập toàn bộ hệ thống.

**Nguyên tắc sống còn:** Sửa TẬP TRUNG tại `02-central-contracts/` TRƯỚC,
sau đó CASCADE xuống từng service bị ảnh hưởng.

**Trigger:** Tech Lead hoặc Architect quyết định thay đổi payload API, Kafka
Events, hoặc định nghĩa thêm nhóm mã lỗi mới.

## Sơ Đồ Luồng

```
Quyết định thay đổi Contract
      ↓
① Brainstorming (phân tích impact, xác định breaking vs non-breaking)
      ↓ EnterPlanMode → phê duyệt
② k-contract-updater → Cập nhật TẬP TRUNG 02-central-contracts/
      ↓ EnterPlanMode → phê duyệt
③ k-orchestrator → Dò tìm service bị ảnh hưởng → Tạo Impact Map
      ↓ EnterPlanMode → phê duyệt
④ k-orchestrator → Cascade xuống từng service bị ảnh hưởng
   ├── Provider service: k-impl-writer + k-techdesign-updater
   ├── Consumer 1: k-impl-writer + k-test-writer + k-techdesign-updater
   ├── Consumer 2: k-impl-writer + k-test-writer + k-techdesign-updater
   └── ...
      ↓ Tổng hợp kết quả
⑤ Bắn tín hiệu đồng loạt xuống các Repo Source Code
```

## Quy Trình Chi Tiết

### Bước 0: Nhận Context

Từ `sdlc` orchestrator, bạn nhận:
- **Contract thay đổi:** API/Event/Error code nào
- **Mô tả thay đổi:** Thay đổi gì, tại sao
- **Breaking?:** Có backward-compatible không
- **Initiator:** Tech Lead / Architect
- **Service sở hữu:** Service nào sở hữu contract này

### Bước 1: Brainstorming — Phân Tích Impact

Gọi `Agent(brainstormer)` để phân tích cùng con người:
- Breaking change hay không?
- Những service nào sẽ bị ảnh hưởng?
- Migration path: làm sao để consumer migrate dần?
- Có cần versioning API không (v1 → v2)?
- Cần ADR không? (cho thay đổi lớn)

### Bước 2: EnterPlanMode → Cập Nhật Central Contracts

**ĐÂY LÀ BƯỚC SỐNG CÒN — phải làm trước tiên.**

1. Xác định file cần sửa trong `knowledge/02-central-contracts/`:
   - `apis/api-{service}.yaml`
   - `events/evt-{event}.yaml`
   - `global-error-codes.md`

2. Vào `EnterPlanMode` — trình bày:
   - File contract nào sẽ sửa
   - Thay đổi cụ thể (before → after)
   - Breaking change: YES/NO
   - Nếu breaking: migration path cho consumer

3. Sau khi phê duyệt, gọi:
   ```
   Agent(k-contract-updater) với:
   - Change type: "change-api" | "change-event" | "change-error"
   - Service: {service}
   - Breaking: true/false
   - Change details: {mô tả}
   ```

4. Verify: contract file đã được cập nhật, có tag `**BREAKING CHANGE**` nếu cần.

### Bước 3: EnterPlanMode → Dò Tìm & Impact Map

1. Gọi `k-orchestrator` để dò tìm dependencies:
   ```
   Agent(k-orchestrator) với:
   - Change source: {file contract vừa sửa}
   - Mode: "impact-analysis"
   ```

2. Orchestrator sẽ đọc toàn bộ `knowledge/04-microservices/*/tech-design.md`
   để tìm service nào reference contract này.

3. Vào `EnterPlanMode` — trình bày Impact Map cho con người:
   ```
   | # | Service | Role | Impact | Action |
   |---|---------|------|--------|--------|
   | 1 | wallet-core | Provider | HIGH | Cập nhật IMP |
   | 2 | payment-gateway | Consumer | HIGH | Cập nhật IMP + TST + Client |
   | 3 | reconciliation | Consumer | MEDIUM | Cập nhật Error Handling |
   ```

4. Con người xác nhận danh sách service cần cascade.

### Bước 4: EnterPlanMode → Cascade Update

1. Vào `EnterPlanMode` — trình bày kế hoạch cascade:
   - Thứ tự: Provider trước, Consumers sau
   - Consumers nào độc lập → song song
   - Những file nào sẽ được cập nhật ở mỗi service

2. Sau khi phê duyệt, gọi `k-orchestrator` ở chế độ cascade:
   ```
   Agent(k-orchestrator) với:
   - Mode: "cascade"
   - Affected services: [{danh sách}]
   - Contract change: {mô tả}
   ```

   Orchestrator sẽ dispatch:
   - Provider: `k-impl-writer` → cập nhật IMP spec
   - Mỗi Consumer: `k-impl-writer` + `k-test-writer` (song song) → cập nhật specs
   - Tất cả: `k-techdesign-updater` → cập nhật REST client specs

### Bước 5: Tổng Hợp & Bắn Tín Hiệu

```markdown
📊 Flow contract — Kết Quả Thay Đổi Giao Kèo

**Contract:** {file}
**Loại thay đổi:** API / Event / Error Code
**Breaking:** YES / NO
**Ngày:** {YYYY-MM-DD}

### Impact Map
| # | Service | Role | Impact | Status |
|---|---------|------|--------|--------|
| 1 | {svc} | Provider | HIGH | ✅ |
| 2 | {svc} | Consumer | HIGH | ✅ |
| 3 | {svc} | Consumer | MEDIUM | ✅ |

### Files Đã Sửa
| File | Service | Agent | Trạng Thái |
|------|---------|-------|-----------|
| knowledge/02-central-contracts/... | (global) | k-contract-updater | ✅ |
| knowledge/04-microservices/{svc}/FR-...-impl.md | {svc} | k-impl-writer | ✅ |
| knowledge/04-microservices/{svc}/FR-...-test.md | {svc} | k-test-writer | ✅ |
| knowledge/04-microservices/{svc}/tech-design.md | {svc} | k-techdesign-updater | ✅ |

### Bước Tiếp Theo
▶️ Bắn tín hiệu ĐỒNG LOẠT xuống các repo source code:
   - {svc}: cập nhật API implementation
   - {svc}: cập nhật REST client
   - {svc}: cập nhật error handling
```

## Subagents Sử Dụng

| Agent | Mục Đích | Khi Nào Dùng |
|-------|---------|-------------|
| `k-contract-updater` | Cập nhật 02-central-contracts/ | Luôn luôn — bước đầu tiên |
| `k-orchestrator` | Dò tìm dependencies + cascade | Luôn luôn — bước 2 & 4 |
| `k-impl-writer` | Cập nhật IMP specs | Mỗi service bị ảnh hưởng |
| `k-test-writer` | Cập nhật TST specs | Mỗi consumer service |
| `k-architect-reviewer` | ADR (nếu cần) | Thay đổi lớn, cần ghi nhận |

## Cờ Cảnh Báo

- 🚨 **Breaking Change** → Phải có migration path
- 🚨 **Provider trước, Consumer sau** → Không làm ngược lại
- 🚨 **Tập trung tại 02-central-contracts/** → Không sửa rải rác
- 🚨 **Impact map phải được con người duyệt** → Không cascade mù quáng

## Chống Mẫu

- Không sửa contract trực tiếp trong service folder — luôn qua 02-central-contracts/
- Không cascade khi chưa có impact map được duyệt
- Không bỏ qua service nhỏ — một consumer nhỏ cũng có thể sập nếu không cập nhật
- Không quên provider service — nơi sở hữu contract cũng phải cập nhật
- Không bỏ qua versioning — breaking change phải có phiên bản mới

## Tham Khảo

- `../sdlc/references/shared-patterns.md` — EnterPlanMode, brainstorming với Agent(brainstormer), error recovery khi subagent fail, dispatch conventions (provider→consumer)
- `../sdlc/references/report-templates.md` — Mẫu báo cáo Flow contract
