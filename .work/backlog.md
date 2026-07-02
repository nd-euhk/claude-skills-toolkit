---
title: "Backlog — PaymentApp"
status: draft
depends_on:
  - ../agent_docs/roadmap.md
referenced_by:
  - ../.work/board.md
---

# Backlog — PaymentApp

## Features: Must (Critical Path)

### FEAT-001: User Login
- **Source**: Phase 1, Task 1.1 — from roadmap.md
- **Description**: Người dùng đăng nhập bằng email/password.
- **Priority**: Must
- **Target Sprint**: Sprint 1
- **Services**: auth-service
- **Status**: 🔲 Todo

### FEAT-002: User Registration
- **Source**: Phase 1, Task 1.1 — from roadmap.md
- **Description**: Người dùng đăng ký tài khoản mới.
- **Priority**: Must
- **Target Sprint**: Sprint 1
- **Services**: auth-service
- **Status**: 🔲 Todo

### FEAT-003: Password Reset
- **Source**: Phase 1, Task 1.1 — from roadmap.md
- **Description**: Người dùng đặt lại mật khẩu qua email.
- **Priority**: Must
- **Target Sprint**: Sprint 1
- **Services**: auth-service
- **Status**: 🔲 Todo

---

## Infrastructure: agent_docs/ Missing Files

> So sánh với `.structure.md` gốc tại `/home/khuend/projects/AI/Kit/sdlc-plugins/.structure.md` ngày 2026-07-02.
> Các file này có trong cấu trúc chuẩn nhưng chưa có subagent nào chịu trách nhiệm tạo ra.

### INFRA-001: project-overview.md + user-context.md
- **Source**: `.structure.md` Phase 1 + Phase 3
- **Description**: `agent_docs/project-overview.md` (condensed từ BRD) và `agent_docs/user-context.md` (condensed user context). Hiện không agent nào tạo ra — sdlc-srs đọc chúng như optional input nhưng không tự sinh.
- **Priority**: Should
- **Target Sprint**: Backlog
- **Proposal**: sdlc-srs tạo `project-overview.md` từ BRD input; tạo `user-context.md` từ URD input sau Phase 3.

### INFRA-002: conventions.md (3 files)
- **Source**: `.structure.md` Phase 8, 10
- **Description**: `agent_docs/conventions.md` (coding conventions tổng), `agent_docs/backend/conventions.md`, `agent_docs/frontend/conventions.md`. Không agent nào tạo.
- **Priority**: Should
- **Target Sprint**: Backlog
- **Proposal**: Tạo subagent `sdlc-conventions` hoặc để orchestrator tự sinh từ templates sau LLD phase.

### INFRA-003: intake/{slug}-decision.md
- **Source**: `.structure.md` Phase 0
- **Description**: Go/Hold/Kill decision log cho mỗi idea intake. Không agent nào tạo.
- **Priority**: Could
- **Target Sprint**: Backlog
- **Proposal**: Orchestrator tạo file này như một phần của preflight khi phát hiện project mới.

### INFRA-004: backend/{svc}/README.md + tech-design/README.md + performance/README.md
- **Source**: `.structure.md` Phase 7, 8, 9
- **Description**: Service-specific index, naming convention + methodology cho tech-design, và performance test strategy. Không agent nào tạo.
- **Priority**: Could
- **Target Sprint**: Backlog
- **Proposal**: sdlc-lld tạo `tech-design/README.md`, sdlc-imp tạo `backend/{svc}/README.md`, sdlc-tst tạo `performance/README.md`.

### INFRA-005: operations/ (toàn bộ thư mục)
- **Source**: `.structure.md` Phase 15
- **Description**: `agent_docs/operations/monitoring-spec.md`, `incident-response.md`, `sla-targets.md`, `runbooks/{service}-runbook.md`. Không agent nào tạo.
- **Priority**: Could
- **Target Sprint**: Backlog
- **Proposal**: Tạo subagent `sdlc-ops` hoặc để flow cook sinh runbooks sau khi deploy.

### INFRA-006: _template/ (toàn bộ thư mục)
- **Source**: `.structure.md`
- **Description**: Template files cho agent tham khảo. Phần lớn đã có trong `.claude/templates/` nhưng `.structure.md` đặt chúng trong `agent_docs/_template/`.
- **Priority**: Won't (hiện tại)
- **Target Sprint**: Backlog
- **Proposal**: Quyết định xem có cần duplicate từ `.claude/templates/` sang `agent_docs/_template/` không. Nếu không, cập nhật `.structure.md` để trỏ thẳng đến `.claude/templates/`.
