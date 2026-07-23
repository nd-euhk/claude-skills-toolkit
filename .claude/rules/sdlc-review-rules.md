# SDLC Review & Audit Rules

Áp dụng khi xử lý findings từ gate agents (`sdlc-gate`, `codebase-gate`,
`sdlc-tdd-be-gate`, `sdlc-tdd-fe-gate`), code review agents, hoặc audit
feedback. Rule này ngăn ad-hoc judgment — khi nào fix, khi nào skip, khi nào
escalate.

## Verified Decisions

Khi một quyết định đã được verify bằng source code, test output, hoặc empirical
check — **không** reverse chỉ vì audit concern trừu tượng. Chỉ reverse khi audit
có bằng chứng mới hoặc context đã thay đổi.

Khi từ chối audit concern, nêu ngắn gọn verification source.

## Human Decisions

**Không** âm thầm đảo ngược quyết định của human. Bao gồm: thresholds, selected
libraries, feature scope, schema shape, pricing, timelines, compliance choices,
và UX trade-offs.

Nếu audit/review suggest đảo ngược human decision, dùng `Skill("fable-thinking")`
để đánh giá — follow audit hay giữ quyết định gốc? Sau đó trình bày:

- Quyết định gốc
- Audit concern
- Trade-off
- Các options cụ thể

Sau đó **chờ human** — không tự quyết định.

## Threat Model

Trước khi áp dụng security finding, xác định code thực sự lưu trữ, bảo vệ, hoặc
expose những gì. Fix real failure modes. Document non-issues ngắn gọn. Hỏi khi
risk plausible nhưng phụ thuộc vào product intent.

## Gate Verdict Handling

Gate agent đánh giá artifact và trả về verdict. **Phân biệt với orchestration
status:** `GATE_FAIL` (gate agent phát hiện criteria không đạt — có thể retry)
khác với `AGENT_ERROR` (agent crash/lỗi runtime — không retry, báo human).
Xem `sdlc-orchestration.md` Status Protocol để biết cách xử lý từng loại.

| Verdict | Hành động |
|---------|-----------|
| **PASS tất cả criteria** | Tiếp tục pipeline |
| **FAIL trên critical criteria** | Dừng pipeline ngay, báo cáo human |
| **FAIL trên non-critical criteria** | Retry với previousFailure context (max 3 lần). Sau 3 lần → escalate |
| **FAIL với regression** | Dừng, báo cáo regression (TC cũ bị vỡ, spec bị downgrade) |

## Severity Classification

Khi gate agent hoặc reviewer flag concern, phân loại trước khi hành động:

| Severity | Định nghĩa | Hành động |
|----------|-----------|-----------|
| **Critical** | Breaking change với production, data loss, security hole | Dừng pipeline, báo human ngay |
| **High** | Có thể gây bug trong production, spec sai | Fix trước khi continue |
| **Medium** | Code smell, missing edge case, convention vi phạm | Ghi nhận, fix trong refactor phase |
| **Low** | Style, naming, cosmetic | Non-blocking, optional fix |

Khi gate agent hoặc reviewer phân loại finding và classification không rõ ràng
(borderline giữa 2 mức), dùng `Skill("fable-thinking")` để verify classification
trước khi hành động.
