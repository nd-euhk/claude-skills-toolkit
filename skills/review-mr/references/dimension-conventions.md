# CLAUDE.md Compliance — Workflow & Checklist

Tài liệu tham khảo cho CLAUDE.md compliance dimension. Dùng bởi main agent để hiểu scope và bởi subagent `review-mr-conventions` khi thực thi.

## Workflow Overview

### 1. Discover CLAUDE.md Files
Tìm tất cả: root `CLAUDE.md`, `**/CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/instructions.md`, submodule CLAUDE.md files.

### 2. Extract Conventions
Parse mỗi CLAUDE.md để extract rules về: naming, code patterns, directory structure, testing, security, documentation, commit/PR conventions.

### 3. Check MR Against Rules
- **File-level**: New files follow naming? In correct directory?
- **Code-level**: New functions follow naming? Endpoints follow patterns? Error handling follow conventions?
- **Structural**: New modules in right layer? Approved libraries? Import conventions?
- **Testing**: New code has tests? Test file naming correct?
- **Documentation**: New features documented? API docs updated?

### 4. Cross-Reference
Approved dependencies list? Preferred approach followed? Anti-patterns avoided? Common mistakes avoided?

## Important Distinction
CLAUDE.md compliance ≠ general code review. Chỉ check rules được khai báo explicit trong CLAUDE.md. Nếu CLAUDE.md không có rule về naming → không flag naming issues.

## Checklist

### CLAUDE.md Discovery
- [ ] Root `CLAUDE.md` found and loaded
- [ ] Per-directory `**/CLAUDE.md` found and loaded
- [ ] `.claude/CLAUDE.md` or `.claude/instructions.md` checked
- [ ] Submodule CLAUDE.md files checked (if any)

### Rule Extraction
- [ ] **Naming Conventions**: File, variable, function, class, test file, directory naming rules
- [ ] **Code Patterns**: API endpoints, error handling, logging, DI, state management
- [ ] **Directory Structure**: File location, layer organization, feature/module organization
- [ ] **Testing Requirements**: Coverage, test types, mock/stub conventions
- [ ] **Security Requirements**: Input validation, auth, data sanitization
- [ ] **Documentation Requirements**: New feature docs, API docs, README updates
- [ ] **Commit/PR Conventions**: Commit format, branch naming

### Compliance Check (per MR file)

#### New Files
- [ ] File naming follows conventions?
- [ ] File in correct directory?
- [ ] Export/import conventions followed?

#### Modified Files
- [ ] Changes maintain existing conventions?
- [ ] No violation of established patterns?

#### New Functions/Classes
- [ ] Naming follows conventions?
- [ ] In correct module/layer?
- [ ] Follows required patterns?

#### New API Endpoints
- [ ] Middleware chain đầy đủ?
- [ ] Validation pattern followed?
- [ ] Response format đúng chuẩn?

#### Error Handling
- [ ] Error handling pattern followed?
- [ ] Error codes/types đúng convention?

#### Logging
- [ ] Log levels đúng?
- [ ] Required fields present?
- [ ] No PII in logs?

#### Testing
- [ ] New code có tests?
- [ ] Test file naming đúng?
- [ ] Test patterns followed?

#### Documentation
- [ ] New features documented?
- [ ] API docs updated?
- [ ] README updated if needed?

## Severity Classification
- **VIOLATION**: Rule uses MUST/REQUIRED/ALWAYS. Direct contradiction. Cite exact CLAUDE.md line/section.
- **WARNING**: Rule uses SHOULD/PREFER/RECOMMENDED. Deviation from suggested pattern.
- **SUGGESTION**: Follows letter but not spirit of convention. Could be improved.

## Verdict Decision Tree
```
Có VIOLATION? → VIOLATION
Có WARNING? → MINOR_ISSUES
Không có findings → COMPLIANT
```
