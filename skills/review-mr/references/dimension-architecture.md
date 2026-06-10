# Architecture Review — Workflow & Checklist

Tài liệu tham khảo cho architecture review dimension. Dùng bởi main agent để hiểu scope và bởi subagent `review-mr-arch` khi thực thi.

## Workflow Overview

### 1. Classify Change Type
Phân loại MR: new service/module, API change, database schema, config, refactor, dependency, infrastructure.

### 2. Scout Architecture Context
Spawn `Agent(Explore)` tìm: `**/ARCHITECTURE.md`, `**/adr/**/*.md`, `**/CLAUDE.md`, dependency graphs.

### 3. Evaluate C4 Model Impact
- **System Context**: External dependency changes? New integrations properly abstracted?
- **Container**: Service boundary changes? New service scope appropriate? Inter-service communication patterns?
- **Component**: Dependency rules violated? Circular dependencies? Correct layer placement?

### 4. Check ADR Compliance
- Read ADRs in changed area
- Flag ADR violations
- Flag architectural decisions without corresponding ADR

### 5. Evaluate Design Quality
- **Coupling/Cohesion**: Increased coupling? New components focused?
- **SOLID**: Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
- **Bounded Context**: Domain logic leaks?
- **Layering**: Infrastructure code in domain layer?

### 6. Impact Analysis
- Map affected services/modules
- Identify breaking changes and downstream consumers
- Assess migration path and backward compatibility

## Checklist

### Change Classification
- [ ] Xác định loại thay đổi (new service, API, DB, config, refactor, dependency, infra)
- [ ] Đánh giá scope: local (1 module) vs broad (nhiều module)

### C4 Model Impact
- [ ] **System Context**: External dependencies mới hoặc thay đổi?
- [ ] **System Context**: New integrations được abstract đúng cách?
- [ ] **Container**: Service boundaries thay đổi?
- [ ] **Container**: New service có single responsibility?
- [ ] **Container**: Inter-service communication đúng chuẩn?
- [ ] **Component**: Component dependencies bị vi phạm?
- [ ] **Component**: Circular dependency introduced?

### ADR Compliance
- [ ] Đọc ADRs liên quan đến changed area
- [ ] Check vi phạm architectural decision đã documented
- [ ] MR có architectural decision mà không có ADR mới?
- [ ] ADR có cần update không?

### Design Quality
- [ ] **Coupling**: Tăng coupling giữa các module?
- [ ] **Cohesion**: New components tập trung?
- [ ] **Single Responsibility**: Classes/modules làm một việc?
- [ ] **Open/Closed**: Extension thay vì modification?
- [ ] **Liskov Substitution**: Subclasses thực sự substitutable?
- [ ] **Interface Segregation**: Interfaces focused và minimal?
- [ ] **Dependency Inversion**: Depend on abstractions?
- [ ] **Bounded Context**: Domain logic leak qua context khác?
- [ ] **Layering**: Infrastructure code trong domain layer?

### Impact Analysis
- [ ] Map affected services/modules/components
- [ ] Xác định breaking changes
- [ ] Downstream consumers bị ảnh hưởng?
- [ ] Migration path rõ ràng?
- [ ] Backward compatible? (nếu claimed)

## Verdict Decision Tree
```
Có breaking change không có migration path? → URGENT
Có ADR violation? → URGENT
Có domain logic leak qua bounded context? → URGENT
Có circular dependency mới? → URGENT
Có SOLID violation nghiêm trọng? → NEEDS_ATTENTION
Có coupling tăng đáng kể? → NEEDS_ATTENTION
Không có vấn đề gì → APPROVED
```
