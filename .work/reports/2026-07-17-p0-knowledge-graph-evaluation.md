# P0 — Knowledge Graph: Đánh giá Chi Tiết

**Ngày:** 2026-07-17
**Tác giả:** Claude Fable 5 + khuend
**Phạm vi:** Đánh giá gap P0 (Knowledge Graph) từ deep research — thiết kế, phạm vi, và lộ trình triển khai

---

## TL;DR

Knowledge Graph là **gap được nhắc đến nhiều nhất** trong tất cả research sources (sdlc-harness, OpenSearch Atlas, TestCollab, Red Hat). Đây không phải là "nice to have" — nó là **scale blocker**: khi số lượng specs >10 features, file-based memory không còn hoạt động hiệu quả.

**Đánh giá hiện tại:**
- File-based memory đang hoạt động tốt ở scale demo (3 features)
- Templates đã có sẵn `depends_on`/`referenced_by` frontmatter → dữ liệu bán cấu trúc
- Thiếu khả năng query cross-reference (FR nào bị ảnh hưởng nếu service X thay đổi?)
- Thiếu tự động cập nhật khi specs thay đổi

**Đề xuất:** SQLite-backed KG với 3 phase: Core Schema → Auto-Population → Query API. Tổng effort: ~2 tuần.

---

## 1. Current State: Phân tích Data Model Hiện Tại

### 1.0. Phạm vi Khảo sát

Đã khảo sát **2 repo + 1 reference spec**:

| Source | Vai trò | Mức độ dữ liệu |
|--------|---------|---------------|
| `toolkit/` (repo hiện tại) | Plugin consumer với PaymentApp demo | Tối thiểu — chỉ `roadmap.md` + `board.md` |
| `claude-skills-toolkit/` (repo plugin) | Plugin chính — nơi định nghĩa templates, skills, agents | Templates + sample agent_docs + eval outputs |
| `sdlc-plugins/.structure.md` | Canonical structure spec | Đặc tả đầy đủ cấu trúc thư mục và files |

Ngoài ra còn có eval outputs hoàn chỉnh tại `evals/orchestrate/workspace/.../outputs/agent_docs/` cho thấy cấu trúc INTENDED khi pipeline chạy end-to-end với đầy đủ FR, IMP, TST, contracts, traceability matrix.

### 1.1. Entity Types (Nodes) — Đã tồn tại trong Templates

Phân tích từ 30 templates (~4,552 dòng) trong `.claude/templates/` + eval outputs + sample agent_docs:

| # | Entity | ID Format | Template Source | Thuộc tính chính |
|---|--------|-----------|-----------------|------------------|
| 1 | **FR** | `FR-{DOMAIN}-{NNN}` | `srs/FR-TEMPLATE.md` | layer (BE/FE/BE+FE), backend_service, frontend_pages, depends_on, referenced_by, scope, api_endpoints, cross_service_deps |
| 2 | **Feature** | `FEAT-{NNN}` | `sprint/backlog-TEMPLATE.md` | priority (Must/Should/Could), target_sprint, services, status |
| 3 | **ADR** | `ADR-{NNN}` | `hld/ADR-TEMPLATE.md` | status (proposed→superseded), depends_on, consequences, related NFRs |
| 4 | **NFR** | `NFR-{CATEGORY}-{NNN}` | `srs/requirements-matrix-TEMPLATE.md` | category (PERF/SEC/AVAIL/REL), constraint, verified_where, owner |
| 5 | **Service** | `{name}-service` | `lld/lld-TEMPLATE.md` + `domain-service-mapping.yaml` | port, base_package, tables_owned, calls_to, called_by, domain, owns (data keys) |
| 6 | **API Endpoint** | method+path | `contracts/api-TEMPLATE.yaml` (OpenAPI 3.1) | method, path, contract_ref, direction (expose/consume), auth, target_service |
| 7 | **BRD Objective** | `OBJ-{N}` | `srs/requirements-matrix-TEMPLATE.md` | title |
| 8 | **PRD Feature** | `F-{AREA}-{NN}` | `srs/requirements-matrix-TEMPLATE.md` | title |
| 9 | **Test Spec** | file path | `tst/test-spec-backend-TEMPLATE.md` | depends_on FR+contract, 8-section behavior matrix, test layer ownership |
| 10 | **Impl Spec** | file path | `impl/impl-spec-backend-TEMPLATE.md` | depends_on FR+contract+tech-design, 10-section structure, scope, error mapping |
| 11 | **Migration** | `V{NNN}__{desc}.sql` | `impl/migration-spec-TEMPLATE.md` | service, table |
| 12 | **Error Code** | `{DOMAIN}_{DESCRIPTION}` | `contracts/error-codes-TEMPLATE.md` | http_status, condition, message |
| 13 | **Frontend Page** | route path | (trong FR template) | page, app, component, interaction_file |
| 14 | **Sprint** | Sprint N | `sprint/board-TEMPLATE.md` | goal, period, status |
| 15 | **Phase** | Phase N | `sprint/roadmap-TEMPLATE.md` | sprint, period, services, features |
| 16 | **Git PR** | PR URL | `srs/requirements-matrix-TEMPLATE.md` | branch, merge_commit, owner, merged_at, changed_paths |
| 17 | **Database Table** | table_name | (trong LLD template) | owner_service, columns |
| 18 | **Event** | event type | `contracts/events-TEMPLATE.md` | producer, consumers, schema, envelope format |
| 19 | **Domain** | domain name | `domain-service-mapping.yaml` | name, services, data ownership |
| 20 | **Agent** | agent name | `.claude/agents/*.md` | model, maxTurn, allowed-tools, description |

**Tổng: 20 entity types** đã có cấu trúc rõ ràng trong templates và sample data.

### 1.2. Relationship Types (Edges) — Đã tồn tại trong Frontmatter

Từ phân tích `depends_on`/`referenced_by` trong tất cả templates:

| # | Edge | From | To | Cardinality | Source |
|---|------|------|----|-------------|--------|
| 1 | **IMPLEMENTS** | Impl Spec | FR | N:1 | impl frontmatter `depends_on` |
| 2 | **TESTS** | Test Spec | FR | N:1 | test frontmatter `depends_on` |
| 3 | **TRACES_TO_BRD** | FR | BRD Objective | N:M | requirements-matrix |
| 4 | **TRACES_TO_PRD** | FR | PRD Feature | N:M | requirements-matrix |
| 5 | **BELONGS_TO_SERVICE** | FR | Service | N:1 | FR `backend_service` field |
| 6 | **RENDERED_IN** | FR | Frontend Page | N:M | FR `frontend_pages` field |
| 7 | **EXPOSES** | Service | API Endpoint | 1:N | FR `api_endpoints` (direction=expose) |
| 8 | **CONSUMES** | Service | API Endpoint | N:M | FR `api_endpoints` (direction=consume) |
| 9 | **OWNS_TABLE** | Service | Database Table | 1:N | LLD §1 & §3 |
| 10 | **HAS_MIGRATION** | Service | Migration | 1:N | LLD → migration-spec |
| 11 | **HAS_ADR** | Service | ADR | 1:N | HLD → ADR |
| 12 | **RELATES_TO_NFR** | ADR | NFR | N:M | ADR `Related` section |
| 13 | **HAS_ERROR_CODE** | FR | Error Code | 1:N | FR `Errors` table |
| 14 | **CONTAINS_FEATURE** | Phase | Feature | 1:N | roadmap |
| 15 | **CONTAINS_FEATURE** | Sprint | Feature | 1:N | board |
| 16 | **RESOLVES** | Git PR | FR | N:1 | requirements-matrix Git Artifacts |
| 17 | **DEPENDS_ON_FR** | FR | FR | N:M | feature-index dependency graph |
| 18 | **CALLS** | Service | Service | N:M | LLD §1 `Calls →` |
| 19 | **PRODUCES_EVENT** | Service | Event | 1:N | events template |
| 20 | **CONSUMES_EVENT** | Service | Event | N:M | events template |
| 21 | **HAS_SCOPE** | FR | Scope Paths | 1:N | FR `scope.allowed_paths` |

| 18 | **CALLS** | Service | Service | N:M | LLD §1 `Calls →` |
| 19 | **PRODUCES_EVENT** | Service | Event | 1:N | events template |
| 20 | **CONSUMES_EVENT** | Service | Event | N:M | events template |
| 21 | **HAS_SCOPE** | FR | Scope Paths | 1:N | FR `scope.allowed_paths` |
| 22 | **OWNS_DOMAIN** | Domain | Service | 1:N | `domain-service-mapping.yaml` |
| 23 | **CROSS_SERVICE_DEP** | FR | Service | N:M | FR `cross_service_deps` (với failure_mode) |
| 24 | **EXECUTED_BY** | FR | Agent | N:M | Agent routing table |
| 25 | **VERIFIED_BY** | NFR | ADR | N:M | ADR `Related` section |

**Tổng: 25 relationship types** đã được mô hình hóa (mặc dù thủ công, trong Markdown/YAML frontmatter).

### 1.3. Structured Data Files Hiện Có

Ngoài Markdown templates, có các file structured data đáng chú ý:

| File | Format | Nội dung |
|------|--------|----------|
| `agent_docs/domain-service-mapping.yaml` | YAML | Service list với domain, owns (data keys), ports |
| `agent_docs/contracts/api-{domain}.yaml` | OpenAPI 3.1.0 | Full API contract: paths, schemas, security, error responses |
| `.claude-plugin/plugin.json` | JSON | Plugin manifest (name, version, skills/agents/hooks directories) |
| `.claude/settings.json` | JSON | Runtime settings + permissions |
| `.claude/hooks.json` | JSON | Hook event matchers + handler configuration |

**Quan trọng:** `domain-service-mapping.yaml` và OpenAPI contracts đã là structured data — có thể parse trực tiếp vào KG mà không cần thay đổi format.

### 1.4. Cơ chế Tracking Hiện Tại

```
┌─────────────────────────────────────────────────────────┐
│               CURRENT: File-based Memory                 │
├─────────────────────────────────────────────────────────┤
│  agent_docs/                                             │
│  ├── features/FR-AUTH-001--login.md                      │
│  │   frontmatter: depends_on: [contracts/api-auth.yaml]  │
│  │   frontmatter: referenced_by: [impl/..., test/...]    │
│  ├── contracts/api-auth.yaml                             │
│  ├── tech-design/auth-service.md                         │
│  ├── traceability/requirements-matrix.md                 │
│  │   (manual table: FR → PRD → BRD → impl → test)       │
│  └── features/README.md (feature index)                  │
│                                                          │
│  .work/                                                  │
│  ├── board.md (sprint tracking)                          │
│  └── backlog.md (feature prioritization)                 │
│                                                          │
│  QUERY CAPABILITY: grep + Read file                      │
│  "FR nào bị ảnh hưởng nếu auth-service thay đổi?"       │
│    → grep "auth-service" agent_docs/features/*.md        │
│    → Thủ công, chậm, không đảm bảo toàn vẹn             │
└─────────────────────────────────────────────────────────┘
```

**Điểm mạnh của file-based:**
- Đơn giản, không dependency mới
- Human-readable (có thể mở bằng bất kỳ editor nào)
- Hoạt động tốt với Git (diff, merge)

**Điểm yếu của file-based:**
- Query cross-reference phải grep thủ công
- Không đảm bảo referential integrity (link đến file không tồn tại)
- Không có transitive closure ("FR nào gián tiếp bị ảnh hưởng?")
- Scale kém khi >10 features × >5 services

---

## 2. Gap Analysis: Điều gì KHÔNG làm được nếu thiếu KG?

### 2.1. Impact Analysis (quan trọng nhất)

**Câu hỏi:** "Nếu auth-service thay đổi API login, những FR nào bị ảnh hưởng?"

**File-based:** `grep "auth-service" agent_docs/features/*.md` → danh sách FR trực tiếp. Nhưng không phát hiện:
- FR frontend gọi API login (consume relationship)
- FR khác dùng chung error code với auth-service
- FR phụ thuộc gián tiếp (FR-B dùng service gọi auth-service)

**KG:** Single Cypher/SQL query → danh sách đầy đủ bao gồm transitive dependencies.

### 2.2. Coverage Analysis

**Câu hỏi:** "Những BRD objective nào chưa có FR implement?"

**File-based:** So sánh thủ công requirements-matrix.md với BRD.md.

**KG:** `SELECT objective FROM BRD WHERE objective NOT IN (SELECT brd_ref FROM FR)`

### 2.3. Gate Readiness Check

**Câu hỏi:** "Những FR nào đã có đủ impl spec + test spec + git PR merged?"

**File-based:** Đọc từng file FR, check `referenced_by`, cross-reference với board.md.

**KG:** Single query — tất cả FR với outgoing `IMPLEMENTS` + `TESTS` + `RESOLVES` edges.

### 2.4. Change Request Risk Assessment

**Câu hỏi:** "CR này thay đổi FR-AUTH-001. Risk level thế nào?"

**File-based:** Đọc FR-AUTH-001, tìm `referenced_by`, đọc từng file liên quan.

**KG:**
```
Risk = (
  count(services affected) +
  count(frontend pages affected) +
  count(FRs depend on this FR) +
  count(APIs changed)
)
→ Risk score → route: quick (< 2) / cook (2-5) / task (5+)
```

### 2.5. Agent Context Assembly

**Câu hỏi:** "Khi spawn sdlc-lld cho auth-service, context nào cần load?"

**File-based:** Orchestrator thủ công chọn files.

**KG:** `SELECT * FROM context_assembly WHERE service = 'auth-service' FOR PHASE 'LLD'`
→ Trả về: FRs liên quan, ADRs, API contracts, NFRs, conventions — tự động, đầy đủ, đúng scope.

---

## 3. Reference Implementations (từ Deep Research + Web Research)

### 3.1. sdlc-harness (madhavmadupu) — Reference chính

Đây là implementation **gần nhất với nhu cầu của SDLC Toolkit**. Source code tại `src/graph/schema.ts` + `src/graph/store.ts`.

**Schema (4 tables):**

```sql
-- Bảng 1: Nodes
CREATE TABLE nodes (
  node_type TEXT NOT NULL,    -- Feature, Module, Task, Decision, File, Agent, Artifact
  node_id TEXT NOT NULL,      -- ID duy nhất trong type
  data TEXT NOT NULL,         -- JSON payload (toàn bộ thuộc tính của node)
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (node_type, node_id)
);

-- Bảng 2: Edges
CREATE TABLE edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,    -- 11 edge types
  metadata TEXT,              -- JSON optional
  created_at TEXT,
  UNIQUE(source_type, source_id, target_type, target_id, edge_type)
);
CREATE INDEX idx_edges_source ON edges(source_type, source_id);
CREATE INDEX idx_edges_target ON edges(target_type, target_id);
CREATE INDEX idx_edges_source_type ON edges(source_type, source_id, edge_type);

-- Bảng 3: Reasoning (thinking traces)
CREATE TABLE reasoning (
  id TEXT PRIMARY KEY,        -- format: "{nodeType}:{nodeId}:{timestamp}"
  node_type TEXT, node_id TEXT,
  content TEXT,               -- thinking trace text
  source TEXT,                -- thinking | summary | decision
  session_id TEXT,
  embedding BLOB,             -- Float32Array (optional)
  created_at TEXT
);

-- Bảng 4: Agent Status
CREATE TABLE agent_status (
  agent_id TEXT PRIMARY KEY,
  role TEXT, status TEXT,
  phase TEXT, task_id TEXT,
  progress REAL, heartbeat TEXT
);
```

**7 Node Types:**
| Type | Payload |
|------|---------|
| `Feature` | title, description, priority, status |
| `Module` | name, path, description, language |
| `Task` | title, description, status, assignedAgent?, phase |
| `Decision` | title, rationale, options[], chosen, status |
| `File` | path, content?, hash, language |
| `Agent` | name, role, capabilities[], status |
| `Artifact` | type (diff/test/result/review), content, taskId, status |

**11 Edge Types:**
```
feature_has_task       — Feature → Task (decomposition)
feature_uses_module    — Feature → Module
module_contains_file   — Module → File
module_depends_on      — Module → Module (dependency)
task_produces_artifact — Task → Artifact
task_assigned_to       — Task → Agent
task_blocked_by        — Task → Task
task_precedes          — Task → Task (ordering)
decision_justifies     — Decision → (anything)
artifact_modifies_file — Artifact → File
agent_works_on         — Agent → Task (activity tracking)
```

**5-Phase Population Cycle:**
1. **Decompose** — User submits feature → orchestrator breaks into tasks → writes Feature/Module/Task nodes
2. **Assign** — Agent roles gán vào tasks → `task_assigned_to` edges
3. **Execute** — Tasks chạy qua provider seam → real-time events (thinking traces, file changes)
4. **Gate** — Quality checks giữa phases → fail → fork + retry
5. **Record** — Persist artifacts, decisions, reasoning traces

**Recursive Impact Analysis Query:**
```sql
WITH RECURSIVE affected(module_id) AS (
  SELECT ? AS module_id
  UNION
  SELECT e.source_id FROM edges e
  JOIN affected a ON e.target_id = a.module_id
  WHERE e.edge_type = 'module_depends_on'
)
SELECT DISTINCT n.node_id FROM nodes n
JOIN edges fe ON fe.source_type = 'feature'
              AND fe.source_id = n.node_id
              AND fe.edge_type = 'feature_uses_module'
JOIN affected a ON fe.target_id = a.module_id
WHERE n.node_type = 'feature';
```

**Bài học cho SDLC Toolkit:**
- `node_type + node_id` composite key pattern → flexible, không cần UUID
- `data TEXT` (JSON) cho properties → schema-lite, dễ mở rộng
- `INSERT OR IGNORE` cho edges → idempotent, an toàn khi re-populate
- Recursive CTE cho transitive closure → mạnh, chuẩn SQL
- Provider seam pattern → KG populated qua orchestrator, không phải hook

### 3.2. 5 Patterns Auto-Update Từ Hệ Sinh Thái

Deep research đã xác nhận **5 patterns** cho auto-updating knowledge base:

| Pattern | Cơ chế | Thời gian | Dùng cho |
|---------|--------|-----------|----------|
| **Git Hook** | post-commit, post-merge | <500ms sau commit | GitCortex, code-review-graph |
| **Claude Code Hook** | Stop, SessionStart | Cuối mỗi turn (~0.4s) | code-review-graph, Cairn MCP, kgraph |
| **File Watcher** | inotify / chokidar | Real-time (debounced 2s) | indxr, lxDIG MCP, Lucerna |
| **CI/CD Pipeline** | `if: always()` capture | Mỗi build | Time-Travel RAG, CocoIndex |
| **Content-Hash Incremental** | SHA-256 comparison | Chỉ re-index changed | agent-memory-mcp, code-review-graph |

**Pattern phù hợp nhất cho SDLC Toolkit:** **Claude Code Hook + Content-Hash Incremental**
- Stop hook: chạy `kg-populator.py` sau mỗi turn, parse changed files, upsert
- SHA-256 file hash → skip files không thay đổi
- <500ms cho incremental update (đã verified bởi code-review-graph trên 2,900-file project)

### 3.3. Industry Convergence — Two-Layer Architecture

Tất cả hệ thống được khảo sát đang hội tụ về kiến trúc **2 tầng**:

```
┌──────────────────────────────────────────────────┐
│ LAYER 1: Code-Level Graph (AST-extracted)        │
│ • Nodes: File, Class, Function, Interface        │
│ • Edges: CONTAINS, CALLS, INHERITS, IMPORTS      │
│ • Auto-update: git hooks + content hashing       │
│ • Dùng cho: code review, bug localization        │
├──────────────────────────────────────────────────┤
│ LAYER 2: SDLC-Level Graph (orchestrator-driven)  │
│ • Nodes: FR, Feature, ADR, Task, Sprint, Agent   │
│ • Edges: IMPLEMENTS, TESTS, TRACES_TO, BLOCKS    │
│ • Populate: orchestrator phases + agent output   │
│ • Dùng cho: traceability, impact analysis        │
├──────────────────────────────────────────────────┤
│ BRIDGE: File nodes (có trong cả 2 tầng)          │
│ • artifact_modifies_file (Layer 2 → Layer 1)     │
│ • module_contains_file (Layer 1 → Layer 1)       │
│ • feature_uses_module (Layer 2 → Layer 1)        │
└──────────────────────────────────────────────────┘
```

**SDLC Toolkit mapping:** Layer 2 (SDLC-level) đã có đầy đủ entity types. Layer 1 (code-level) có thể thêm sau qua AST parsing. Bridge point: FR → Impl Spec → File path → Code entities.

### 3.4. 10 Query Patterns Chuẩn (Cross-System)

| # | Pattern | SQL/Graph Query | SDLC Toolkit priority |
|---|---------|-----------------|----------------------|
| 1 | **Impact Analysis** | Recursive CTE trên dependency edges | P0 — CR flow |
| 2 | **Traceability** | Path traversal FR→PRD→BRD→NFR | P0 — Gate check |
| 3 | **Blast Radius** | BFS từ changed nodes | P0 — Risk assessment |
| 4 | **Coverage Analysis** | Anti-join: FR không có TEST edge | P1 — Sprint review |
| 5 | **Context Assembly** | Subgraph extraction cho agent type | P0 — Agent spawn |
| 6 | **Task Planning** | Topological sort trên task dependencies | P1 — Sprint planning |
| 7 | **Decision Rationale** | Traversal ADR→NFR→FR edges | P2 — Architecture review |
| 8 | **Semantic Search** | Vector similarity trên embeddings | P2 — Code exploration |
| 9 | **Cycle Detection** | Graph cycle algorithm | P1 — Architecture gate |
| 10 | **Change Over Time** | Temporal query với git history | P3 — Evolution tracking |

---

## 4. Thiết kế Đề xuất

### 4.1. Kiến trúc Tổng thể

```
┌──────────────────────────────────────────────────────────────┐
│                   KNOWLEDGE GRAPH LAYER                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │  Populator   │    │   SQLite KG  │    │   Query API     │  │
│  │  (hook vào   │───▶│   (nodes +   │───▶│   (CLI +        │  │
│  │   agent      │    │    edges)    │    │    subagent)    │  │
│  │   output)    │    │              │    │                 │  │
│  └─────────────┘    └──────────────┘    └─────────────────┘  │
│         │                  │                    │             │
│         ▼                  ▼                    ▼             │
│  Parse frontmatter   Store structured     Answer queries:    │
│  từ agent output     relationships        - Impact analysis  │
│  (depends_on,        với indexes          - Coverage check   │
│   referenced_by,     cho common           - Context assembly │
│   FR fields)         queries              - Risk assessment  │
│                                                               │
│  Tệp nguồn:                                                  │
│  agent_docs/**/*.md  .work/{board,backlog}.md                │
│  (vẫn là SSOT — KG là derived view, không phải replacement)  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 4.2. Schema Chi tiết (Alignment với sdlc-harness)

Thiết kế dựa trên sdlc-harness (madhavmadupu) — pattern đã proven: composite key, JSON payload, idempotent edges, recursive CTE.

```sql
-- ============================================================
-- NODES — Composite key: (node_type, node_id)
-- Pattern từ sdlc-harness: linh hoạt, không cần UUID
-- ============================================================

CREATE TABLE nodes (
  node_type   TEXT NOT NULL,                -- FR, ADR, SERVICE, API, NFR, FEATURE, ...
  node_id     TEXT NOT NULL,                -- FR-AUTH-001, ADR-001, auth-service, ...
  data        TEXT NOT NULL DEFAULT '{}',   -- JSON payload (type-specific properties)
  source_file TEXT,                         -- Path tới file nguồn (SSOT)
  file_hash   TEXT,                         -- SHA-256 của file nguồn
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (node_type, node_id)
);
CREATE INDEX idx_nodes_type ON nodes(node_type);

-- ============================================================
-- EDGES — Idempotent (INSERT OR IGNORE)
-- ============================================================

CREATE TABLE edges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id   TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  edge_type   TEXT NOT NULL,                -- IMPLEMENTS, TESTS, TRACES_TO, DEPENDS_ON, ...
  metadata    TEXT NOT NULL DEFAULT '{}',   -- JSON: direction, method, auth, failure_mode, ...
  source_file TEXT,                         -- File nơi khai báo edge
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id, target_type, target_id, edge_type),
  FOREIGN KEY (source_type, source_id) REFERENCES nodes(node_type, node_id) ON DELETE CASCADE,
  FOREIGN KEY (target_type, target_id) REFERENCES nodes(node_type, node_id) ON DELETE CASCADE
);
CREATE INDEX idx_edges_source ON edges(source_type, source_id);
CREATE INDEX idx_edges_target ON edges(target_type, target_id);
CREATE INDEX idx_edges_type ON edges(edge_type);
CREATE INDEX idx_edges_st ON edges(source_type, source_id, edge_type);

-- ============================================================
-- REASONING — Thinking traces (từ sdlc-harness)
-- Lưu agent reasoning để audit + context continuity
-- ============================================================

CREATE TABLE reasoning (
  id          TEXT PRIMARY KEY,             -- "{node_type}:{node_id}:{timestamp}"
  node_type   TEXT NOT NULL,
  node_id     TEXT NOT NULL,
  content     TEXT NOT NULL,                -- Thinking trace text
  source      TEXT NOT NULL DEFAULT 'summary', -- thinking | summary | decision
  session_id  TEXT,
  embedding   BLOB,                         -- Float32Array (optional, cho semantic search)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (node_type, node_id) REFERENCES nodes(node_type, node_id) ON DELETE CASCADE
);

-- ============================================================
-- AGENT_STATUS — Live tracking (từ sdlc-harness)
-- ============================================================

CREATE TABLE agent_status (
  agent_id    TEXT PRIMARY KEY,
  role        TEXT,
  status      TEXT,                         -- idle | running | blocked | done
  phase       TEXT,                         -- SRS | HLD | LLD | IMP | TST | RED | GREEN | GATE
  task_id     TEXT,
  progress    REAL DEFAULT 0.0,             -- 0.0 → 1.0
  heartbeat   TEXT,                         -- Last heartbeat timestamp
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- FILE_VERSIONS — Incremental update tracking
-- ============================================================

CREATE TABLE file_versions (
  file_path   TEXT PRIMARY KEY,
  file_hash   TEXT NOT NULL,                -- SHA-256
  parsed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 4.3. Node Types — Mapping SDLC Toolkit → KG

| node_type | node_id Format | data (JSON keys) | source_file pattern |
|-----------|---------------|-------------------|---------------------|
| `FR` | `FR-{DOMAIN}-{NNN}` | `{layer, priority, status, business_domain}` | `agent_docs/features/FR-*--*.md` |
| `FEATURE` | `FEAT-{NNN}` | `{priority, target_sprint, services[], status}` | `.work/backlog.md` (parsed từ table) |
| `ADR` | `ADR-{NNN}` | `{status: proposed→superseded, superseded_by}` | `agent_docs/adrs/ADR-*--*.md` |
| `NFR` | `NFR-{CATEGORY}-{NNN}` | `{category, constraint, threshold, verified_where, owner}` | `agent_docs/traceability/requirements-matrix.md` |
| `SERVICE` | `{name}-service` | `{port, base_package, language, framework, domain}` | `agent_docs/domain-service-mapping.yaml` |
| `API` | `{METHOD} {path}` | `{method, path, direction, auth, contract_file}` | `agent_docs/contracts/api-*.yaml` |
| `DOMAIN` | `{domain-name}` | `{name, description}` | `agent_docs/domain-service-mapping.yaml` |
| `IMPL_SPEC` | `FR-{DOMAIN}-{NNN}--{slug}-impl` | `{layer, scope_paths[]}` | `agent_docs/backend/*/implementation/FR-*-impl.md` |
| `TEST_SPEC` | `FR-{DOMAIN}-{NNN}--{slug}-test` | `{layer, test_types[]}` | `agent_docs/backend/*/test-specs/FR-*-test.md` |
| `ERROR_CODE` | `{DOMAIN}_{DESCRIPTION}` | `{http_status, condition, message}` | `agent_docs/contracts/error-codes.md` |
| `PAGE` | `{route-path}` | `{route, app, component, interaction_file}` | (trong FR template) |
| `MIGRATION` | `V{NNN}__{desc}` | `{service, table, description}` | `agent_docs/backend/*/migrations/V*.sql` |
| `SPRINT` | `Sprint-{N}` | `{goal, period_start, period_end, status}` | `.work/board.md` |
| `PHASE` | `Phase-{N}` | `{sprint, period, services[], features[]}` | `agent_docs/roadmap.md` |
| `GIT_PR` | `PR-{number}` | `{branch, merge_commit, owner, merged_at, changed_paths[]}` | `agent_docs/traceability/requirements-matrix.md` |
| `AGENT` | `{agent-name}` | `{model, maxTurn, allowed_tools[], description}` | `.claude/agents/*.md` |
| `EVENT` | `{event-type}` | `{producer, consumers[], schema}` | `agent_docs/contracts/events.md` |
| `TABLE` | `{table_name}` | `{owner_service, columns[]}` | (trong LLD template) |
| `BRD_OBJ` | `OBJ-{N}` | `{title}` | `agent_docs/traceability/requirements-matrix.md` |
| `PRD_FEAT` | `F-{AREA}-{NN}` | `{title}` | `agent_docs/traceability/requirements-matrix.md` |

### 4.4. Edge Types — Mapping SDLC Relationships

| edge_type | source (type) | target (type) | metadata (JSON) |
|-----------|--------------|---------------|-----------------|
| `IMPLEMENTS` | IMPL_SPEC | FR | `{}` |
| `TESTS` | TEST_SPEC | FR | `{}` |
| `TRACES_TO_BRD` | FR | BRD_OBJ | `{}` |
| `TRACES_TO_PRD` | FR | PRD_FEAT | `{}` |
| `BELONGS_TO_SVC` | FR | SERVICE | `{role: "backend"}` |
| `RENDERED_IN` | FR | PAGE | `{app, component}` |
| `EXPOSES_API` | SERVICE | API | `{direction: "expose"}` |
| `CONSUMES_API` | SERVICE | API | `{direction: "consume", target_service}` |
| `OWNS_TABLE` | SERVICE | TABLE | `{}` |
| `HAS_MIGRATION` | SERVICE | MIGRATION | `{}` |
| `HAS_ADR` | SERVICE | ADR | `{}` |
| `HAS_ERROR` | FR | ERROR_CODE | `{}` |
| `RELATES_TO_NFR` | ADR | NFR | `{}` |
| `CONTAINS_FEATURE` | PHASE | FEATURE | `{}` |
| `CONTAINS_FEATURE` | SPRINT | FEATURE | `{}` |
| `RESOLVES` | GIT_PR | FR | `{merged_at, owner}` |
| `DEPENDS_ON_FR` | FR | FR | `{reason}` |
| `CALLS_SVC` | SERVICE | SERVICE | `{protocol}` |
| `PRODUCES_EVENT` | SERVICE | EVENT | `{}` |
| `CONSUMES_EVENT` | SERVICE | EVENT | `{}` |
| `CROSS_SVC_DEP` | FR | SERVICE | `{reason, api, failure_mode}` |
| `OWNS_DOMAIN` | DOMAIN | SERVICE | `{}` |
| `EXECUTED_BY` | FR | AGENT | `{phase}` |
| `VERIFIED_BY` | NFR | ADR | `{}` |
| `HAS_SCOPE` | FR | (path) | `{allowed_paths[], forbidden_paths[]}` |

**Tổng: 25 edge types**, mỗi cái có metadata JSON riêng.

### 4.6. Auto-Update Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   AUTO-UPDATE PIPELINE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  AGENT OUTPUT                  HOOK (Stop)                   │
│  ┌──────────┐                 ┌───────────────┐             │
│  │ sdlc-srs │──writes──▶     │               │             │
│  │ sdlc-hld │──writes──▶     │ kg-populator  │             │
│  │ sdlc-lld │──writes──▶     │   --incremental│            │
│  │ sdlc-imp │──writes──▶     │               │             │
│  │ sdlc-tst │──writes──▶     │ 1. Scan files  │             │
│  └──────────┘                │ 2. Hash check  │             │
│                               │ 3. Parse new/  │             │
│  GIT (merge)                  │    changed     │             │
│  ┌──────────┐                 │ 4. Upsert KG   │             │
│  │ PR merge │──triggers──▶    │               │             │
│  └──────────┘                 └───────┬───────┘             │
│                                       │                      │
│  MANUAL                             ▼                      │
│  ┌──────────┐                 ┌───────────────┐             │
│  │ /sdlc-kg │──calls──▶      │   SQLite KG    │             │
│  │ --rebuild│                 │  .work/kg.db   │             │
│  └──────────┘                 └───────┬───────┘             │
│                                       │                      │
│  QUERY                              ▼                      │
│  ┌──────────┐                 ┌───────────────┐             │
│  │Orchestr. │──queries──▶    │   kg-query.py  │             │
│  │agents    │                 │  --impact      │             │
│  │CI/CD     │                 │  --coverage    │             │
│  │Human     │                 │  --context     │             │
│  └──────────┘                 └───────────────┘             │
│                                                              │
│  PERFORMANCE TARGETS:                                        │
│  • Incremental update: <500ms (tested: code-review-graph)   │
│  • Full rebuild: <2s cho 2,900 files (tested: code-review)  │
│  • Query response: <50ms cho hầu hết queries                │
└─────────────────────────────────────────────────────────────┘
```

### 4.7. Populator Strategy

**Trigger points** — khi nào KG được cập nhật:

| Trigger | Ai làm | Cập nhật gì | Input format |
|---------|--------|-------------|--------------|
| Agent tạo/sửa FR file | `sdlc-srs` | Parse FR frontmatter → upsert node + edges | Markdown frontmatter |
| Agent tạo/sửa ADR | `sdlc-hld` | Parse ADR frontmatter → upsert node + edges | Markdown frontmatter |
| Agent tạo/sửa LLD | `sdlc-lld` | Parse LLD frontmatter → upsert service node + edges | Markdown frontmatter |
| Agent tạo/sửa IMP spec | `sdlc-imp` | Parse IMP frontmatter → upsert node + IMPLEMENTS edge | Markdown frontmatter |
| Agent tạo/sửa TST spec | `sdlc-tst` | Parse TST frontmatter → upsert node + TESTS edge | Markdown frontmatter |
| Agent tạo API contract | `sdlc-lld` | Parse OpenAPI YAML → upsert API endpoints + edges | **OpenAPI 3.1 YAML** |
| Agent cập nhật service mapping | `sdlc-hld` | Parse YAML → upsert domain/service nodes + OWNS_DOMAIN edges | **domain-service-mapping.yaml** |
| Sprint update | `sdlc-sprint-board` | Parse board.md → upsert sprint/feature edges | Markdown table |
| PR merged | CI/CD hook | Parse git log → upsert RESOLVES edge | `git log --merges` |
| Manual rebuild | `Skill(sdlc-kg, "--rebuild")` | Full re-parse từ tất cả agent_docs/ + .work/ | Tất cả formats |

**Implementation:** Python script `scripts/kg-populator.py`:
- Parse YAML frontmatter từ tất cả `.md` files trong `agent_docs/` và `.work/`
- Parse **structured YAML files**: `domain-service-mapping.yaml`, OpenAPI contracts
- Parse **Markdown tables**: board.md (FR status), backlog.md (feature priority), requirements-matrix.md (traceability)
- Extract `id`, `type`, `depends_on`, `referenced_by`, type-specific fields
- Upsert vào SQLite với incremental update (so sánh `file_hash`)
- **Multi-repo aware**: đọc từ cả toolkit repo (consumer) và claude-skills-toolkit repo (plugin)

**Incremental update flow:**
```
1. Scan tất cả files → compute SHA256
2. So sánh với file_versions table
3. Files mới/thay đổi → parse + upsert
4. Files đã xóa → mark node/edge as stale (không xóa — giữ lịch sử)
5. Cập nhật file_versions
```

### 4.8. Query API

**CLI tool** (`scripts/kg-query.py`):

```bash
# Impact analysis
python scripts/kg-query.py impact --service auth-service

# Coverage check
python scripts/kg-query.py coverage --type FR

# Context assembly
python scripts/kg-query.py context --agent sdlc-lld --target auth-service

# Dependency graph (export Mermaid)
python scripts/kg-query.py graph --root FR-AUTH-001 --depth 2 --format mermaid

# Risk assessment
python scripts/kg-query.py risk --fr FR-AUTH-001

# Traceability gap
python scripts/kg-query.py gaps --type traceability
```

**Subagent integration:** Tạo `sdlc-kg` subagent — orchestrator gọi khi cần query:
```javascript
Agent({
  subagent_type: "sdlc-kg",
  prompt: `Impact analysis: auth-service thay đổi API login. Những FR nào bị ảnh hưởng?`
})
```

---

## 5. Phân tích ROI

### 5.1. Giá trị mang lại

| Use Case | Hiện tại (file-based) | Với KG | Tần suất sử dụng |
|----------|----------------------|--------|------------------|
| Impact analysis | grep + thủ công (5-15 phút) | 1 query (<1 giây) | Mỗi CR |
| Coverage check | Đọc từng file (10-30 phút) | 1 query (<1 giây) | Mỗi sprint review |
| Context assembly | Orchestrator thủ công chọn file | Tự động, chính xác | Mỗi agent spawn |
| Risk assessment | Human judgment | Quantitative score | Mỗi lần route flow |
| Traceability verify | Manual (check-traceability.sh) | Tự động, liên tục | Mỗi CI run |
| Gate readiness | Đọc requirements-matrix | Query KG | Mỗi phase gate |

### 5.2. Khi nào KG trở thành MUST-HAVE (không còn là nice-to-have)

```
Scale threshold:
   ≤3 features  → File-based OK, KG là over-engineering
  4-10 features → File-based bắt đầu đau, KG có ích
  >10 features  → File-based không scale được, KG là BẮT BUỘC
  >20 features  → KG + auto-update là bắt buộc
```

Hiện tại SDLC Toolkit đang ở demo scale (3 features trong PaymentApp demo). Nhưng khi áp dụng thực tế, scale sẽ nhanh chóng vượt ngưỡng.

### 5.3. Chi phí triển khai

| Phase | Nội dung | Effort |
|-------|----------|--------|
| Phase 1: Core Schema | SQLite schema + indexes + migration | 1-2 ngày |
| Phase 2: Populator | `kg-populator.py` — parse frontmatter, upsert nodes+edges | 2-3 ngày |
| Phase 3: Query API | `kg-query.py` — CLI tool + common query patterns | 2-3 ngày |
| Phase 4: Integration | Hook vào agent output, CI/CD pipeline | 2-3 ngày |
| Phase 5: Subagent | `sdlc-kg` subagent cho orchestrator query | 1-2 ngày |
| **Tổng** | | **8-13 ngày (~2 tuần)** |

---

## 6. Đánh giá Rủi ro

| Rủi ro | Mức độ | Mitigation |
|--------|--------|-----------|
| **KG stale** — file thay đổi nhưng KG không cập nhật | Medium | `file_hash` comparison → incremental update. Scheduled full rebuild mỗi session start. |
| **SSOT confusion** — KG lệch với file nguồn | High | Files LUÔN là SSOT. KG là derived view. Mọi query ghi rõ "derived from files at {timestamp}". |
| **Over-engineering** — KG quá phức tạp cho scale hiện tại | Medium | Triển khai incremental: bắt đầu với Core Schema (nodes+edges), thêm features khi cần. |
| **SQLite lock** — conflict khi nhiều agent cùng write | Low | SQLite WAL mode. Write pattern: single populator process, agents không write trực tiếp. |
| **Frontmatter compliance** — agents không điền đúng format | Medium | Gate check mới: verify frontmatter completeness trước khi accept spec. |

---

## 7. Quyết định Go/No-Go

### Lý do GO:

1. **Templates đã có sẵn structured data** — `depends_on`/`referenced_by` frontmatter là semi-structured, chỉ cần parse
2. **Chi phí thấp** — SQLite không cần server, populator script <500 dòng Python
3. **Impact cao** — mở khóa impact analysis, context assembly tự động, risk quantification
4. **Scale blocker** — không có KG, SDLC không scale được qua 10 features
5. **Reference implementations có sẵn** — sdlc-harness (madhavmadupu) đã chứng minh pattern này hoạt động

### Lý do delay:

1. **Scale hiện tại thấp** — demo chỉ có 3 features, file-based vẫn OK
2. **Agent compliance risk** — agents có thể không điền frontmatter đầy đủ
3. **Maintenance burden** — thêm 1 component cần maintain

### Kết luận: **GO — bắt đầu Phase 1 ngay**

Lý do: KG không phải là thứ "đợi đến khi cần mới làm". Nó cần có sẵn TRƯỚC KHI scale. Đây là infrastructure investment.

---

## 8. Lộ trình Triển khai

```
Phase 1: Core Schema (2 ngày)
  Day 1: SQLite schema (schema.sql) + migration script
         - 6 tables: nodes, edges, reasoning, agent_status, file_versions
         - Composite key pattern (node_type, node_id)
         - JSON payload cho flexibility
  Day 2: Index optimization + seed data từ PaymentApp demo
         - Verify recursive CTE hoạt động với seed data
         - Write schema tests (pytest)

Phase 2: Populator (3 ngày)
  Day 1: kg-populator.py — YAML frontmatter parser
         - Parse depends_on, referenced_by từ tất cả .md files
  Day 2: Structured file parsers
         - OpenAPI 3.1 YAML → API nodes + edges
         - domain-service-mapping.yaml → Domain/Service nodes
         - Board/Backlog Markdown tables → Sprint/Feature nodes
  Day 3: Incremental update logic
         - SHA-256 file hashing + file_versions comparison
         - Idempotent upsert (INSERT OR IGNORE cho edges)
         - Deleted file detection (mark stale, không xóa)

Phase 3: Query API (2 ngày)
  Day 1: kg-query.py CLI tool
         - impact --service / --fr / --file
         - coverage --type traceability / --type test
         - context --agent {type} --target {id}
         - graph --root {id} --depth {n} --format mermaid
         - risk --fr {id} / --cr {description}
         - gaps --type traceability / --type test
  Day 2: Recursive CTE queries
         - Impact analysis với transitive closure
         - Dependency cycle detection
         - Format output: table, JSON, Mermaid diagram

Phase 4: Integration (3 ngày)
  Day 1: Claude Code Stop hook
         - Hook gọi kg-populator.py --incremental
         - <500ms target (skip nếu không có file thay đổi)
  Day 2: Orchestrator integration
         - sdlc-orchestrator: query KG để context assembly trước khi spawn agent
         - sdlc-automation: query KG để risk assessment trước khi dispatch workflow
         - sdlc-quick: query KG để confirm trivial gate (blast radius check)
  Day 3: CI/CD + documentation
         - GitHub Actions: kg-populator.py --rebuild trên main branch push
         - Documentation: KG schema + query patterns + troubleshooting

Phase 5: sdlc-kg Subagent (2 ngày)
  Day 1: Subagent definition (.claude/agents/sdlc-kg.md)
         - Read-only, allowed-tools: Bash (kg-query.py)
         - Prompt: nhận câu hỏi natural language → map thành query → trả về structured result
  Day 2: Skill definition (.claude/skills/sdlc-kg/SKILL.md)
         - Frontmatter: auto-activation khi orchestrator cần impact analysis
         - Body: query patterns, output format, integration points

Tổng: 12 ngày (~2.5 tuần)
```

**Deliverables:**
1. `scripts/kg-schema.sql` — 6 tables + indexes
2. `scripts/kg-populator.py` — incremental populator với 3 format parsers
3. `scripts/kg-query.py` — CLI với 8 query commands
4. `.claude/agents/sdlc-kg.md` — subagent definition
5. `.claude/skills/sdlc-kg/SKILL.md` — skill cho orchestrator
6. `.claude/hooks/stop-kg-sync.sh` — Stop hook script
7. `.work/kg.db` — SQLite database (auto-generated, gitignored)
8. Gate check: frontmatter completeness verify trong SRS/HLD/LLD phases
9. Documentation: `agent_docs/kg-schema.md` + query patterns cheatsheet

---

## 9. Metric Thành công

| Metric | Target | Đo lường |
|--------|--------|----------|
| Impact analysis time | <5 giây (từ >5 phút) | Thời gian trả lời câu hỏi "FR nào bị ảnh hưởng?" |
| Coverage completeness | 100% FR có đủ outgoing edges | `kg-query.py gaps --type traceability` |
| Agent context accuracy | Giảm 30% context load | So sánh context size trước/sau KG |
| Populator freshness | <1 phút sau file change | File hash comparison interval |
| Stale rate | <5% nodes có `file_hash` khớp với file nguồn | `kg-query.py health` |

---

_Đánh giá này dựa trên phân tích 30 templates (~4,552 dòng), 18 entity types, 21 relationship types từ codebase hiện tại, và tham chiếu từ sdlc-harness, OpenSearch Atlas, cùng các nguồn deep research._
