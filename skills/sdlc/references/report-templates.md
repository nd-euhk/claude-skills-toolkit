# Report Templates cho SDLC Flow Skills

Mẫu báo cáo dùng chung cho các flow skill. Mỗi template có placeholder `{...}` —
flow skill điền giá trị cụ thể và trình bày cho con người.

## 1. Flow task — Kết Quả Phát Triển Tính Năng

```markdown
📊 Flow task — Kết Quả Phát Triển Tính Năng

**Tính năng:** FR-{epic}-{NNN}--{slug}
**Service:** {service}
**Ticket:** {ticket-id}
**Ngày:** {YYYY-MM-DD}

### Files Đã Tạo/Sửa
| File | Agent | Trạng Thái |
|------|-------|-----------|
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}.md | k-spec-writer | ✅ |
| knowledge/02-central-contracts/... | k-contract-updater | ✅ / ⊘ skipped |
| knowledge/04-microservices/{svc}/tech-design.md | k-techdesign-updater | ✅ |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-impl.md | k-impl-writer | ✅ |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md | k-test-writer | ✅ |

### Tóm Tắt
- {số lượng scenario} Gherkin scenarios đã được đặc tả
- {số lượng API/Event/Error} contracts được cập nhật
- {số lượng work package} feature work packages trong tech-design

### Bước Tiếp Theo
▶️ Chạy Coder Agent trên repo source code với các specs này.
```

## 2. Flow fixbug — Kết Quả Sửa Lỗi

```markdown
📊 Flow fixbug — Kết Quả Sửa Lỗi

**Bug:** {bug-description}
**Severity:** {P1/P2/P3}
**Service:** {service}
**FR:** FR-{epic}-{NNN}
**Ngày:** {YYYY-MM-DD}

### Root Cause
{phân tích nguyên nhân gốc — tại sao bug xảy ra, scenario nào bị thiếu}

### Files Đã Sửa
| File | Hành Động | Agent |
|------|----------|-------|
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}.md | Bổ sung scenario {tên scenario} | k-spec-writer |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md | Bổ sung test case cho scenario mới | k-test-writer |
| knowledge/04-microservices/{svc}/tech-design.md | Cập nhật error flow {tên error} | k-techdesign-updater / ⊘ skipped |

### Bước Tiếp Theo
▶️ Chạy Coder Agent trên repo source code:
   1. Chạy test → ĐỎ (do scenario mới)
   2. Sửa code → XANH
   3. Deploy fix
```

## 3. Flow contract — Kết Quả Thay Đổi Giao Kèo

```markdown
📊 Flow contract — Kết Quả Thay Đổi Giao Kèo

**Contract:** {file}
**Loại thay đổi:** API / Event / Error Code
**Breaking:** YES / NO
**Ngày:** {YYYY-MM-DD}

### Impact Map
| # | Service | Role | Impact | Status |
|---|---------|------|--------|--------|
| 1 | {svc} | Provider | HIGH | ✅ |
| 2 | {svc} | Consumer | HIGH | ✅ |
| 3 | {svc} | Consumer | MEDIUM | ✅ |

### Files Đã Sửa
| File | Service | Agent | Trạng Thái |
|------|---------|-------|-----------|
| knowledge/02-central-contracts/{file} | (global) | k-contract-updater | ✅ |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-impl.md | {svc} | k-impl-writer | ✅ |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md | {svc} | k-test-writer | ✅ |
| knowledge/04-microservices/{svc}/tech-design.md | {svc} | k-techdesign-updater | ✅ |

### Bước Tiếp Theo
▶️ Bắn tín hiệu ĐỒNG LOẠT xuống các repo source code:
   - {svc}: cập nhật API implementation
   - {svc}: cập nhật REST client
   - {svc}: cập nhật error handling
```

## 4. Flow compliance — Kết Quả Cập Nhật Kiến Trúc & Tiêu Chuẩn

```markdown
📊 Flow compliance — Kết Quả Cập Nhật Kiến Trúc & Tiêu Chuẩn

**Quyết định:** {decision}
**ADR:** ADR-{NNN} (nếu có)
**Ngày:** {YYYY-MM-DD}

### Tiêu Chuẩn Đã Cập Nhật
| File | Rule Cũ | Rule Mới | Lý Do |
|------|---------|---------|-------|
| knowledge/01-global-standards/{file}.md | {old} | {new} | {reason} |

### Kết Quả Quét Tuân Thủ
| Mức Độ | Số Lượng |
|--------|---------|
| 🔴 Critical | {n} |
| 🟠 High | {n} |
| 🟡 Medium | {n} |
| 🟢 Low | {n} |
| **Tổng** | **{n}** |

### Danh Sách Technical Debt (Top 5 Critical)
| # | Service | File | Vi Phạm | Mức Độ |
|---|---------|------|---------|--------|
| 1 | {svc} | {path} | {desc} | Critical |
| 2 | {svc} | {path} | {desc} | Critical |
| 3 | {svc} | {path} | {desc} | Critical |
| 4 | {svc} | {path} | {desc} | Critical |
| 5 | {svc} | {path} | {desc} | Critical |

### Báo Cáo Chi Tiết
Xem: `knowledge/04-microservices/_compliance-reports/{date}--{standard}-audit.md`

### Kế Hoạch Hành Động
1. 🔴 Critical ({n} items) — Deadline: {date}
2. 🟠 High ({n} items) — Deadline: {date}
3. 🟡 Medium ({n} items) — Next sprint
4. 🟢 Low ({n} items) — Backlog
```

## 5. Flow cr — Kết Quả Yêu Cầu Thay Đổi

```markdown
📊 Flow cr — Kết Quả Yêu Cầu Thay Đổi

**CR:** {task-id}: {task-title}
**Service:** {service}
**Ngày:** {YYYY-MM-DD}

### Impact Assessment
| Pha | Bị Ảnh Hưởng? | Lý Do |
|-----|---------------|-------|
| HLD | YES / NO | {rationale} |
| LLD | YES / NO | {rationale} |
| IMP | YES (luôn luôn) | — |
| TST | YES (luôn luôn) | — |

### Files Đã Sửa
| File | Hành Động | Agent | Trạng Thái |
|------|----------|-------|-----------|
| knowledge/03-system-architecture/C4-context-diagram.md | Cập nhật bounded context | k-architect-reviewer | ✅ / ⊘ skipped |
| knowledge/03-system-architecture/ADRs/ADR-{NNN}--{slug}.md | Tạo ADR mới | k-architect-reviewer | ✅ / ⊘ skipped |
| knowledge/04-microservices/{svc}/tech-design.md | Cập nhật sections: {list} | k-techdesign-updater | ✅ / ⊘ skipped |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-impl.md | Cập nhật execution flow, error handling | k-impl-writer | ✅ |
| knowledge/04-microservices/{svc}/FR-{epic}-{NNN}--{slug}-test.md | Bổ sung test case cho thay đổi | k-test-writer | ✅ |

### Tóm Tắt
- HLD: {đã cập nhật / không bị ảnh hưởng}
- LLD: {đã cập nhật / không bị ảnh hưởng}
- IMP: {n} FR specs đã cập nhật
- TST: {n} test specs đã cập nhật

### Bước Tiếp Theo
▶️ Chạy Coder Agent trên repo source code với các specs đã cập nhật.
   CR có thể yêu cầu regression test cho các FR không bị ảnh hưởng.
```

## 6. SDLC Orchestrator — Tổng Hợp

```markdown
📊 SDLC — Kết Quả Thực Thi

**Flow:** {task|fixbug|cr|contract|compliance}
**Service:** {service}
**Ngày:** {YYYY-MM-DD}

### Files Đã Tạo/Sửa
| File | Hành Động | Agent |
|------|----------|-------|
| knowledge/... | created/updated | k-xxx |

### Tóm Tắt
- {tóm tắt kết quả — 2-3 câu}

### Bước Tiếp Theo
- {gợi ý bước tiếp theo nếu cần}
```
