# Triage Grill — SDLC Quick

Bộ câu hỏi triage nhẹ cho skill `sdlc-quick`. KHÔNG phải full grilling 4 rounds
như automation — đây là **xác nhận nhanh** (2-3 câu) rằng task thực sự trivial.

## Nguyên tắc triage

- **Progressive disclosure**: Mỗi lần 1 câu. Đợi trả lời mới hỏi tiếp.
- **Fail-safe**: Không chắc → escalate. Không bao giờ "đoán" là trivial.
- **Exit criteria tối thiểu**: Phải xác nhận được file count (≤2) + không API/schema + không security impact.
- **Borderline → escalate**: Round 3 là optional, chỉ hỏi khi có dấu hiệu borderline.

---

## Trivial Gate Criteria (G1-G5)

Mỗi criteria có ví dụ PASS và FAIL cụ thể.

### G1: File Count ≤ 2

Thay đổi chỉ chạm đến 1-2 file.

| PASS ✅ | FAIL ❌ |
|---|---|
| Sửa 1 file validation message | Sửa validation ở 3 file khác nhau |
| Đổi màu trong 1 CSS file + 1 component | Thêm field cần sửa model + controller + service + test |
| Sửa typo trong 1 file config | Refactor function signature ảnh hưởng 5 file |

### G2: Không API/Schema/Migration Mới

Không endpoint mới, không DB migration, không schema thay đổi.

| PASS ✅ | FAIL ❌ |
|---|---|
| Sửa error message trong response | Thêm field mới vào API response |
| Thêm comment, xóa code chết | Thêm DB column hoặc migration |
| Đổi log level | Thêm query param mới |

**Borderline case**: "Thêm 1 field vào response nhưng field đó đã có trong DB" → FAIL (G2: API change).

### G3: Không Security/Billing/Auth/Data-Integrity

Không đụng đến auth middleware, billing logic, PII, data integrity.

| PASS ✅ | FAIL ❌ |
|---|---|
| Sửa text label trên UI | Sửa logic trong auth middleware |
| Đổi CSS class name | Đụng đến billing calculation |
| Thêm log statement | Thay đổi permission check |

**Nguyên tắc**: Nếu file nằm trong package `auth/`, `billing/`, `security/`, `payment/` → auto-FAIL.

### G4: Không Service/Boundary Mới

Không service mới, không module boundary mới.

| PASS ✅ | FAIL ❌ |
|---|---|
| Sửa implementation trong service hiện có | Tạo service class mới |
| Đổi error handling trong 1 controller | Tách module mới từ code hiện có |
| Sửa constant value | Định nghĩa interface mới |

### G5: Logic Bounded & Localized

Thay đổi không gây cascading effect.

| PASS ✅ | FAIL ❌ |
|---|---|
| Sửa regex trong validation | Đổi function signature (ảnh hưởng callers) |
| Thêm null check | Thay đổi behavior của shared utility |
| Sửa format string | Sửa base class hoặc abstract method |

---

## Triage Grill Rounds

### Round 1: Scope Confirm

> "Mô tả ngắn gọn thay đổi cần làm — cho tôi biết chính xác file nào và thay đổi gì?"

Mục tiêu: Xác nhận G1+G5.

```javascript
AskUserQuestion({
  questions: [{
    question: "Thay đổi này chạm đến những file nào?",
    header: "Scope",
    options: [
      { label: "1 file", description: "Thay đổi trong 1 file duy nhất" },
      { label: "2 files", description: "Thay đổi trong 2 file" },
      { label: "> 2 files", description: "Thay đổi trong 3 file trở lên" },
      { label: "Chưa rõ", description: "Tôi không chắc có bao nhiêu file bị ảnh hưởng" }
    ],
    multiSelect: false
  }]
})
```

- "1 file" hoặc "2 files" → PASS G1, tiếp tục round 2
- "> 2 files" → FAIL G1 → escalate
- "Chưa rõ" → follow-up: "Bạn có thể liệt kê các file dự kiến không?" → nếu vẫn không rõ → escalate

### Round 2: Safety Check

> "Thay đổi này có đụng đến API endpoints, database schema, auth/billing, hoặc data integrity không?"

Mục tiêu: Xác nhận G2+G3+G4.

```javascript
AskUserQuestion({
  questions: [{
    question: "Thay đổi này có liên quan đến những khu vực nhạy cảm nào không?",
    header: "Safety",
    options: [
      { label: "Không có", description: "Không đụng gì đến API, schema, auth, billing, data integrity" },
      { label: "Có API/schema", description: "Có endpoint mới, DB migration, hoặc schema thay đổi" },
      { label: "Có security/billing", description: "Đụng đến auth, billing, PII, hoặc data integrity" },
      { label: "Không chắc", description: "Tôi không chắc có đụng đến khu vực nhạy cảm không" }
    ],
    multiSelect: false
  }]
})
```

- "Không có" → PASS G2+G3, tiếp tục (có thể hỏi round 3 nếu borderline)
- "Có API/schema" hoặc "Có security/billing" → escalate
- "Không chắc" → escalate (không thể proceed nếu không chắc về safety)

### Round 3: Impact (Conditional)

Chỉ hỏi nếu round 1-2 có dấu hiệu borderline nhưng chưa đủ để fail gate rõ ràng.

> "Thay đổi này có khả năng ảnh hưởng đến code khác không? Function/tham số nào khác dùng chung không?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Thay đổi này có thể tác động đến code khác không?",
    header: "Impact",
    options: [
      { label: "Không", description: "Thay đổi hoàn toàn isolated, không ảnh hưởng gì khác" },
      { label: "Có thể", description: "Có khả năng ảnh hưởng code khác" },
      { label: "Không chắc", description: "Tôi cần kiểm tra thêm" }
    ],
    multiSelect: false
  }]
})
```

---

## Exit Criteria Tổng Hợp

Sau triage grill, PHẢI đạt được các xác nhận sau:

| Criteria | Nguồn | Required |
|---|---|---|
| File count ≤ 2 | Round 1 | **Bắt buộc** |
| Không API/schema mới | Round 2 | **Bắt buộc** |
| Không security/billing/auth/data-integrity impact | Round 2 | **Bắt buộc** |
| Không service/boundary mới | Round 2 | **Bắt buộc** |
| Logic bounded & localized | Round 1 (+ Round 3 nếu cần) | **Bắt buộc** |

Thiếu **bất kỳ** criteria bắt buộc nào → escalate.

---

## Triage Decision Matrix

| Round 1 | Round 2 | Round 3 (nếu có) | Kết quả |
|---|---|---|---|
| ≤2 files | Không có safety concern | N/A hoặc "Không" | ✅ **Trivial → Path A hoặc B** |
| ≤2 files | Không có safety concern | "Có thể" / "Không chắc" | ⚠️ **Borderline → escalate** |
| ≤2 files | "Không chắc" | N/A | 🔴 **Escalate** |
| "> 2 files" hoặc "Chưa rõ" | Bất kỳ | N/A | 🔴 **Escalate** |
| Bất kỳ | "Có API/schema" hoặc "Có security/billing" | N/A | 🔴 **Escalate** |

---

## Phân Loại Path: Ultra-Trivial vs Logic-Trivial

Sau khi triage grill xác nhận trivial, phân loại path:

| Đặc điểm | Path |
|---|---|
| Chỉ sửa text, màu, CSS, config value, constant, comment | **Ultra-Trivial** (không guard test) |
| Sửa validation message, error message, log statement | **Ultra-Trivial** (không guard test) |
| Thêm null check, sửa regex, sửa format, thêm field simple | **Logic-Trivial** (cần guard test) |
| Sửa logic trong 1 function, thêm error handling đơn giản | **Logic-Trivial** (cần guard test) |

> Borderline giữa ultra-trivial và logic-trivial → chọn Logic-Trivial (an toàn hơn).
