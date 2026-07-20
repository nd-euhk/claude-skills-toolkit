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

### 1.1 Tổng quan

> "Tính năng này làm gì? Nó giải quyết vấn đề gì cho ai?"

Mục tiêu: Hiểu được **value proposition** và **problem statement**.

### 1.2 Users & Personas

> "Những ai sẽ dùng tính năng này? Có những role nào? Mỗi role có quyền gì?"

Dùng `AskUserQuestion` nếu cần chọn giữa các role:

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

### 1.3 User Flows

> "Luồng chính xác thế nào? Mô tả từng bước user làm gì, hệ thống phản hồi ra sao.
> Có những happy path và alternative path nào?"

Template ghi nhận:

```
Happy Path: [từng bước]
Alternative Path 1: [điều kiện → các bước]
Alternative Path 2: [điều kiện → các bước]
```

### 1.4 Acceptance Criteria

> "Làm sao biết feature đã hoàn thành? Tiêu chí cụ thể, đo lường được?"

Yêu cầu ít nhất 3 criteria cụ thể. Dùng AskUserQuestion để xác nhận:

```javascript
AskUserQuestion({
  questions: [{
    question: "Xác nhận acceptance criteria đã đủ chưa?",
    header: "AC",
    options: [
      { label: "Đủ", description: "Các criteria trên đã cover đầy đủ yêu cầu" },
      { label: "Thêm nữa", description: "Tôi muốn bổ sung thêm criteria" }
    ],
    multiSelect: false
  }]
})
```

### 1.5 Business Rules

> "Có những quy tắc nghiệp vụ nào? Validation rules? Constraints? Business invariants?"

### 1.6 Edge Cases

> "Trường hợp đặc biệt? Input không hợp lệ thì sao? Timeout? Concurrent users?"

Gợi ý nếu human chưa nghĩ ra:
- "Điều gì xảy ra nếu 2 users cùng thao tác một lúc?"
- "Điều gì xảy ra nếu external service bị down?"
- "Input dài nhất/ngắn nhất có thể là gì?"
- "Có rate limit không?"

### Round 1 Exit Criteria

- [ ] Ít nhất 3 business requirements rõ ràng
- [ ] Ít nhất 1 user flow với ≥3 bước cụ thể
- [ ] Ít nhất 3 acceptance criteria đo lường được
- [ ] Edge cases đã được thảo luận

---

## Round 2: Non-Functional Requirements (cho SRS + HLD)

### 2.1 Performance

> "p95 latency target cho các operations chính? Throughput (RPS) dự kiến?
> Concurrent users tối đa?"

Dùng `AskUserQuestion` để chọn tier:

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

### 2.2 Availability

> "Uptime yêu cầu (99.X%)? RTO/RPO nếu có disaster? Có cần multi-region không?"

### 2.3 Security

> "AuthZ model? Data classification (public/internal/confidential/restricted)?
> Compliance requirements (GDPR, PCI, HIPAA, SOC2)?"

### 2.4 Scale

> "Data volume dự kiến? Growth rate? Peak traffic patterns (theo giờ/ngày/mùa)?"

### Round 2 Exit Criteria

- [ ] Performance targets định lượng (p95 < Xms)
- [ ] Availability target rõ ràng
- [ ] Security classification đã xác định

---

## Round 3: Architecture & Integration (cho HLD + LLD)

### 3.1 Services

> "Có service mới không? Service nào bị ảnh hưởng? Giao tiếp giữa chúng (sync/async)?"

### 3.2 APIs

> "API contracts mới? Thay đổi API hiện có? Versioning strategy?"

### 3.3 Data

> "Schema mới hoặc thay đổi? Migration cần thiết? Loại database (SQL/NoSQL/Cache)?"

### 3.4 External Dependencies

> "Third-party services? Message queues (Kafka/RabbitMQ)? Caches (Redis)?
> Có dependency nào critical path không?"

### 3.5 Cross-Cutting Concerns

> "Dự án có frontend app (Next.js/React) không? Nếu có, cần kiến trúc frontend riêng?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Dự án có frontend application không?",
    header: "Frontend",
    options: [
      { label: "Có — Next.js", description: "Có frontend Next.js app — cần frontend-architecture.md + frontend-test-strategy.md" },
      { label: "Có — Khác", description: "Có frontend nhưng framework khác (Vue, Svelte, etc.)" },
      { label: "Không", description: "Backend-only — không cần frontend cross-cutting files" }
    ],
    multiSelect: false
  }]
})
```

> "Cần caching infrastructure (Redis) không? Dùng local cache (Caffeine) hay distributed cache?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Cache infrastructure cho dự án?",
    header: "Cache",
    options: [
      { label: "Redis Cluster", description: "Distributed cache — cần caching-strategy.md" },
      { label: "Local only (Caffeine)", description: "In-memory cache per pod" },
      { label: "Không cần cache", description: "Không có cache infrastructure" }
    ],
    multiSelect: false
  }]
})
```

> "Có NFR performance cụ thể không? (p95 latency, QPS targets, concurrent users?)"

```javascript
AskUserQuestion({
  questions: [{
    question: "Performance test requirements?",
    header: "Perf Test",
    options: [
      { label: "Có NFR targets", description: "Đã có p95/QPS targets — cần performance-test.md" },
      { label: "Chưa có NFR", description: "Chưa xác định targets — skip performance test plan" },
      { label: "Không cần perf test", description: "Performance testing ngoài scope" }
    ],
    multiSelect: false
  }]
})
```

### 3.6 Deployment

> "Infrastructure thay đổi? Environment variables mới? Feature flags cần thiết?"

### Round 3 Exit Criteria

- [ ] Service/API inventory (mới + affected) đã liệt kê
- [ ] Data requirements (schema + migration) đã xác định
- [ ] Frontend requirement đã xác định (có/không)
- [ ] Cache infrastructure đã xác định
- [ ] Performance test requirements đã xác định

---

## Round 4: Implementation Context (cho IMP + TST)

### 4.1 Tech Stack

> "Backend/frontend framework? Đã có convention chưa? Có library restrictions không?"

### 4.2 Test Requirements

> "Coverage target? Loại tests cần (unit, integration, E2E, performance)?"

```javascript
AskUserQuestion({
  questions: [{
    question: "Test coverage expectation?",
    header: "Tests",
    options: [
      { label: "Standard", description: "Unit + Integration, 80% line coverage" },
      { label: "High", description: "Unit + Integration + E2E, 90% line coverage" },
      { label: "Critical", description: "Full suite + Performance + Security, 95%+" },
      { label: "Custom", description: "Tự định nghĩa test requirements" }
    ],
    multiSelect: false
  }]
})
```

> "Nếu có frontend app: cần test strategy riêng cho frontend không? (Vitest + Playwright + MSW setup, test pyramid, coverage targets)"

```javascript
AskUserQuestion({
  questions: [{
    question: "Cần frontend test strategy không?",
    header: "FE Test",
    options: [
      { label: "Có", description: "Tạo frontend-test-strategy.md — test pyramid, MSW, E2E patterns" },
      { label: "Không", description: "Không cần test strategy riêng cho frontend" }
    ],
    multiSelect: false
  }]
})
```

### 4.3 Constraints

> "Deadline? Team size? Dependency giữa các task khác? Có blocked bởi team khác không?"

### 4.4 Existing Code

> "Có code hiện có cần refactor không? File nào bị ảnh hưởng?
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
