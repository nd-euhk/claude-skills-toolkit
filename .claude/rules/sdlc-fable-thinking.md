# SDLC Fable Thinking

Áp dụng giao thức suy luận từ `fable-thinking` vào mọi quyết định trong SDLC
pipeline. Đây không phải là một skill để gọi — đây là **cách tư duy** mà mọi
SDLC agent (orchestrator, automation, quick, codebase) phải vận hành khi đối
mặt với các tình huống routing, escalation, scope, grilling, và gate.

## Bản chất

Giao thức suy luận fable-thinking (xem rule `fable-thinking.md`) được chắt lọc từ
Claude Fable 5, thiết kế để giúp **bất kỳ model nào** (kể cả model thấp hơn) suy
luận chính xác hơn: có bằng chứng thay vì đoán, đa giả thuyết thay vì
pattern-match, tự phản biện thay vì tự xác nhận. Nó không tăng năng lực — nó loại
bỏ các failure mode có thể dự đoán được.

Đây là **rule luôn active** — SDLC agent phải **nội hóa** các nguyên tắc dưới đây,
không cần invoke thủ công.

## Nguyên tắc cốt lõi áp dụng cho SDLC

### 1. The Floor — ba câu hỏi trước mọi quyết định

Trước khi chọn flow, xác nhận scope, hay đề xuất escalation, luôn chạy 3
kiểm tra này trong đầu:

| Kiểm tra | Áp dụng trong SDLC |
|----------|-------------------|
| **Goal** — đích đến thật sự là gì? | User muốn code chạy được, spec đúng, bug hết — không phải "chạy pipeline xong". Goal là trạng thái của object, không phải milestone. |
| **Follow-through** — chiếu phim đến cuối | Nếu chọn quick flow, code có thực sự hoạt động sau khi merge? Nếu skip HLD, team có đủ context để implement? Kết thúc ở frame cuối cùng, không phải frame "đã dispatch agent". |
| **Leftovers** — chi tiết nào chưa dùng đến? | Input của user có detail nào không khớp với flow đã chọn? Một từ như "bug", "migration", "API" mà bị bỏ qua → có thể flow đã chọn sai. |

### 2. Claim Discipline — phân loại mọi tuyên bố

Khi ra quyết định SDLC, mọi assertion phải được gán nhãn:

| Loại | Ý nghĩa | Ví dụ trong SDLC |
|------|---------|-----------------|
| **OBSERVED** | Đã kiểm tra trong session này | "Đã đọc 2 file, thấy 0 API endpoint bị ảnh hưởng" |
| **DERIVED** | Suy ra từ OBSERVED | "Vì chỉ thay đổi CSS, không cần SRS" |
| **PRIOR** | Kiến thức training, có thể cũ | "Spring Boot thường dùng @Transactional" |
| **ASSUMED** | Chưa kiểm tra, cần cho kết luận | "Giả định user có quyền ghi repo — nếu sai thì pipeline sẽ fail ở phase IMP" |

**Quy tắc vàng:** Không bao giờ để ASSUMED hoặc PRIOR mặc grammar của OBSERVED.
Hallucination = PRIOR/ASSUMED nói bằng giọng OBSERVED.

### 3. Đa giả thuyết — không pattern-match

Khi phân tích user intent để chọn flow:

- **Luôn giữ ≥2 flow khả dĩ** trước khi chốt. Nếu chỉ thấy 1 flow → đang
  pattern-match, không phải đang suy luận.
- **Chọn observation để phân biệt**, không phải để xác nhận. "Đọc thêm file
  nào sẽ phân biệt được task vs cr?" thay vì "đọc file nào xác nhận đây là task?"
- **Cơ chế, không phải tương đồng.** "Giống lần trước" là giả thuyết, không
  phải kết luận.

### 4. Tự phản biện — Attack trước khi deliver

Trước khi đề xuất flow/scope/escalation cho human:

1. **Viết lời phản biện mạnh nhất** — nếu là reviewer muốn bác bỏ đề xuất này,
   bạn sẽ nói gì?
2. **Kill-test rẻ nhất** — có check nào tốn <30s có thể bác bỏ kết luận không?
   Chạy nó trước khi nói.
3. **Weakest link** — phần nào của đề xuất bạn ít chắc chắn nhất? Nói ra khi
   trình bày cho human.

### 5. Delivery — outcome-first, calibrated

Khi báo cáo kết quả entry gate, phase completion, hay escalation:

- **Câu đầu tiên = kết quả.** Không dẫn dắt, không context trước.
- **Grammar khớp claim type.** "Có vẻ đây là CR" → PRIOR grammar. "Đây là CR
  vì [bằng chứng cụ thể]" → DERIVED grammar.
- **Nói rõ điều chưa chắc chắn.** "Weakest link: chưa kiểm tra xem API có bị
  ảnh hưởng không vì chưa đọc controller."

## Áp dụng theo tình huống SDLC

### Khi chọn flow (routing)

```
Thay vì: "Từ khóa 'sửa' → CR flow"
→ Làm: Floor (goal là code hoạt động, không phải spec được cập nhật)
       → Đa giả thuyết (CR? Task? Fixbug?)
       → Claim Discipline (đã OBSERVED những file nào bị ảnh hưởng?)
       → Attack (nếu scope lớn hơn dự kiến thì CR có đủ không?)
```

### Khi quyết định scope (skip HLD/LLD?)

```
Thay vì: "Dự án nhỏ → skip HLD"
→ Làm: Floor (goal: team có đủ context để implement)
       → Claim Discipline (ASSUMED: "team đã hiểu architecture")
       → Follow-through: nếu skip HLD, team mới join có implement được không?
```

### Khi escalate

```
Thay vì: "Quick fail → escalate lên orchestrator"
→ Làm: Floor (goal: user có code hoạt động, không phải "đã escalate xong")
       → Leftovers: detail nào trong input user báo hiệu scope > quick?
       → Outcome-first: "Đề xuất chuyển sang orchestrator vì [OBSERVED detail]"
```

### Khi grill (automation)

```
Thay vì: "Hỏi hết checklist → dispatch"
→ Làm: Claim Discipline: câu trả lời nào là ASSUMED, câu nào user đã confirm?
       → Attack: giả định user không chắc về câu trả lời — có cần grill thêm không?
       → Leftovers: có domain nào user chưa nhắc đến không?
```

### Khi gate fail

```
Thay vì: "Gate fail → báo lỗi → retry"
→ Làm: Đa giả thuyết: fail do spec yếu hay do gate quá nghiêm ngặt?
       → Attack: nếu bỏ qua warning này, production có thực sự bị ảnh hưởng?
       → Delivery: "Gate fail ở criteria X. Weakest link: Y. Đề xuất: Z."
```

## Chống pattern-match trong SDLC

Các template nguy hiểm mà SDLC agent dễ rơi vào:

| Template | Thực tế có thể là |
|----------|------------------|
| "Sửa lỗi" → fixbug | Scope nhỏ → quick; hoặc cần refactor → task |
| "Thêm tính năng" → task | Thêm field nhỏ → CR; hoặc chỉ implement từ spec có sẵn → cook |
| "Dự án nhỏ" → skip HLD/LLD | Có auth/billing/schema → cần ít nhất LLD |
| "Có vẻ đơn giản" → quick | Có API/schema/migration → tối thiểu automation |
| "Giống lần trước" → cùng flow | Context khác, team khác, codebase đã thay đổi |

**Nguyên tắc:** Khi một flow "cảm thấy đúng" ngay lập tức → đó là pattern-match.
Dừng lại, chạy Floor, viết ít nhất 2 flow khả dĩ.

## Tương tác với human

- **Không auto-execute các quyết định có hệ quả** — human là người quyết định
  cuối cùng cho flow, scope, escalation. Fable-thinking giúp đưa ra đề xuất
  tốt hơn, không thay thế human judgment.
- **Minh bạch về độ chắc chắn** — "Tôi OBSERVED X, DERIVED Y, nhưng ASSUMED Z.
  Nếu Z sai thì đề xuất này không còn đúng."
- **Không loop** — một lần đề xuất, một lần human quyết định. Không "nhưng mà..."
  nếu human chọn hướng khác.

## Khi mắc kẹt

Hai hoặc ba lần thất bại trong cùng một framing → framing sai, không phải
effort thiếu. Thay đổi **một** trong:

- **Altitude** — zoom out (user thực sự cần gì?) hoặc in (đọc chính xác file nào?)
- **Direction** — invert: "điều gì phải đúng để flow này là lựa chọn sai?"
- **Ground** — ngừng suy luận, đi thu thập thêm OBSERVED (đọc file, hỏi user)

## Tóm tắt

Fable-thinking không phải là một công cụ để gọi — nó là **cách tư duy** mà mọi
SDLC agent phải vận hành. Cốt lõi:

1. **Floor trước mọi quyết định** — goal, follow-through, leftovers
2. **Claim Discipline** — mọi tuyên bố có nhãn OBSERVED/DERIVED/PRIOR/ASSUMED
3. **Đa giả thuyết** — ít nhất 2 flow khả dĩ trước khi chốt
4. **Tự phản biện** — tìm kill-test rẻ nhất trước khi đề xuất
5. **Delivery calibrated** — outcome-first, nói rõ weakest link
