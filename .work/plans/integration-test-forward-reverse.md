# Đánh giá Integration: Forward & Reverse Pipeline

**Ngày:** 2026-07-08
**Task:** #5 — Đánh giá integration tests giữa forward và reverse pipeline

---

## 1. Định nghĩa lại vấn đề

`sdlc-orchestrator` và `sdlc-codebase` là **hai công cụ độc lập**, không phải pipeline stages
của cùng một workflow. Chúng dùng cho hai mục đích khác nhau:

| | Forward (sdlc-orchestrator) | Reverse (sdlc-codebase) |
|---|---|---|
| **Dùng khi** | Có requirements, cần specs → code | Có code, cần docs |
| **Input** | Business requirements từ human | Codebase hiện có |
| **Output** | agent_docs/ specs + production code | agent_docs/ từ code |
| **Direction** | specs → code | code → specs |
| **Board** | Board-aware | Không dùng board |

**"Integration" ở đây nghĩa là:** Cả hai cùng ghi vào `agent_docs/`. Khi dùng trong
cùng một project (vào những thời điểm khác nhau), artifacts có tương thích không?
Có conflict không?

---

## 2. Shared Workspace: `agent_docs/`

### 2.1 Artifact Map

| File/Dir | Forward (sdlc-orchestrator) | Reverse (sdlc-codebase) | Conflict? |
|----------|---------------------------|------------------------|-----------|
| `project-overview.md` | Đọc (preflight) | Đọc (preflight) | ✅ Không — cả hai chỉ đọc |
| `user-context.md` | Đọc (preflight) | Đọc (preflight) | ✅ Không — cả hai chỉ đọc |
| `conventions.md` | Đọc (preflight) | Đọc (preflight) | ✅ Không — cả hai chỉ đọc |
| `README.md` | **Ghi** (routing table) | Đọc | ✅ Không — reverse không ghi |
| `features/FR-{DOMAIN}-{NNN}.md` | **Ghi** (SRS) | **Ghi** (SRS) | ⚠️ **Cùng path pattern** |
| `features/README.md` | — | **Ghi** (synthesis) | ✅ Không — forward không ghi |
| `architecture.md` | **Ghi** (HLD) | **Ghi** (HLD) | ⚠️ **Cùng file** |
| `adrs/ADR-{NNN}--{slug}.md` | **Ghi** (HLD) | **Ghi** (HLD) | ⚠️ **Cùng path pattern** |
| `adrs/README.md` | **Ghi** (HLD) | **Ghi** (HLD) | ⚠️ **Cùng file** |
| `hard-boundaries.md` | **Ghi** (HLD) | **Ghi** (HLD) | ⚠️ **Cùng file** |
| `contracts/api-conventions.md` | — | **Ghi** (HLD) | ✅ Không — forward không ghi |
| `contracts/events.md` | — | **Ghi** (HLD) | ✅ Không — forward không ghi |
| `contracts/api-{domain}.yaml` | — | **Ghi** (LLD synth) | ✅ Không — forward không ghi |
| `contracts/error-codes.md` | — | **Ghi** (LLD synth) | ✅ Không — forward không ghi |
| `cross-cutting.md` | — | **Ghi** (LLD synth) | ✅ Không — forward không ghi |
| `backend/{svc}/tech-design/{svc}-service.md` | **Ghi** (LLD) | **Ghi** (LLD) | ⚠️ **Cùng path pattern** |
| `backend/{svc}/implementation/FR-*-impl.md` | **Ghi** (IMP) | **Ghi** (IMP) | ⚠️ **Cùng path pattern** |
| `backend/{svc}/test-specs/FR-*-test.md` | **Ghi** (TST) | **Ghi** (TST) | ⚠️ **Cùng path pattern** |
| `traceability/requirements-matrix.md` | — | **Ghi** (SRS synth) | ✅ Không — forward không ghi |

**Kết quả:** 8/19 artifacts có path conflict. 11/19 artifacts là unique cho từng pipeline.

### 2.2 Cơ chế bảo vệ hiện có

| Pipeline | Cơ chế |
|----------|--------|
| **Forward** | Hard boundary: "Không tự sửa feature specs — chỉ sdlc-srs và sdlc-lld mới touch". Không có skip/overwrite prompt rõ ràng |
| **Reverse** | Bước 2.5 Smart Detection + "Tôn trọng file đã tồn tại — hỏi human trước khi overwrite". File đã có → hỏi: Update, Skip, Merge |

**Gap:** Forward pipeline không có explicit overwrite protection. Reverse có nhưng forward không.

---

## 3. Các Vấn đề Thực tế

### 3.1 FR-ID Collision (⚠️ Risk thực)

Cả hai pipeline dùng pattern `FR-{DOMAIN}-{NNN}.md`. Cả hai đều tự chọn NNN từ
agent (không có shared counter).

**Kịch bản gây collision:**
1. Forward chạy → tạo `FR-AUTH-001.md`, `FR-AUTH-002.md`
2. Reverse chạy sau → agent tự đếm, tạo `FR-AUTH-001.md` (collision!)

**Mức độ:** Chỉ xảy ra khi cả hai cùng chạy trên cùng project. Reverse agent không
check existing FR-IDs trước khi tạo. Forward agent cũng không.

### 3.2 architecture.md — Prescriptive vs Descriptive (⚠️ Risk thực)

Cả hai ghi cùng file `agent_docs/architecture.md` nhưng nội dung khác bản chất:
- **Forward:** architecture được THIẾT KẾ (prescriptive — "nên có")
- **Reverse:** architecture được TRÍCH XUẤT (descriptive — "đang có")

Nếu chạy cả hai, file bị ghi đè với nội dung khác philosophy.

### 3.3 Overwrite Protection Không Đồng Đều (⚠️ Gap)

- Reverse có explicit protection: Bước 2.5 smart detection + hỏi human
- Forward không có — specs pipeline ghi thẳng, không check file tồn tại

### 3.4 Quality Semantics Khác Nhau (ℹ️ Không phải bug, cần awareness)

| Khía cạnh | Forward Agent Output | Reverse Agent Output |
|-----------|---------------------|---------------------|
| SRS | Requirements từ business context, Gherkin đầy đủ | Requirements suy ra từ code, có UNCERTAINTY flags |
| HLD | Kiến trúc được thiết kế, ADRs với rationale | Kiến trúc được extract, ADRs flag INFERRED |
| IMP | Execution flow specs để implement | Execution flow docs từ code hiện có |
| TST | Test specs để viết test | Test patterns từ test code hiện có |

Không có vấn đề gì sai — đây là khác biệt thiết kế. Nhưng artifacts trông giống
nhau về format, khác về chất lượng ngữ nghĩa. Human đọc có thể không phân biệt được.

### 3.5 Reverse Synthesis Artifacts Không Có Forward Equivalent (✅ Không phải vấn đề)

Reverse sinh thêm: `cross-cutting.md`, `api-{domain}.yaml`, `error-codes.md`,
`features/README.md`, `traceability/requirements-matrix.md`. Forward không đọc
những file này khi cook.

Đây **không phải vấn đề** — reverse artifacts phục vụ mục đích documentation.
Forward cook không cần chúng. Không cần "tích hợp".

---

## 4. Đánh giá Tổng thể

### Những gì HOẠT ĐỘNG TỐT

- ✅ **Hai pipeline dùng chung foundation files** (project-overview, user-context, conventions) — cả hai đều chỉ đọc → không conflict
- ✅ **Cả hai invoke `sdlc-preflight`** khi thiếu foundation — logic nhất quán
- ✅ **Cấu trúc agent_docs/ nhất quán** — cùng conventions về FR-IDs, directory layout, naming
- ✅ **Reverse có Smart Detection** (Bước 2.5) — tự động phát hiện artifacts hiện có, suggest incremental update
- ✅ **Hai bộ agent tách biệt** — không chồng chéo trách nhiệm. Mỗi pipeline có agent được thiết kế riêng cho philosophy của nó

### Những gì CÓ VẤN ĐỀ

| # | Vấn đề | Severity | Giải thích |
|---|--------|----------|-----------|
| **P1** | FR-ID collision không có guard | ⚠️ Medium | Cả hai cùng tạo `FR-{DOMAIN}-{NNN}.md` nhưng không check existing. Nếu dùng cả hai trong cùng project, có thể ghi đè |
| **P2** | architecture.md dual-write khác philosophy | ⚠️ Medium | Forward viết prescriptive, reverse viết descriptive. Ghi đè lẫn nhau mất thông tin |
| **P3** | Forward thiếu overwrite protection | ⚠️ Medium | Reverse có hỏi trước khi overwrite, forward thì không. Nếu forward chạy sau reverse → ghi đè không cảnh báo |
| **P4** | Quality semantics không được document | ℹ️ Low | UNCERTAINTY/INFERRED flags trong reverse artifacts có thể không được human để ý khi đọc. Không phải bug nhưng là UX gap |
| **P5** | Foundation check logic trùng lặp | ℹ️ Low | Cả hai SKILL.md có Foundation Gate giống nhau. Maintain hai bản → dễ drift |

### Những gì KHÔNG PHẢI VẤN ĐỀ

- ❌ **Không cần handoff protocol** — hai công cụ độc lập, dùng khác thời điểm
- ❌ **Không cần shared agents** — philosophy khác nhau, agent riêng là đúng
- ❌ **Không cần board sync từ reverse** — reverse là công cụ docs, không phải sprint tool
- ❌ **Không cần gate criteria chung** — prescriptive vs descriptive cần criteria khác nhau
- ❌ **Reverse dùng Workflow, Forward dùng Agent** — implementation detail, không phải integration issue

---

## 5. Khuyến nghị

### Cần làm (3 items)

| # | Hành động | Priority | Effort |
|---|----------|----------|--------|
| **R1** | **Thêm FR-ID collision check vào cả hai pipeline** — trước khi tạo FR mới, agent phải `ls agent_docs/features/FR-*.md` để tìm NNN tiếp theo. Hoặc: reverse dùng prefix riêng `RFR-{DOMAIN}-{NNN}` | P1 | Nhỏ |
| **R2** | **Tách architecture.md hoặc thêm overwrite prompt cho forward** — Option A: reverse ghi `architecture-asbuilt.md`, forward giữ `architecture.md`. Option B: cả hai pipeline đều hỏi trước khi ghi đè file đã tồn tại | P1 | Nhỏ |
| **R3** | **Thêm overwrite protection vào forward specs pipeline** — trước khi sdlc-srs/sdlc-hld/sdlc-lld ghi file, check file tồn tại → hỏi human | P1 | Nhỏ |

### Cân nhắc (nice-to-have)

| # | Hành động | Priority |
|---|----------|----------|
| **R4** | Document UNCERTAINTY flag convention trong cả hai SKILL.md — để human hiểu sự khác biệt giữa forward và reverse artifacts | P2 |
| **R5** | Extract Foundation Gate thành shared procedure (cả hai pipeline dùng chung template) — tránh drift | P3 |

---

## 6. Kết luận

Hai pipeline **hoạt động độc lập đúng như thiết kế**. Không cần "handoff protocol" hay
"integration workflow". Vấn đề thực tế chỉ nằm ở **workspace sharing**: khi cả hai
cùng ghi vào `agent_docs/`, có 3 điểm cần fix:

1. FR-ID collision
2. architecture.md dual-write
3. Forward thiếu overwrite protection

Tất cả đều là fix nhỏ, không thay đổi kiến trúc.
