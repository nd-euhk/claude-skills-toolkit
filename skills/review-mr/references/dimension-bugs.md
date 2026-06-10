# Bug Detection — Workflow & Checklist

Tài liệu tham khảo cho bug detection dimension. Dùng bởi main agent để hiểu scope và bởi subagent `review-mr-bugs` khi thực thi.

## Workflow Overview

### 1. Scout Edge Cases
Spawn `Agent(Explore)` tìm: consumers của changed files, dependencies, data flow paths, state mutations, async/callback chains.

### 2. Per-File Bug Detection (5 categories)

#### 2a. Logic Bugs
Inverted conditions, off-by-one errors, wrong variable reference, boolean logic errors, switch fallthrough, assignment vs comparison (`=` vs `==`), operator precedence, floating point comparison, integer division, short-circuit misuse.

#### 2b. Race Conditions
Shared mutable state without synchronization, async operations without error handling, promise/goroutine/thread leaks, deadlock potential (nested locks), TOCTOU, event listener leaks, concurrent collection writes.

#### 2c. Edge Cases
null/undefined/nil/None handling, empty states (string, array, object), boundary values (0, -1, MAX_INT, NaN, Infinity), type coercion traps, unicode/encoding edge cases, large values, negative values, duplicate values.

#### 2d. Error Handling
Empty catch blocks, overly broad catch, missing error propagation, retry without backoff, retry without limit, missing timeout, partial failure reporting, resource cleanup in error paths, transaction rollback.

#### 2e. Type Safety
Type assertion without guard, implicit any (TypeScript), union type not exhausted, optional chaining misuse, type narrowing lost, generic type misuse, enum mismatch.

### 3. Cross-File Analysis
Changed function signatures match all call sites? New exports used correctly by consumers? Operation order consistent? Assumptions violated by other changes?

## Checklist

### Pre-Review: Edge Case Scout
- [ ] Spawn Agent(Explore) tìm consumers của changed files
- [ ] Spawn Agent(Explore) tìm dependencies của changed files
- [ ] Map data flow paths qua changed code
- [ ] Map state mutations liên quan
- [ ] Map async/callback chains

### Logic Bugs
- [ ] **Inverted conditions**: `if (x)` vs `if (!x)`?
- [ ] **Off-by-one**: `<=` vs `<`, loop boundaries?
- [ ] **Wrong variable**: copy-paste chưa rename?
- [ ] **Boolean logic**: `&&` vs `||`, missing parens?
- [ ] **Switch fallthrough**: missing `break`?
- [ ] **Assignment vs comparison**: `=` vs `==`/`===`?
- [ ] **Operator precedence**: missing parens?
- [ ] **Float comparison**: `==` on floats?
- [ ] **Integer division**: truncation expected?
- [ ] **Short-circuit misuse**: side effects skipped?

### Race Conditions
- [ ] **Shared mutable state** không sync?
- [ ] **Async operations** không error handling?
- [ ] **Promise/goroutine leak**?
- [ ] **Deadlock**: nested locks inconsistent order?
- [ ] **TOCTOU**: check rồi act, state thay đổi?
- [ ] **Event listener leak**?
- [ ] **Lazy init** không sync?
- [ ] **Concurrent collection writes**?

### Edge Cases
- [ ] **null/undefined/nil/None**: checked trước khi dùng?
- [ ] **Empty states**: string, array, object, response?
- [ ] **Boundary values**: 0, -1, MAX_INT, NaN, Infinity?
- [ ] **Type coercion**: `==` vs `===`, falsy traps?
- [ ] **Unicode/encoding**: multi-byte, RTL, emoji?
- [ ] **Large values**: long strings, big numbers?
- [ ] **Negative values**: khi chỉ positive expected?
- [ ] **Duplicate values**: keys, entries?
- [ ] **Concurrent modification**: iterate + modify?

### Error Handling
- [ ] **Empty catch**: `catch (e) {}`?
- [ ] **Broad catch**: `catch (Exception)` không re-throw?
- [ ] **Missing propagation**: error không return/throw?
- [ ] **Retry without backoff**: immediate retry?
- [ ] **Retry without limit**: infinite loop?
- [ ] **Missing timeout**: network/IO không timeout?
- [ ] **Partial failure**: không report?
- [ ] **Resource cleanup**: files/connections/locks trong error paths?
- [ ] **Transaction rollback**: missing trong multi-step?

### Type Safety
- [ ] **Type assertion không guard**: `as Type` không check?
- [ ] **Implicit any**: TypeScript `any` bypass?
- [ ] **Union type not exhausted**: missing cases?
- [ ] **Optional chaining misuse**: `?.` rồi không null-check?
- [ ] **Type narrowing lost**: narrow rồi mất?
- [ ] **Generic type misuse**: `any` cast về typed?
- [ ] **Enum mismatch**: so sánh khác type?

### Cross-File
- [ ] Changed function signatures match call sites?
- [ ] New exports used correctly by consumers?
- [ ] Operation order consistent across files?
- [ ] Assumptions consistent across files?

## Verdict Decision Tree
```
Có logic error confirmed? → BUG_FOUND
Có race condition confirmed? → BUG_FOUND
Có null crash confirmed? → BUG_FOUND
Có memory leak confirmed? → BUG_FOUND
Có potential bug (uncertain)? → NEEDS_ATTENTION
Có edge case chưa handle? → NEEDS_ATTENTION
Không có vấn đề gì → APPROVED
```
