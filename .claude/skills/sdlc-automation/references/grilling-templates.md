# Grilling Templates — SDLC Automation

Đây là bộ câu hỏi grilling toàn diện cho automation pipeline. Được gọi MỘT LẦN duy nhất
trước khi dispatch workflow. Mỗi round hỏi tuần tự — không hỏi nhiều câu cùng lúc.

## Nguyên tắc grilling

- **Progressive disclosure**: Mỗi lần chỉ hỏi 1 câu. Đợi câu trả lời rồi mới hỏi tiếp.
- **Không skip**: Nếu human không trả lời được câu nào, ghi nhận "chưa xác định" và tiếp tục.
- **Exit criteria**: Phải đạt ít nhất các criteria ở cuối mỗi round trước khi proceed.
- **Context-aware**: Dựa trên câu trả lời trước để điều chỉnh câu hỏi sau.

---

## Round 1: Business Requirements (cho SRS)

### 1.1 Tổng quan & Users

> "Tính năng này làm gì? Giải quyết vấn đề gì cho ai? Những ai sẽ dùng? Có những role nào?"

Dùng `AskUserQuestion` nếu cần chọn role:

```javascript
AskUserQuestion({
  questions: [{
    question: "Xác nhận các user roles cho feature này:",
    header: "Roles",
    options: [
      { label: "Admin", description: "Quản trị viên hệ thống — full access" },
      { label: "User", description: "Người dùng thông thường — self-service" },
      { label: "Guest", description: "Khách — read-only public access" },
      { label: "Khác", description: "Tự định nghĩa role cụ thể" }
    ],
    multiSelect: true
  }]
})
```

### 1.2 User Flows

> "Luồng chính xác thế nào? Mô tả từng bước user làm gì, hệ thống phản hồi ra sao."

```
Happy Path: [từng bước]
Alternative Path 1: [điều kiện → các bước]
Alternative Path 2: [điều kiện → các bước]
```

### 1.3 Acceptance Criteria & Business Rules

> "Làm sao biết feature đã hoàn thành? Tiêu chí cụ thể, đo lường được?
> Có những quy tắc nghiệp vụ nào? Validation rules? Constraints?"

Yêu cầu ít nhất 3 criteria. Dùng AskUserQuestion để xác nhận:

```javascript
AskUserQuestion({
  questions: [{
    question: "Xác nhận acceptance criteria đã đủ chưa?",
    header: "AC",
    options: [
      { label: "Đủ", description: "Cover đầy đủ yêu cầu" },
      { label: "Thêm nữa", description: "Bổ sung thêm criteria" }
    ],
    multiSelect: false
  }]
})
```

### 1.4 Edge Cases

> "Trường hợp đặc biệt? Input không hợp lệ? Timeout? Concurrent users?"

Gợi ý: "Điều gì xảy ra nếu 2 users cùng thao tác? External service down?
Input dài nhất/ngắn nhất? Có rate limit không?"

### Round 1 Exit Criteria

- [ ] Ít nhất 3 business requirements rõ ràng
- [ ] Ít nhất 1 user flow với ≥3 bước cụ thể
- [ ] Ít nhất 3 acceptance criteria đo lường được
- [ ] Edge cases đã được thảo luận

---

## Round 2: Non-Functional Requirements (cho SRS + HLD)

### 2.1 Performance & Availability

> "p95 latency target cho các operations chính? Throughput (RPS) dự kiến?
> Concurrent users tối đa? Uptime yêu cầu (99.X%)? RTO/RPO nếu có disaster?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Performance tier cho feature này?",
    header: "Perf",
    options: [
      { label: "Standard", description: "p95 < 500ms, 100 RPS, <1000 CCU" },
      { label: "High", description: "p95 < 100ms, 1000 RPS, <10000 CCU" },
      { label: "Real-time", description: "p95 < 50ms, 10000+ RPS, <100000 CCU" },
      { label: "Custom", description: "Tự định nghĩa targets cụ thể" }
    ],
    multiSelect: false
  }]
})
```

### 2.2 Security & Scale

> "AuthZ model? Data classification (public/internal/confidential/restricted)?
> Compliance requirements (GDPR, PCI, HIPAA, SOC2)?
> Data volume dự kiến? Growth rate? Peak traffic patterns?"

### Round 2 Exit Criteria

- [ ] Performance targets định lượng (p95 < Xms)
- [ ] Availability target rõ ràng
- [ ] Security classification đã xác định

---

## Round 3: Architecture & Integration (cho HLD + LLD)

> **Note**: Kiến trúc system đã được chốt ở Architecture Gate (SKILL.md Bước 3) trước khi
> dispatch — nếu `agent_docs/architecture.md` tồn tại, Round 3 này dùng để validate + thu
> thập context bổ sung (service ảnh hưởng, API contracts, dependencies), KHÔNG re-design.

### 3.1 Services & APIs

> "Có service mới không? Service nào bị ảnh hưởng? Giao tiếp sync/async?
> API contracts mới? Thay đổi API hiện có? Versioning strategy?"

### 3.2 Data & External Dependencies

> "Schema mới hoặc thay đổi? Migration cần thiết? Loại database (SQL/NoSQL/Cache)?
> Third-party services? Message queues (Kafka/RabbitMQ)? Caches (Redis)?
> Có dependency nào critical path không?"

### 3.3 Cross-Cutting Concerns

> "Dự án có frontend app không? Cần caching infrastructure (Redis) không? Có NFR performance targets không?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Dự án có frontend application không?",
    header: "Frontend",
    options: [
      { label: "Có — Next.js", description: "Có frontend Next.js app" },
      { label: "Có — Khác", description: "Frontend framework khác (Vue, Svelte...)" },
      { label: "Không", description: "Backend-only" }
    ],
    multiSelect: false
  }]
})
```

```javascript
AskUserQuestion({
  questions: [{
    question: "Cache infrastructure cho dự án?",
    header: "Cache",
    options: [
      { label: "Redis Cluster", description: "Distributed cache" },
      { label: "Local only (Caffeine)", description: "In-memory cache per pod" },
      { label: "Không cần cache", description: "Không có cache infrastructure" }
    ],
    multiSelect: false
  }]
})
```

```javascript
AskUserQuestion({
  questions: [{
    question: "Performance test requirements?",
    header: "Perf Test",
    options: [
      { label: "Có NFR targets", description: "Có p95/QPS targets" },
      { label: "Chưa có NFR", description: "Skip performance test plan" },
      { label: "Không cần perf test", description: "Performance testing ngoài scope" }
    ],
    multiSelect: false
  }]
})
```

### 3.4 Deployment

> "Infrastructure thay đổi? Environment variables mới? Feature flags cần thiết?"

### Round 3 Exit Criteria

- [ ] Service/API inventory (mới + affected) đã liệt kê
- [ ] Data requirements (schema + migration) đã xác định
- [ ] Frontend, cache, performance test requirements đã xác định

---

## Round 4: Implementation Context (cho IMP + TST)

### 4.1 Tech Stack

> "Backend/frontend framework? Đã có convention chưa? Có library restrictions không?"

### 4.2 Test Requirements

> "Coverage target? Loại tests cần (unit, integration, E2E, performance)?
> Nếu có frontend app: cần test strategy riêng không?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Test coverage expectation?",
    header: "Tests",
    options: [
      { label: "Standard", description: "Unit + Integration, 80% line coverage" },
      { label: "High", description: "Unit + Integration + E2E, 90%+" },
      { label: "Critical", description: "Full suite + Performance + Security, 95%+" },
      { label: "Custom", description: "Tự định nghĩa" }
    ],
    multiSelect: false
  }]
})
```

```javascript
AskUserQuestion({
  questions: [{
    question: "Cần frontend test strategy riêng không?",
    header: "FE Test",
    options: [
      { label: "Có", description: "Tạo frontend-test-strategy.md" },
      { label: "Không", description: "Không cần test strategy riêng cho frontend" }
    ],
    multiSelect: false
  }]
})
```

### 4.3 Constraints & Existing Code

> "Deadline? Team size? Dependency giữa các task? Có blocked bởi team khác không?
> Có code hiện có cần refactor không? File nào bị ảnh hưởng?
> Có technical debt cần giải quyết trong scope này không?"

### Round 4 Exit Criteria

- [ ] Tech stack đã xác nhận
- [ ] Test coverage expectations rõ ràng
- [ ] Constraints và dependencies đã liệt kê

---

## Grilling Exit Criteria (tổng hợp)

Trước khi proceed sang dispatch, xác nhận đã có:

- [ ] Ít nhất 3 business requirements rõ ràng
- [ ] Ít nhất 1 user flow với các bước cụ thể
- [ ] Performance targets định lượng (p95 < Xms)
- [ ] Service/API inventory (mới + affected)
- [ ] Data requirements (schema + migration)
- [ ] Test coverage expectations

Nếu thiếu bất kỳ criteria nào → hỏi thêm. **Không proceed khi chưa đủ.**
