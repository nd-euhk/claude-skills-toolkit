---
title: "Events -- sanitizer-service"
status: current
created: 2026-06-01
last_updated: 2026-06-01
updated_by: Architecture Agent
depends_on:
  - ../architecture.md
referenced_by:
  - api-conventions.md
changelog:
  - 1.0 | 2026-06-01 | Events definition -- no events in this project
---

# Service-to-Service Events -- sanitizer-service

> **Purpose**: Define all async communication between services.
> **Status**: This project has NO events. The email validation utility is a synchronous, in-process function call with no event publishing or consumption.

## 1. Event Flow Overview

```
NONE -- No events are produced or consumed by the sanitizer-service.
```

The Email Validation Utility operates synchronously and statelessly (Constraints C-001, C-002, C-003). It does not emit domain events, integration events, or notification events. It does not subscribe to any events.

If future requirements introduce async validation flows (e.g., deferred deliverability checks), events would be introduced at that point with an ADR amendment.

## 2. Event Registry

**Empty.** No events defined for this project.

## 3. Rationale for No Events

1. **Synchronous constraint (C-001)**: The utility must return an immediate result. Events are inherently asynchronous and would violate this constraint.
2. **Stateless constraint (C-002)**: Each invocation is independent. Events imply some form of retained knowledge about what happened.
3. **No I/O constraint (C-003)**: Publishing or consuming events requires I/O (message broker, event bus), which is prohibited.
4. **Scope**: The utility performs a pure computation (format check) and returns a boolean. There is no meaningful domain event to publish -- the caller already knows the result.

## 4. Future Event Scenarios (Placeholder)

If the scope expands to include deliverability verification or async validation pipelines, the following event taxonomy would apply:

| Scenario | Event Type | Producer | Consumer |
|----------|-----------|----------|----------|
| Deferred deliverability check | `validation.email.deliverability_checked` | Email Validation Service | User Service (to update user status) |
| Bulk email validation request | `validation.email.batch_requested` | User Service | Validation Worker |

These are not currently in scope and would require an ADR amendment to introduce.
