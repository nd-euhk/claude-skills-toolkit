# Reverse Sync Procedure

How status changes propagate upward through the hierarchy:
Board (tasks) → Backlog (items) → Roadmap (features) → Roadmap (phases).

---

## Hierarchy

```
Roadmap Phase
  └── Feature (FR-{DOMAIN}-{NNN})
        └── Backlog Item (BL-{DOMAIN}-{NNN})
              └── Board Task (TSK-{DOMAIN}-{NNN})
```

---

## Level 1: Board Tasks → Backlog Items

**Rule**: When ALL board tasks under a backlog item are `✅ Done`, update the backlog item status to `✅ Done`.

### Example: BL-AUTH-001 (Design login API contract)

Board tasks under BL-AUTH-001:
- TSK-AUTH-001: Define POST /auth/login request/response JSON schema
- TSK-AUTH-002: Document authentication error codes and HTTP status mapping
- TSK-AUTH-003: Create OpenAPI spec for auth endpoints

**Before sync (some tasks done, some not):**
| Board Task | Status | → | Backlog Item | Status |
|------------|--------|---|--------------|--------|
| TSK-AUTH-001 | ✅ Done | | BL-AUTH-001 | 🟡 In Progress |
| TSK-AUTH-002 | ✅ Done | | | |
| TSK-AUTH-003 | 🟡 In Progress | | | |

**After sync (all tasks done):**
| Board Task | Status | → | Backlog Item | Status |
|------------|--------|---|--------------|--------|
| TSK-AUTH-001 | ✅ Done | | BL-AUTH-001 | ✅ Done |
| TSK-AUTH-002 | ✅ Done | | | |
| TSK-AUTH-003 | ✅ Done | | | |

### Sync Logic (pseudocode)

```
for each backlog_item in backlog:
    child_tasks = board.tasks.where(parent == backlog_item.id)
    if all(child_tasks.status == "Done"):
        backlog_item.status = "Done"
    elif any(child_tasks.status == "In Progress"):
        backlog_item.status = "In Progress"
    elif any(child_tasks.status == "Blocked"):
        backlog_item.status = "Blocked"
    else:
        backlog_item.status = "Todo"  # unchanged
```

---

## Level 2: Backlog Items → Roadmap Features

**Rule**: When ALL backlog items under a roadmap feature are `✅ Done`, update the feature status to `✅ Done` in the roadmap.

### Example: FR-AUTH-001 (User Login)

Backlog items under FR-AUTH-001:
- BL-AUTH-001: Design login API contract
- BL-AUTH-002: Implement POST /auth/login endpoint
- BL-AUTH-003: Implement JWT token issuance and validation
- BL-AUTH-004: Build login page UI component
- BL-AUTH-005: Write tests for login flow

**Before sync (some items done):**
| Backlog Item | Status | → | Feature | Status |
|--------------|--------|---|---------|--------|
| BL-AUTH-001 | ✅ Done | | FR-AUTH-001 | 🟡 In Progress |
| BL-AUTH-002 | ✅ Done | | | |
| BL-AUTH-003 | ✅ Done | | | |
| BL-AUTH-004 | 🟡 In Progress | | | |
| BL-AUTH-005 | 🔲 Todo | | | |

**After sync (all items done):**
| Backlog Item | Status | → | Feature | Status |
|--------------|--------|---|---------|--------|
| BL-AUTH-001 | ✅ Done | | FR-AUTH-001 | ✅ Done |
| BL-AUTH-002 | ✅ Done | | | |
| BL-AUTH-003 | ✅ Done | | | |
| BL-AUTH-004 | ✅ Done | | | |
| BL-AUTH-005 | ✅ Done | | | |

### Sync Logic (pseudocode)

```
for each feature in roadmap:
    child_items = backlog.items.where(parent == feature.id)
    if all(child_items.status == "Done"):
        feature.status = "Done"
    elif any(child_items.status in ("In Progress", "Blocked")):
        feature.status = "In Progress"  # or Blocked if any blocked
    else:
        feature.status = "Todo"  # unchanged
```

---

## Level 3: Roadmap Features → Phase

**Rule**: When ALL features in a phase are `✅ Done`, update the phase status to `✅ Complete`.

### Example: Phase 1 (Core Foundation)

Features in Phase 1:
- FR-AUTH-001: User Login
- FR-AUTH-002: Password Reset
- FR-DASH-001: Dashboard UI

**Before sync (some features done):**
| Feature | Status | → | Phase | Status |
|---------|--------|---|-------|--------|
| FR-AUTH-001 | ✅ Done | | Phase 1 | 🚧 In Progress |
| FR-AUTH-002 | ✅ Done | | | |
| FR-DASH-001 | 🟡 In Progress | | | |

**After sync (all features done):**
| Feature | Status | → | Phase | Status |
|---------|--------|---|-------|--------|
| FR-AUTH-001 | ✅ Done | | Phase 1 | ✅ Complete |
| FR-AUTH-002 | ✅ Done | | | |
| FR-DASH-001 | ✅ Done | | | |

### Sync Logic (pseudocode)

```
for each phase in roadmap:
    child_features = roadmap.features.where(parent == phase)
    if all(child_features.status == "Done"):
        phase.status = "Complete"
    elif any(child_features.status in ("In Progress", "Blocked")):
        phase.status = "In Progress"
    else:
        phase.status = "Todo"  # unchanged
```

---

## Full Reverse Sync Walkthrough

### Scenario: Sprint 1 Completes FR-AUTH-001 and FR-DASH-001

**Step 1: All board tasks for BL-AUTH-001 through BL-AUTH-005 marked Done**

Board tasks TSK-AUTH-001 through TSK-AUTH-018 all become `✅ Done`.

**Step 2: Sync board → backlog**

- BL-AUTH-001 → Done (all 3 child tasks done)
- BL-AUTH-002 → Done (all 4 child tasks done)
- BL-AUTH-003 → Done (all 4 child tasks done)
- BL-AUTH-004 → Done (all 4 child tasks done)
- BL-AUTH-005 → Done (all 3 child tasks done)
- BL-DASH-001 → Done (all 3 child tasks done)
- BL-DASH-002 → Done (all 3 child tasks done)
- BL-DASH-003 → Done (all 3 child tasks done)
- BL-DASH-004 → Done (all 4 child tasks done)
- BL-DASH-005 → Done (all 3 child tasks done)

**Step 3: Sync backlog → roadmap**

- FR-AUTH-001 → Done (all 5 backlog items done)
- FR-DASH-001 → Done (all 5 backlog items done)
- FR-AUTH-002 → Todo (no work started, all items still Todo)

**Step 4: Sync roadmap features → phase**

Phase 1 has 3 features: FR-AUTH-001 (Done), FR-AUTH-002 (Todo), FR-DASH-001 (Done).
Not all are Done, so Phase 1 stays `🚧 In Progress`.

---

## Edge Cases

### Blocked tasks

If a board task is `⚠️ Blocked`, its parent backlog item inherits `⚠️ Blocked` status.
Blocked status propagates upward: a blocked board task blocks the backlog item, which blocks the feature.

### Mixed status within a backlog item

If a backlog item has children in multiple states, use the most severe:
- Any `⚠️ Blocked` → backlog item is `⚠️ Blocked`
- Any `🟡 In Progress` (and no blocked) → backlog item is `🟡 In Progress`
- All `🔲 Todo` → backlog item stays `🔲 Todo`
- All `✅ Done` → backlog item is `✅ Done`

### Partial sync

Reverse sync can run at any time. It is idempotent -- running it twice produces the same result.
Best practice: run reverse sync after each sprint review, or on-demand when checking project health.

### Cross-sprint backlog items

Some backlog items may span multiple sprints. The status is determined by board task completion, not sprint boundaries. A backlog item only becomes Done when all its board tasks (across any sprint) are Done.

---

## ID Traceability Chain (Concrete Example)

```
Phase 1 (Core Foundation)
  └── FR-AUTH-001 (User Login)          → roadmap.md row 1
        ├── BL-AUTH-001 (API contract)  → backlog.md row 1
        │     ├── TSK-AUTH-001          → board.md, BL-AUTH-001 section
        │     ├── TSK-AUTH-002          → board.md, BL-AUTH-001 section
        │     └── TSK-AUTH-003          → board.md, BL-AUTH-001 section
        ├── BL-AUTH-002 (login endpoint) → backlog.md row 2
        │     ├── TSK-AUTH-004
        │     ├── TSK-AUTH-005
        │     ├── TSK-AUTH-006
        │     └── TSK-AUTH-007
        ├── BL-AUTH-003 (JWT tokens)    → backlog.md row 3
        │     ├── TSK-AUTH-008
        │     ├── TSK-AUTH-009
        │     ├── TSK-AUTH-010
        │     └── TSK-AUTH-011
        ├── BL-AUTH-004 (login UI)      → backlog.md row 4
        │     ├── TSK-AUTH-012
        │     ├── TSK-AUTH-013
        │     ├── TSK-AUTH-014
        │     └── TSK-AUTH-015
        └── BL-AUTH-005 (login tests)   → backlog.md row 5
              ├── TSK-AUTH-016
              ├── TSK-AUTH-017
              └── TSK-AUTH-018
```
