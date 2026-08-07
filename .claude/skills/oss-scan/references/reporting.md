# Reporting — Batch Report & Trình Quyết Định Cho Human

Định dạng batch report và cách skill trình các quyết định cần human sau khi
workflow hoàn thành.

## Batch Report (`OSS-BATCH-<timestamp>.md`)

Workflow gọi synthesis agent ghi report vào
`<outputDir>/OSS-BATCH-<timestamp>.md` (outputDir mặc định:
`.work/oss-compliance/` — luôn trong `.work/` của nơi invoke skill). Cấu trúc:

### 1. Executive Summary

```
# OSS Batch Compliance Report — <ngày>

## Executive Summary
- Projects scanned: 13 (PASS: 5 | CONDITION: 3 | REVIEW: 3 | FAIL: 1 | BLOCKED: 1)
- Trạng thái tổng thể: [PASS | PASS_WITH_EXCEPTIONS | NEEDS_REVIEW | FAIL | BLOCKED]
- Component FAIL/BLOCKED: 2 (liệt kê)
- Component cần LRB (R3/R4/no-license): 7
- Điểm rủi ro cao nhất: <project>: <score> (<component>)
```

### 2. Bảng Per-Project

| Project | Components | R1 | R2 | R3 | R4 | No-license | Research | Gate decision | Scan report |
|---|---|---|---|---|---|---|---|---|---|
| transporter | 24 | 24 | 0 | 0 | 0 | 0 | skip (all R1) | ✅ PASS | .work/oss-compliance/OSS-SCAN-...--transporter.md |
| e-voucher-beans | 186 | 180 | 2 | 0 | 3 | 1 | full | 🔶 NEEDS_REVIEW | ... |

Cột **Research** ghi trạng thái + lý do:
- `skip (all R1)` — không cần web research
- `skip (step-select=skip-research)` — human override
- `full` — đã chạy oss-risk-research-executor
- `failed` — scan fail, không research

Cột **Gate decision** dùng icon + status:
`✅ PASS` | `⚠️ PASS_WITH_CONDITIONS` | `🔶 NEEDS_REVIEW` | `❌ FAIL` | `⛔ BLOCKED` | `⏸ PENDING`

### 3. Decisions Needed (gom từ mọi project)

Liệt kê từng item cần human quyết định, gom lại theo loại:

```
## Decisions Needed

### R4 — Cần LRB/Mua sắm
- [TPC-id] <component> v<x> (<license>) — <project> — <vấn đề: EULA/hạn mức/kênh>
- ...

### R3 — Cần LRB (mặc định deny, ngoại lệ phải có văn bản)
- [TPC-id] <component> (<license>) — <project> — <cách tích hợp>

### No-license — BLOCKED (No license = No rights)
- [TPC-id] <component> — <project> — <nguồn phát hiện>
```

### 4. Violations (FAIL/BLOCKED)

```
## Violations
- <component> (<license>) — <project> — lý do + remediation đề xuất
```

### 5. Next Steps

```
## Next Steps
- Project PASS → sẵn sàng release (giữ NOTICE, theo lộ trình SBOM)
- Project NEEDS_REVIEW → trình LRB trước release
- Project FAIL/BLOCKED → khắc phục hoặc thay thế component, rescan
- Bổ sung [MANUAL] items còn thiếu vào hồ sơ thành phần (mục 7 quan-ly-rui-ro-opensource.md)
```

## Trình Quyết Định Cho Human (Sau Workflow)

Sau khi workflow xong, skill (main session) trình `decisionsNeeded` cho human.
**Wizard pattern — hỏi từng câu, chờ phản hồi.**

### Nhóm R4 / R3 / no-license

```
🔶 Quyết định cho <component> (<license>) — <project>:
   Cách tích hợp: <static/dynamic/standalone>
   Rủi ro: <mô tả ngắn>
   Bạn muốn:
   - Approve exception (chỉ LRB có thẩm quyền, cần văn bản)
   - Thay thế component (đề xuất: <alt>)
   - Isolate (chạy tách biệt, không link)
   - Chặn vĩnh viễn
```

### Nhóm `[MANUAL]` items

Các field scan không tự điền được (SDK thương mại, font trả phí, mục đích sử
dụng...). Trình lần lượt:

```
📝 Thông tin còn thiếu cho <component> (<project>):
   - Tên/nhà cung cấp:
   - License/EULA:
   - Hợp đồng/hạn mức (nếu thương mại):
   - Mục đích sử dụng trong sản phẩm:
```

Nếu human không trả lời hết → ghi `[MANUAL]` còn thiếu trong "Next Steps" để
Đầu mối License điền sau, không chặn pipeline.

## Báo Cáo Outcome-First

Câu đầu tiên luôn nêu outcome:

```
OSS Batch Scan: NEEDS_REVIEW — 13 project, 3 cần LRB (R4), 1 BLOCKED (no-license)
Batch report: .work/oss-compliance/OSS-BATCH-20260807-153000.md
Decisions needed: 7 (R4: 3, R3: 1, no-license: 1, [MANUAL]: 2)
```

Không dẫn dắt, không giấu project FAIL/BLOCKED.
