# SDLC Entry Gate

Entry gate chung được thực thi bởi mọi SDLC entry point trước khi bất kỳ
pipeline work nào bắt đầu. Không duplicate logic này trong các skill riêng lẻ.
Phân biệt với `sdlc-preflight` skill (tạo foundation files) — rule này quy
định khi nào và cách gọi nó.

## Bước 1: Git State Check

Kiểm tra trạng thái repository: `git branch --show-current && git status --porcelain`.

Nếu working tree dirty, hỏi human một lần với các lựa chọn:
- **Stash** — lưu thay đổi tạm thời
- **Commit** — commit trước khi tiếp tục
- **Continue** — tiếp tục với dirty tree (rủi ro conflict)
- **Abort** — dừng pipeline

Abort kết thúc session ngay lập tức. Các lựa chọn khác tiếp tục sang Bước 2.

## Bước 2: Foundation Gate

Xác minh các foundation files cần thiết tồn tại trong `agent_docs/`:
`project-overview.md`, `user-context.md`, `conventions.md`.

Nếu `sdlc-preflight` không tạo được required files, dùng `Agent("sdlc-fable-thinking", {prompt: "Decision: Foundation Gate Fail. Context: OBSERVED: preflight đã chạy, file nào bị thiếu, flow hiện tại, error output từ preflight. PRIOR: thiếu foundation files có thể ảnh hưởng đến quality của downstream phases. ASSUMED: preflight fail không phải do transient error. Options: A) Dừng pipeline — thiếu foundation quá critical, B) Tiếp tục với caveat — flow simple, foundation không bắt buộc, C) Retry preflight với instruction khác. Goal: pipeline không chạy với thiếu context quan trọng. Verify: đọc danh sách file thiếu từ preflight output + flow requirements table."})` để đánh giá impact trước khi dừng pipeline.

Yêu cầu theo flow:

| Flow | Yêu cầu tối thiểu | Khi thiếu |
|---|---|---|
| `task` | `project-overview.md` + `user-context.md` + `conventions.md` | Gọi `sdlc-preflight` skill, verify lại, dừng nếu vẫn thiếu |
| `cr` | Cảnh báo nếu thiếu, hỏi human trước khi gọi `sdlc-preflight` skill |
| `cook` | Verify ready-status + feature specs + IMP + TST specs tồn tại trong `agent_docs/features/`. Thiếu specs → từ chối cook, đề xuất task flow |
| `fixbug` | `project-overview.md` khuyến nghị nhưng không bắt buộc. **Chỉ dành cho orchestrator** — xem Bước 3 để reject non-orchestrator |
| `reverse` | Không yêu cầu (reverse pipeline tự sinh foundation từ code) |
| `quick` | **Bỏ qua hoàn toàn** — quick flow không chạy specs, foundation không liên quan |

## Bước 3: Flow Verification

Sau khi foundation được xác nhận, verify flow choice:

- Đọc lại yêu cầu của người dùng so với flow đã resolve
- **fixbug reject:** nếu flow = `fixbug` và entry point ≠ orchestrator → dừng
  ngay, escalate lên orchestrator với `flow=fixbug`. Đây là hard block — không
  chạy bất kỳ bước nào khác
- Nếu scope có vẻ lớn hơn flow có thể xử lý → dùng `Agent("sdlc-fable-thinking", {prompt: "Decision: Flow-Scope Mismatch. Context: OBSERVED: flow đã chọn + file inventory từ codebase + user intent gốc. PRIOR: scope mismatch dẫn đến pipeline không đủ phases. ASSUMED: mismatch là thật, không phải false alarm. Options: A) Escalate lên flow nặng hơn — đủ phases để cover scope, B) Giữ flow hiện tại với caveat — phần scope dư không critical, C) Tách thành 2 flow riêng. Goal: scope được cover đầy đủ bởi pipeline. Verify: đọc file inventory + flow requirements table + đếm số file/service bị ảnh hưởng."})` để verify scope mismatch trước khi escalate, sau đó escalate theo `sdlc-routing.md` Escalation Protocol
- Nếu flow yêu cầu foundation files bị thiếu và không thể tạo → dừng

## Báo cáo

Báo cáo kết quả entry gate ngắn gọn:

```
🏗️ Entry Gate: [branch] | Git: [clean|dirty→stashed|committed|continued] | Foundation: [trạng thái từng file]
```

Không proceed qua entry gate với dirty state chưa giải quyết hoặc thiếu
required foundation files.
