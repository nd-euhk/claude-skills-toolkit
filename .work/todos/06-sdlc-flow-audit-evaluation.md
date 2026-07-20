# SDLC Flow `audit` — Đánh Giá Tương Lai

**Ngày tạo:** 2026-07-20
**Độ ưu tiên:** Low
**Trạng thái:** Chưa bắt đầu (đánh giá sau)

## Bối Cảnh

Trong quá trình tạo `.claude/rules/sdlc-routing.md`, phát hiện flow `audit` có thể
là một flow riêng biệt trong tương lai.

## Flow `audit` Là Gì?

Audit codebase mà không cần specs pipeline — khác với `reverse` (code→specs) và
`review` (chất lượng code).

| Flow | Mục đích | Output |
|------|----------|--------|
| `reverse` | Reverse-engineer specs từ code | agent_docs/ (SRS, HLD, LLD, ...) |
| `review` | Đánh giá chất lượng code | Review report (.work/review/) |
| **`audit`** | Kiểm tra tuân thủ, bảo mật, compliance | Audit report |

## Điểm Khác Biệt

- **Không sinh specs** — audit không tạo SRS/HLD/LLD
- **Không phải review** — audit kiểm tra compliance (SOC2, GDPR, PCI-DSS), không phải code quality
- **Read-only toàn bộ** — không bao giờ sửa code
- **Có thể có checklist cố định** — tiêu chí audit được định nghĩa trước (vd: "tất cả API phải có rate limiting")

## Khi Nào Cần?

- Audit bảo mật định kỳ
- Compliance check trước release
- Due diligence cho acquisition
- Internal audit sau incident

## Câu Hỏi Cần Trả Lời

1. `audit` có đủ khác biệt với `sdlc-review --security --arch --ops` không? Hay chỉ là convenience wrapper?
2. Có nên là flow riêng trong `sdlc-orchestrator`? Hay là standalone skill như `sdlc-review`?
3. Checklist audit ai định nghĩa? Human? Agent từ compliance standards?
4. Audit report format — có cần chuẩn hóa (SOC2, ISO 27001, ...) không?

## Quyết Định

**Tạm hoãn.** Chưa đủ nhu cầu và clarity để implement. Đánh giá lại sau khi
các flow hiện tại ổn định và có feedback từ người dùng thực tế.

## Notes

- Đây là "parking lot" item — không block gì, chỉ để không quên
- Nếu trong quá trình dùng SDLC thấy pattern audit xuất hiện thường xuyên → ưu tiên đánh giá lại
