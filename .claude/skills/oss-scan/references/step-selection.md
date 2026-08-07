# Step-Selection — Quyết Định Chạy Step Nào Cho Từng Project

Ma trận quyết định cho luồng `scan → risk-research → gate` (3 executor subagents:
`oss-scan-executor` → `oss-risk-research-executor` → `oss-gate-executor`). Mục
tiêu: chạy **đủ** cho mức rủi ro của project, không chạy thừa. Chính sách dựa
trên `quan-ly-rui-ro-opensource.md` (nhóm R1–R4, Allow/Restrict/Deny).

## Ma Trận Quyết Định

Quyết định **sau khi có kết quả scan** — scan agent đọc report và trả về
`riskSummary` (đếm theo R1–R4/noLicense) kèm `needsResearch` + `gateMode`.

| Kết quả scan (riskSummary) | `needsResearch` | `gateMode` | Research | Gate |
|---|---|---|---|---|
| **Toàn R1**, không có `[MANUAL]` | `false` | `auto-pass` | **SKIP** | `oss-gate-executor` auto-approve R1 → **PASS** |
| Có **R2** (weak copyleft: LGPL, MPL, EPL, CDDL) | `true` | `conditional` | Chạy: CVE + check cách tích hợp (dynamic link, không sửa file) | `oss-gate-executor` → **PASS_WITH_CONDITIONS** (giữ notice, dynamic link, không sửa) |
| Có **R4** (commercial, SDK, font, template, AI model, dataset) | `true` | `review` | Chạy full: EULA terms, hạn mức seat/MAU, attribution, kênh sử dụng | `oss-gate-executor` → **NEEDS_REVIEW** → trình LRB/Mua sắm |
| Có **R3** (GPL/AGPL/SSPL) hoặc **no-license** | `true` | `escalate` | Chạy full: legal cases, tiền lệ exception, khả năng isolate | `oss-gate-executor` → **FAIL/BLOCKED** → escalate LRB. No-license = BLOCKED (No license = No rights) |
| Có R2 + R4 lẫn lộn | `true` | `review` | Chạy full | Gate theo nhóm nghiêm ngặt nhất (R4) |
| **Scan fail** (không manifest, lỗi) | — | — | SKIP | Không gate — ghi nhận FAIL trong report, liệt kê `issues` |

### Quy tắc gộp nhóm

Khi project có nhiều nhóm → **lấy nhóm nghiêm ngặt nhất**:

```
escalate (R3/no-license) > review (R4) > conditional (R2) > auto-pass (R1)
```

`needsResearch = true` nếu tồn tại bất kỳ component nào không phải R1, hoặc có
bất kỳ `[MANUAL]` item nào (SDK thương mại không nằm trong SBOM, thành phần
không xác định license).

## Cờ `--step-select` (CLI Override)

Cờ do human chọn khi invoke skill — **ghi đè** auto-selection:

| Cờ | Research | Gate | Dùng khi |
|---|---|---|---|
| `auto` (mặc định) | Theo ma trận | Theo ma trận | Chuẩn, khuyến nghị |
| `full` | **Chạy mọi project** | full | Muốn research web cho cả project R1 (audit kỹ) |
| `skip-research` | **Skip mọi project** | vẫn chạy | Chỉ cần license decision, không cần CVE/legal (nhanh) |
| `scan-only` | Skip | **Skip** — đánh `PENDING` | Chỉ lập SBOM/kiểm kê, chạy scan trước, research/gate sau |

Khi human chọn override → workflow truyền `stepSelect` vào args, các stage
research/gate tuân theo, không cần scan agent trả `needsResearch`.

## Worked Examples

### Ví dụ 1 — Project toàn R1 (vd `transporter`, chỉ MIT/Apache-2.0)

```
scan:  componentCount=24, riskSummary={R1:24, R2:0, R3:0, R4:0, noLicense:0}
→ needsResearch=false, gateMode=auto-pass
research: SKIP (lý do: all R1)
gate:     PASS (auto-pass-r1)
```

### Ví dụ 2 — Project có R2 + R4 (vd `e-voucher-beans`, LGPL + SDK ngân hàng)

```
scan:  riskSummary={R1:180, R2:2, R3:0, R4:3, noLicense:1}
→ needsResearch=true, gateMode=review (R4 nghiêm ngặt hơn R2; noLicense kéo escalate)
research: RUN full (R4 EULA + no-license legal check)
gate:     NEEDS_REVIEW — 3 component R4 cần LRB, 1 no-license BLOCKED
decisionsNeeded: [3 x R4 SDK, 1 x no-license]
```

### Ví dụ 3 — Human chọn `--step-select skip-research`

```
Mọi project: scan + gate, không research.
Project R4 → gate trả NEEDS_REVIEW (dựa trên license policy thuần, không có risk score)
```

## Input Workflow Nhận

Sau Phase 3 (SKILL.md), workflow nhận đủ thông tin để quyết định per-project mà
không cần hỏi lại human:

```js
{
  projects: [{ name, path }],   // từ Phase 1 (detect) hoặc Phase 2 (chọn)
  stepSelect: 'auto',           // auto | full | skip-research | scan-only
  timestamp: '20260807-153000',
  outputDir: '.work/oss-compliance',
}
```

Trong chế độ `auto`, quyết định step-selection thực chất xảy ra **bên trong
workflow** — scan agent trả về `needsResearch`/`gateMode` từ kết quả scan, các
stage sau branch theo đó. Human không cần quyết định per-project thủ công.
