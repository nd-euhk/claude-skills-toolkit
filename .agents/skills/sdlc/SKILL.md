---
name: sdlc
description: >-
  Điều phối SDLC toàn diện dựa trên kho knowledge/ — trái tim điều phối của hệ
  thống microservices. Tự động phát hiện loại luồng (task, fixbug, cr, contract,
  compliance) từ ngữ cảnh và dispatch đến skill flow tương ứng. Dùng khi có yêu
  cầu phát triển tính năng mới, sửa lỗi/sự cố, yêu cầu thay đổi tính năng đã
  hoàn thiện, thay đổi giao kèo microservices, hoặc cập nhật kiến trúc & tiêu
  chuẩn. Hỗ trợ chế độ thủ công (human-in-the-loop) với brainstorming tương tác
  và xác nhận từng bước. Gọi /sdlc để bắt đầu.
version: 1.1.0
argument-hint: "[task|fixbug|cr|contract|compliance] [service] [ticket-id]"
allowed-tools: Read, Write, Bash(*), Glob, Grep, Agent, Skill, TaskCreate, TaskUpdate, TaskGet, TaskList, EnterPlanMode, ExitPlanMode, AskUserQuestion
---

# SDLC — Trình Điều Phối Trung Tâm

Bạn là trình điều phối trung tâm cho toàn bộ luồng SDLC dựa trên kho `knowledge/`.
Nhiệm vụ của bạn là: **phát hiện loại luồng → xác nhận với con người → dispatch
đến skill flow tương ứng → tổng hợp kết quả.**

Kiến trúc thư mục `knowledge/`:

```
knowledge/
├── README.md                        # Portal điều hướng
├── 01-global-standards/             # [QUY TẮC CHUNG] Áp dụng 100% services
├── 02-central-contracts/            # [GIAO KÈO TẬP TRUNG] APIs, Events, Error Codes
├── 03-system-architecture/          # [KIẾN TRÚC TỔNG THỂ] C4, ADRs
└── 04-microservices/                # [FLAT BUCKETS] Theo từng Service
    ├── payment-gateway/
    ├── wallet-core/
    └── reconciliation/
```

## 5 Luồng Vận Hành Cốt Lõi

| Flow | Trigger | Skill Dispatch |
|------|---------|---------------|
| **task** | Phát triển tính năng mới — Jira ticket "To Do", PRD chốt | `sdlc-flow-task` |
| **fixbug** | Sửa lỗi & sự cố — QA fail, Production incident (P1/P2) | `sdlc-flow-fixbug` |
| **cr** | Yêu cầu thay đổi — Task Done/In Review cần sửa đổi hành vi | `sdlc-flow-cr` |
| **contract** | Thay đổi giao kèo — API/Event/Error code breaking change | `sdlc-flow-contract` |
| **compliance** | Cập nhật kiến trúc & chuẩn — Security team, Architect quyết định | `sdlc-flow-compliance` |

## Quy Trình

### Bước -1: Vagueness Gate

Trước khi bắt đầu, đánh giá mức độ rõ ràng của input:

**Input rõ ràng** (ít nhất 2 trong 3 điều kiện sau):
- Có keyword flow rõ ràng (task/fixbug/cr/contract/compliance hoặc từ đồng nghĩa trong Bước 1)
- Có service hoặc domain được đề cập
- Có ticket ID, PRD, hoặc bug description cụ thể

→ **Skip Bước -1**, vào thẳng Bước 0.

**Input mơ hồ** (thiếu 2/3 điều kiện trên, hoặc input < 10 từ không có context):

→ Gọi `Skill(grill-me)` để làm rõ goal trước:
```
Skill(grill-me):
  - Phỏng vấn user để xác định: what/why/scope/service
  - Output: plan.md với objective, scope, constraints đã chốt
```
→ Sau khi grill-me hoàn thành, dùng plan output làm input cho Bước 0.

> **Ví dụ mơ hồ:** "làm thêm tính năng thanh toán", "fix cái lỗi hôm qua", "cập nhật service"
> **Ví dụ rõ ràng:** "task: thêm API refund cho payment-gateway theo PRD-123", "fixbug: P2 wallet-core transaction timeout"

---

### Bước 0: Xác Định Phạm Vi

Hỏi con người bằng `AskUserQuestion`:

```
1. Có knowledge/ chưa? Nếu chưa → tạo cấu trúc từ template
2. Service nào bị ảnh hưởng?
3. Flow nào đang cần chạy?
4. Có ticket/PRD tham chiếu không?
```

Nếu `knowledge/` chưa tồn tại, tạo cấu trúc cơ bản:

```
knowledge/
├── README.md
├── 01-global-standards/
│   ├── hard-boundaries.md
│   ├── coding-conventions.md
│   └── cross-cutting-patterns.md
├── 02-central-contracts/
│   ├── apis/
│   ├── events/
│   └── global-error-codes.md
├── 03-system-architecture/
│   ├── C4-context-diagram.md
│   └── ADRs/
└── 04-microservices/
    └── {service}/
        └── tech-design.md
```

### Bước 1: Phát Hiện Flow

Dựa trên input của con người, xác định flow:

**task — New Feature:**
- Keywords: "tính năng mới", "feature", "PRD", "user story", "requirement mới", "phát triển", "làm mới"
- Trigger: Jira ticket mới, PRD được chốt
- Hỏi: "Có PRD chưa? Epic slug là gì? Service nào?"

**fixbug — Bug Fix:**
- Keywords: "lỗi", "bug", "sập", "incident", "sự cố", "production", "P1", "P2", "không hoạt động", "test fail"
- Trigger: QA test fail, Production monitoring alert
- Hỏi: "Bug description? FR nào liên quan? Là lỗi logic hay hạ tầng?"

**cr — Change Request:**
- Keywords: "thay đổi", "sửa đổi", "chỉnh sửa", "điều chỉnh", "cập nhật tính năng", "change request", "thay đổi yêu cầu", "làm lại", "modify", "revise"
- Trigger: Task Done/In Review cần thay đổi hành vi — không phải bug, không phải tính năng mới
- Hỏi: "Task nào cần thay đổi? HLD có bị ảnh hưởng không? LLD có bị ảnh hưởng không? FR nào bị ảnh hưởng?"

**contract — Contract Change:**
- Keywords: "đổi API", "thay đổi contract", "breaking change", "event mới", "mã lỗi mới", "giao kèo", "interface"
- Trigger: Tech Lead/Architect quyết định
- Hỏi: "Contract nào thay đổi? Có backward-compatible không? Những service nào bị ảnh hưởng?"

**compliance — Compliance Update:**
- Keywords: "chuẩn mới", "bảo mật", "security policy", "kiến trúc", "ADR", "coding convention", "hard boundary"
- Trigger: Security team, Architect team
- Hỏi: "Chuẩn nào thay đổi? Có ADR không? Phạm vi ảnh hưởng?"

Nếu không rõ flow, dùng `Agent(brainstormer)` để phân tích và hỏi lại con người.

### Bước 2: EnterPlanMode — Lập Kế Hoạch

Sau khi xác định flow, vào `EnterPlanMode`:

1. Tóm tắt flow được chọn và lý do
2. Liệt kê các bước cụ thể sẽ thực thi
3. Dự kiến các file sẽ bị tác động trong `knowledge/`
4. Trình bày cho con người phê duyệt

### Bước 3: Dispatch

Sau khi được phê duyệt, dispatch đến skill flow tương ứng:

| Flow | Skill |
|------|-------|
| task | `Skill(sdlc-flow-task)` |
| fixbug | `Skill(sdlc-flow-fixbug)` |
| cr | `Skill(sdlc-flow-cr)` |
| contract | `Skill(sdlc-flow-contract)` |
| compliance | `Skill(sdlc-flow-compliance)` |

Truyền context đầy đủ:
- Service name
- Ticket/PRD reference (nếu có)
- Brainstorming context
- Các quyết định từ plan đã duyệt

### Bước 4: Tổng Hợp

Sau khi flow skill hoàn thành, tổng hợp kết quả:

```
📊 SDLC — Kết Quả Thực Thi

**Flow:** {task|fixbug|cr|contract|compliance}
**Service:** {service}
**Ngày:** {YYYY-MM-DD}

### Files Đã Tạo/Sửa
| File | Hành Động | Agent |
|------|----------|-------|
| knowledge/... | created/updated | k-xxx |

### Tóm Tắt
- {tóm tắt kết quả}

### Bước Tiếp Theo
- {gợi ý bước tiếp theo nếu cần}
```

## Bảng Phân Công Agent

Mỗi flow dispatch đến đúng agent:

| Nhiệm Vụ | Agent | Kiến Thức |
|----------|-------|----------|
| Viết FR spec | `k-spec-writer` | 04-microservices/{svc}/ |
| Viết IMP spec | `k-impl-writer` | 04-microservices/{svc}/ |
| Viết TST spec | `k-test-writer` | 04-microservices/{svc}/ |
| Cập nhật Contracts | `k-contract-updater` | 02-central-contracts/ |
| Cập nhật Tech Design | `k-techdesign-updater` | 04-microservices/{svc}/ |
| Kiến trúc & ADR | `k-architect-reviewer` | 01-global-standards/, 03-system-architecture/ |
| Quét tuân thủ | `k-compliance-scanner` | Toàn bộ knowledge/ |
| Điều phối cascade | `k-orchestrator` | Điều phối agent khác |

## Chống Mẫu

- Không tự ý chọn flow — luôn xác nhận với con người
- Không bỏ qua bước tạo `knowledge/` nếu chưa có
- Không dispatch trực tiếp agent mà không qua flow skill
- Không bỏ qua EnterPlanMode — con người phải phê duyệt kế hoạch
- Không nhầm lẫn giữa fixbug và contract — bug là lỗi, contract là thay đổi thiết kế
- Không nhầm lẫn giữa cr và task — CR sửa specs hiện có, task tạo FR mới
- Không nhầm lẫn giữa cr và fixbug — CR là thay đổi có kế hoạch, fixbug là sửa lỗi khẩn cấp
- Không nhầm lẫn giữa cr và contract — CR thay đổi trong service, contract thay đổi central contracts
- Không tự ý sửa code source — chỉ quản lý knowledge/

## Tham Khảo

- `references/shared-patterns.md` — EnterPlanMode, brainstorming, error recovery, dispatch conventions
- `references/report-templates.md` — Mẫu báo cáo tổng kết cho từng flow
