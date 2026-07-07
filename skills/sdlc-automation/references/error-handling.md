# Error Handling — SDLC Automation

Các error scenario và fallback pattern cho skill `sdlc-automation`.

---

## Error Categories

### E1: Preflight Failures

#### E1.1 Git dirty — human chọn Abort

**Detect**: `AskUserQuestion` trả về "Abort"
**Response**:
```
⏹️  Pipeline dừng theo yêu cầu.
   Working tree: [git status summary]
   Đề xuất: commit hoặc stash changes trước khi chạy lại.
```
**Next step**: Dừng hoàn toàn. Không retry, không fallback.

#### E1.2 Foundation files missing — preflight fails

**Detect**: Sau `Skill("sdlc-preflight")`, files vẫn missing
**Response**:
```
🛑 Pipeline dừng — thiếu foundation files:
   ⚠️  [danh sách file thiếu]
   Không thể chạy automation nếu chưa có project-overview và user-context.
   Đề xuất: Chạy /sdlc-preflight thủ công để khởi tạo, hoặc cung cấp thông tin.
```
**Next step**: Dừng. Yêu cầu human resolve.

#### E1.3 Flow ambiguous — human không chọn được

**Detect**: `AskUserQuestion` flow detection trả về ambiguous, human chọn "Khác"
**Response**:
```
🤔 Chưa rõ SDLC flow phù hợp.
   Mô tả thêm yêu cầu của bạn, hoặc dùng /sdlc-orchestrator để có human-in-the-loop.
```
**Next step**: Dừng, đề xuất orchestrator.

---

### E2: Grilling Failures

#### E2.1 Human không trả lời được câu hỏi cốt lõi

**Detect**: Sau 2 attempts, vẫn thiếu ≥2 exit criteria
**Response**:
```
⚠️  Chưa đủ thông tin để proceed với automation.
   Thiếu: [list missing criteria]
   Options:
   1. Tiếp tục grilling với câu hỏi bổ sung
   2. Chuyển sang sdlc-orchestrator (phù hợp hơn khi requirements chưa rõ)
   3. Dừng và quay lại sau khi research thêm
```
**Next step**: Dùng `AskUserQuestion` cho 3 options trên.

#### E2.2 Human muốn skip một round

**Detect**: Human bảo "skip", "bỏ qua round này", "không liên quan"
**Response**: Ghi nhận "chưa xác định" cho round đó, tiếp tục round tiếp theo.
Nhưng nếu round đó là **bắt buộc** (Round 1) → không cho skip.

---

### E3: Workflow Dispatch Failures

#### E3.1 Workflow script not found

**Detect**: `Workflow()` không tìm thấy `.claude/workflows/workflow-sdlc-automation.js`
**Response**:
```
🛑 Không tìm thấy workflow script: .claude/workflows/workflow-sdlc-automation.js
   File này là required dependency của sdlc-automation skill.
   Đề xuất: Kiểm tra xem file có bị xóa hoặc di chuyển không.
```
**Next step**: Dừng. Không fallback.

#### E3.2 Workflow fails to start

**Detect**: `Workflow()` throw error (syntax error, invalid args, etc.)
**Response**:
```
🛑 Workflow dispatch thất bại: [error message]
   Args đã gửi: [args summary]
   Đề xuất: Kiểm tra workflow script syntax, hoặc chạy thủ công.
```
**Next step**: Dừng. Log error details.

#### E3.3 Workflow timeout

**Detect**: Workflow chạy quá lâu (>15 phút không có progress)
**Response**:
```
⏱️  Workflow dường như bị treo — không có progress trong 15 phút.
   Options:
   1. Tiếp tục đợi
   2. Kill workflow và chạy lại
   3. Kill và chuyển sang orchestrator cho các phase còn lại
```
**Next step**: `AskUserQuestion` cho 3 options.

---

### E4: Gate Failures

#### E4.1 Gate fail ở 1 phase

**Detect**: Gate report có FAIL cho phase X
**Response** (trong báo cáo cuối):
```
⚠️  Gate [phase] FAIL — [N] criteria không đạt:
   - [list failed criteria với lý do]
   Đề xuất: Chuyển sang sdlc-orchestrator để xử lý phase này với human review.
```
**Next step**: Báo cáo trong tổng kết. Không tự retry.

#### E4.2 Gate fail ở ≥3 phases

**Detect**: Gate report có FAIL cho ≥3 phases
**Response**:
```
🛑 Nhiều gate failures ([N]/[M] phases) — automation pipeline không ổn định.
   Đề xuất: Chuyển sang sdlc-orchestrator để chạy lại toàn bộ pipeline với human review.
   Bạn có muốn chuyển không?
```
**Next step**: `AskUserQuestion` confirm.

---

### E5: Sprint Update Failures

#### E5.1 Sprint skill fails

**Detect**: `Skill("sprint")` fails hoặc file sprint không update được
**Response**:
```
⚠️  Sprint update thất bại: [error]
   Specs đã được tạo thành công, nhưng sprint board/backlog chưa được cập nhật.
   Đề xuất: Chạy /sprint thủ công sau khi review specs.
```
**Next step**: Tiếp tục — đây là non-blocking error.

---

## General Fallback Pattern

Khi gặp bất kỳ error nào không có trong danh sách trên:

```
⚠️  Lỗi không mong đợi: [error]
   Phase hiện tại: [phase]
   Stack: [nếu có]
   Đề xuất: Chuyển sang sdlc-orchestrator để tiếp tục với human-in-the-loop.
```

**Nguyên tắc chung**: Automation pipeline fail-safe — khi có lỗi, luôn fallback về orchestrator thay vì tự retry mù quáng.
