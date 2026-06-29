---
name: grill-me
description: >-
  Interactive design interview skill. Activate when user says /grill-me, "grill me",
  "interview me", "align on plan", "clarify requirements", or "ask me questions before starting".
  Interviews user with targeted questions one-by-one to surface ambiguities, resolve design
  decisions, and produce a confirmed plan before any implementation begins.
  OUT OF SCOPE: actual implementation (hand off after plan is confirmed).
version: 1.1.0
allowed-tools: AskUserQuestion,Write
---

# Grill-Me: Interactive Design Interview

**Purpose:** Đóng vai người phỏng vấn — đặt câu hỏi làm rõ từng cái một để align plan trước khi implement bất cứ điều gì.

## Quick Start

1. Kiểm tra context hiện có từ conversation history
2. Chạy Phase 0 → Phase 1 → Phase 2 → Phase 3 theo thứ tự
3. **Tuyệt đối không** gộp nhiều câu hỏi vào một lần — hỏi → chờ → hỏi tiếp
4. **Tuyệt đối không** viết code hoặc implement cho đến khi Phase 3 được confirm

---

## Phase 0: Escape Hatch (Context Detection)

Kiểm tra conversation history trước khi bắt đầu:
- User đã mô tả rõ vấn đề / mục tiêu chưa?
- Đã có tài liệu, URL, code snippet, hoặc spec được chia sẻ chưa?

**NẾU CÓ context rõ ràng** → Dùng AskUserQuestion:

```
Question: "Tôi đã đọc context bạn chia sẻ. Bạn muốn tiếp tục thế nào?"
Options:
  - "Suy luận từ context — bỏ qua Phase 1, hỏi thẳng các điểm còn mơ hồ"
  - "Bắt đầu lại từ đầu — tôi muốn mô tả lại rõ hơn"
```

- **"Suy luận từ context"** → Bỏ qua Phase 1, vào thẳng Phase 2 với các ambiguity đã phát hiện
- **"Bắt đầu lại"** → Phase 1 bình thường

**NẾU KHÔNG CÓ context** → Vào Phase 1 ngay.

---

## Phase 1: Hiểu Mục Tiêu

Hỏi một câu mở bằng AskUserQuestion:

```
Question: "Bạn muốn xây dựng / giải quyết điều gì?"
(free-text, không có options)
```

⏸️ Chờ phản hồi. Sau đó trích xuất:
- **Domain** — feature, architecture, bug, design system, API, infra, etc.
- **Scope hints** — tech stack, constraint, non-negotiable được đề cập
- **Ambiguities** — những điều chưa nói có thể dẫn đến assumption sai

---

## Phase 2: Targeted Grilling (Tối đa 3–5 Câu)

Dựa vào Phase 1, xác định **top 3–5 ambiguity có rủi ro cao nhất**. Hỏi từng câu một.

### Heuristic Phát Hiện Ambiguity

| Signal từ user | Câu hỏi nên hỏi |
|---|---|
| "nhanh", "scalable", "đơn giản" | Cụ thể hoá — con số / tiêu chí là gì? |
| Nhiều stakeholder ẩn | Ai là người ra quyết định chính? |
| Không đề cập tech stack | Tech / framework / language nào? |
| "như X" được reference | Phần nào của X? Điểm khác biệt là gì? |
| Timeline mơ hồ | Deadline cứng / mức độ ưu tiên? |
| Dùng "chúng tôi" | Ai sở hữu? Team structure thế nào? |
| Scope boundary không rõ | Gì là explicitly OUT of scope? |
| Domain = bug / lỗi | Reproduction steps? Frequency? Impact? |
| Domain = API / contract | Breaking change? Backward compat? |
| Domain = architecture | Scale dự kiến? Monolith hay microservices? |

### Rules định dạng câu hỏi

- ✅ **Có options cụ thể** (ưu tiên): AskUserQuestion với 3–4 lựa chọn
- ✅ **Open-ended** (khi options sẽ giới hạn câu trả lời): AskUserQuestion free-text
- ❌ Không hỏi lại điều đã được trả lời trong context
- ❌ Không hỏi quá 5 câu tổng cộng trong Phase 2
- ❌ Nếu user skip / không trả lời → ghi nhận là "không có ràng buộc", tiếp tục

**Ví dụ có options:**
```
Question: "Ai là người dùng chính của tính năng này?"
Options:
  - "Developer nội bộ (internal tooling)"
  - "End-user cuối (customer-facing)"
  - "Cả hai"
```

**Ví dụ open-ended:**
```
Question: "Có ràng buộc nào về tech stack hoặc kiến trúc hiện tại không?"
```

⏸️ Sau MỖI câu hỏi, chờ phản hồi trước khi hỏi tiếp.

---

## Phase 3: Tổng Hợp & Xác Nhận Plan

Sau khi đã hỏi đủ, tổng hợp thành plan có cấu trúc:

```markdown
## 📋 Kế hoạch: [Tóm tắt mục tiêu]

**Mục tiêu:** [1 câu mô tả chúng ta đang xây dựng/giải quyết gì]

**Phạm vi:**
- ✅ Trong scope: [những gì được bao gồm]
- ❌ Ngoài scope: [những gì bị loại trừ rõ ràng]

**Quyết định chốt:**
- [Quyết định 1]: [Lựa chọn + lý do từ phỏng vấn]
- [Quyết định 2]: [Lựa chọn + lý do từ phỏng vấn]

**Ràng buộc:**
- [Tech, timeline, team, hoặc constraint khác đã confirm]

**Tiêu chí hoàn thành:**
- [Làm sao biết task này đã done đúng]

**Bước tiếp theo đề xuất:**
1. [Hành động cụ thể đầu tiên]
2. [Hành động cụ thể thứ hai]
```

Sau đó hỏi xác nhận bằng AskUserQuestion:

```
Question: "Kế hoạch trên có đúng với ý bạn không?"
Options:
  - "✅ Đúng rồi — bắt đầu implement"
  - "🔧 Cần điều chỉnh một số điểm"
  - "🔄 Làm lại từ đầu"
```

⏸️ Chờ xác nhận.

- **"✅ Đúng rồi"** → Dùng `Write` để lưu plan ra file `plan.md` trong thư mục hiện tại, sau đó handoff implement.
- **"🔧 Cần điều chỉnh"** → Hỏi "Bạn muốn điều chỉnh điều gì?" (free-text), cập nhật plan, confirm lại.
- **"🔄 Làm lại"** → Quay về Phase 1.

---

## Quy tắc Cốt lõi

1. **Một câu một lần** — không bao giờ batch nhiều câu hỏi
2. **Tối đa 5 câu** ở Phase 2 — dừng khi đủ tự tin về plan
3. **Options cụ thể được ưu tiên** — giúp user trả lời nhanh hơn
4. **Không implement cho đến khi confirm** — không viết code giữa chừng
5. **Tôn trọng context cũ** — không hỏi lại điều đã có câu trả lời
6. **User skip câu hỏi** → ghi nhận là "không ràng buộc", không chặn workflow
