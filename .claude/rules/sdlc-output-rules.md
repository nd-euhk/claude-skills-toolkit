# SDLC Output Rules

<EXTREMELY-IMPORTANT>
Output do skill/subagent/workflow sinh ra là thứ human và agent downstream ĐỌC để ra
quyết định. Mọi từ viết tắt hoặc thuật ngữ khó hiểu buộc người đọc phải tự giải mã,
làm chậm giao tiếp và ra quyết định. Nguyên tắc cốt lõi:

**"Bất cứ điều gì cần giải thích thêm đều làm chậm giao tiếp và ra quyết định"** —
định nghĩa một lần ngay tại chỗ dùng, rẻ hơn để người đọc đoán.
</EXTREMELY-IMPORTANT>

## Hai Kênh Output

Output của agents chảy qua 2 kênh với reader khác nhau — clarity yêu cầu khác nhau:

| Kênh | Reader | Ví dụ |
|------|--------|-------|
| **File artifact** | Agent downstream (SSOT) | `agent_docs/*.md` — specs, design, test specs |
| **Returned message** | Human (HITL) hoặc controller | Gate report, review finding, escalation/status message, PR description |

## Quy Tắc 3 Tầng Cho Acronym & Thuật Ngữ

| Tầng | Loại | Quy tắc | Ví dụ |
|------|------|---------|-------|
| **1** | Acronym chuẩn ngành, là identifier | Giữ nguyên | SRS, HLD, LLD, TDD, NFR, C4, ADR, CR, PR, SBOM, TC, IMP, TST |
| **2** | Thuật ngữ business/domain-specific hoặc viết tắt tự chế | Mở rộng ở lần dùng đầu, hoặc đưa vào section Glossary của document | LRB, MoSCoW, SSOT, thuật ngữ nghiệp vụ khách hàng |
| **3** | Mọi output human-facing | Mở rộng acronym lần dùng đầu — kể cả Tầng 1 | Gate report, review, escalation, PR description, `docs/` |

### Giải thích từng tầng

- **Tầng 1** — Trong `agent_docs/` (SSOT cho agent), acronym chuẩn ngành LÀ tên của
  phase/agent/flow. Mở rộng chúng chỉ thêm token, không thêm thông tin — Claude đã biết
  SRS là gì. Đây là lý do không áp dụng nguyên tắc "mở rộng mọi viết tắt" đồng đều.
- **Tầng 2** — Nguồn nhiễu thật. Thuật ngữ nghiệp vụ hoặc viết tắt do repo/tổ chức tự chế,
  không ai mở rộng, buộc reader phải đoán. Mở rộng ở lần dùng đầu, hoặc gom vào section
  Glossary (các template đã có sẵn: `project-overview-TEMPLATE.md` §6, `SRS-TEMPLATE.md` §1.3).
- **Tầng 3** — Human đọc output để RA QUYẾT ĐỊNH (pass/fail, approve, escalate), không phải
  để giải mã. Chi phí mở rộng một lần nhỏ hơn nhiều so với chi phí người đọc đoán sai.

## Áp Dụng Theo Loại Agent

| Agent | Tầng áp dụng | Ghi chú |
|-------|-------------|---------|
| Spec agent (SRS/HLD/LLD/IMP/TST, `codebase-*`) | 1 + 2 | Thuật ngữ domain mới → glossary hoặc mở rộng inline |
| Gate agent (`sdlc-gate`, `codebase-gate`, `sdlc-tdd-*-gate`) | 3 | Report trả về human — viết tên phase/artifact đầy đủ ở lần đầu xuất hiện |
| Review agent (`sdlc-review-mr`, `sdlc-review-codechange`) | 3 | Findings cho human |
| Controller (orchestrator/automation/cook) | 3 | Escalation + status message cho human |
| human-docs agent | 3 | `docs/` đã là human-facing — bắt buộc |

## Tương Tác Với Rule Khác

- Bổ sung cho `content-taste.md` (writing cho human): content-taste bắt "jargon undefined"
  như một failure mode; rule này cho cơ chế cụ thể (3-tier + define-on-first-use) áp dụng
  xuyên suốt mọi artifact, không chỉ prose.
- Không xung đột với "Conciseness / Token accountability" trong CLAUDE.md: acronym chuẩn
  ngành ở Tầng 1 là identifier — mở rộng chúng là LÃNG PHÍ token, không phải tiết kiệm.
