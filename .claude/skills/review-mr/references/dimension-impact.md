# Feature Impact Review — Workflow & Checklist

Tài liệu tham khảo cho feature impact review dimension. Dùng bởi main agent để hiểu scope và bởi subagent `review-mr-impact` khi thực thi.

## Workflow Overview

### 1. Map Shared Code & Consumers
Spawn `Agent(Explore)` tìm tất cả consumers của changed files/classes/functions/components.

### 2. Cross-Feature Impact
Với mỗi changed code, xác định feature nào bị ảnh hưởng, intentional hay unintentional change.

### 3. Interface/Implementation Consistency
Nếu MR implements/extends interface/abstract: kiểm tra behavioral contract, side-effect symmetry, error consistency giữa tất cả implementations.

### 4. Registration & Wiring
Kiểm tra DI/IoC registration, factory pattern, service loader auto-discovery.

### 5. Downstream Client Impact
API consumers, response format changes, contract versioning.

### 6. Regression Risk
Test coverage, critical path analysis, change complexity, git history.

## Checklist

### Shared Code Discovery
- [ ] Spawn Agent(Explore) tìm consumers của changed files
- [ ] Spawn Agent(Explore) tìm implementations của changed interfaces/abstracts
- [ ] Map shared components, hooks, utilities, helpers bị thay đổi
- [ ] Map bounded contexts/domains dùng changed code

### Cross-Feature Impact
- [ ] Mỗi changed code → liệt kê features/flows tham gia
- [ ] Đánh dấu intentional vs unintentional change
- [ ] Kiểm tra MR description có đề cập tất cả affected features không
- [ ] Shared component change → audit TẤT CẢ consumers
- [ ] UI/UX flow thay đổi → documented?

### Interface & Implementation Consistency
- [ ] Tìm TẤT CẢ implementations khác của cùng interface/abstract
- [ ] **Behavioral contract**: Cùng output cho cùng input?
- [ ] **Side-effect symmetry**: Các impl khác có giả định không side-effect?
- [ ] **Error consistency**: Cùng exception types? Cùng error format?
- [ ] **Null/empty contract**: Cùng behavior cho null/empty/zero?
- [ ] **Threading model**: Sync/async pattern nhất quán?
- [ ] **Performance**: Impl mới có khác biệt lớn về perf?
- [ ] **Shared test fixtures**: Impl mới có làm gãy test của impl khác?
- [ ] **Contract tests**: Impl mới có pass interface-level test suites?

### Registration & Wiring
- [ ] **DI/IoC**: Impl mới được register? Qualifier/profile đúng? Conflict?
- [ ] **Factory pattern**: Impl mới có trong factory switch/map?
- [ ] **Service loader**: Auto-discovery — intended hay unintended?
- [ ] **Conditional wiring**: Active đúng environments?

### Downstream Client Impact
- [ ] API consumers: mobile app? web client? external integrations?
- [ ] Response format thay đổi → clients có silent break?
- [ ] Contract versioning: backward-compatible? deprecation period?

### Regression Risk
- [ ] Test coverage cho changed code paths?
- [ ] Critical path bị affected? (login, payment, data integrity)
- [ ] High-complexity area? (cyclomatic complexity cao)
- [ ] Git history có regression trong file/module này trước đây?
- [ ] `git log --oneline -- <changed-files> | head -20`

## Verdict Decision Tree
```
Có shared component thay đổi mà không audit consumers? → BLOCKER
Có interface contract bị vi phạm? → BLOCKER
Có feature behavior thay đổi unintentional? → BLOCKER
Có impl mới không được register trong DI/Factory? → BLOCKER
Có shared test fixture bị gãy? → BLOCKER
Có breaking API change không có migration path? → BLOCKER
Có critical path không có test coverage? → BLOCKER
Có undocumented cross-feature impact? → HIGH_RISK
Có behavior inconsistency giữa impls? → HIGH_RISK
Có regression risk (low test coverage) trên non-critical path? → CAUTION
Không có vấn đề gì → LOW_RISK
```
