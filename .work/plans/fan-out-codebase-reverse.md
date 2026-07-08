# Kế hoạch: Fan-Out Agent cho sdlc-codebase — Workflow + codebase-* Agents

## Context

**Vấn đề:** `sdlc-codebase` spawn 1 agent cho mỗi phase bất kể số lượng service → quá tải context window khi >3-5 services, suy giảm chất lượng.

**Hướng tiếp cận:**
1. **Workflow scripts** cho fan-out execution — skill chỉ là thin orchestrator, không giữ context của N agents
2. **Agent mới với prefix `codebase-*`** — chuyên biệt cho reverse engineering, không dùng lại `sdlc-*`
3. **Dùng `subagent-creator` skill** để tạo agents, **`workflow-knowledge`** để viết workflow

---

## Kiến trúc mới

```
sdlc-codebase (SKILL.md) — THIN ORCHESTRATOR
  │
  ├─ Bước 1-4: Git check → Parse args → Smart detection → Foundation gate → Scout
  │   (giữ nguyên, chạy trong skill context)
  │
  └─ Bước 5: Package args → EnterPlanMode → Human review →
              Workflow({scriptPath: ".claude/workflows/codebase/workflow-codebase-reverse.js", args})
                                │
                                ├─ Phase HLD: 1 agent codebase-hld
                                │
                                ├─ Phase LLD: N agents codebase-lld (∥ per service)
                                │   └─ Synthesis: 1 agent codebase-lld-synthesis
                                │
                                ├─ Phase SRS: M agents codebase-srs (∥ per domain)
                                │   └─ Synthesis: 1 agent codebase-srs-synthesis
                                │
                                └─ Phase IMP+TST: M agents codebase-imp ∥ M agents codebase-tst
                                    (∥ per domain — CÙNG domain như SRS)
```

**Lý do dùng Workflow thay vì Agent tool trong skill:**
- Skill context sẽ bị overload nếu phải track N parallel agents + kết quả → hallucination
- Workflow script xử lý fan-out trong script variables, skill chỉ nhận kết quả cuối cùng
- Workflow resumable — nếu crash ở phase 3, chạy lại chỉ re-run phase 3+

---

## Files cần tạo/sửa

### Tạo mới: 7 agents (`codebase-*`)

Tất cả agents có chung các đặc điểm:
- **Mặc định reverse engineering mode** — extract từ code, không design từ specs
- **Có UNCERTAINTY protocol** built-in (flag `UNCERTAIN`, `INFERRED`, `NOT FOUND`)
- **Có `Agent` trong tools** — để spawn Explore subagents khi scout report không đủ thông tin
- **Nhận scout report path làm input chính** — đọc scout → xác định gaps → Explore nếu cần → extract + viết
- **Có "Summary for Synthesis"** section trong output để synthesis agent tiêu thụ
- **`permissionMode: acceptEdits`** — write agent_docs/ không cần prompt
- **`model: sonnet`** — cân bằng giữa chất lượng và tốc độ

| # | Agent | Scope | Output | Trigger phrases |
|---|-------|-------|--------|-----------------|
| 1 | `codebase-hld` | Toàn bộ codebase | `architecture.md`, `adrs/`, `contracts/`, `hard-boundaries.md` | "extract architecture from code", "reverse engineer HLD" |
| 2 | `codebase-lld` | 1 service | `tech-design/{name}-service.md` (9 sections) | "extract service design from code", "reverse engineer LLD per service" |
| 3 | `codebase-lld-synthesis` | Cross-service | `cross-cutting.md`, `api-{domain}.yaml`, `error-codes.md`, FR enrichment | "synthesize cross-cutting LLD", "merge per-service designs" |
| 4 | `codebase-srs` | 1 domain/epic | `features/FR-{DOMAIN}-*.md` (tất cả features trong domain) | "infer requirements from code", "reverse engineer SRS per domain" |
| 5 | `codebase-srs-synthesis` | Cross-domain | `traceability/requirements-matrix.md`, `features/README.md` | "synthesize requirements matrix", "merge feature specs" |
| 6 | `codebase-imp` | 1 domain/epic | `backend/{svc}/implementation/FR-*-impl.md` (tất cả features trong domain) | "document implementation from code", "reverse engineer IMP per domain" |
| 7 | `codebase-tst` | 1 domain/epic | `backend/{svc}/test-specs/FR-*-test.md` (tất cả features trong domain) | "document test patterns from code", "reverse engineer TST per domain" |

### Granularity Strategy — IMP/TST theo domain, không per-feature

**Vấn đề:** Nếu IMP và TST spawn per-feature, 20 features = 40 agents — quá nhiều, bùng nổ số lượng.

**Giải pháp:** IMP và TST đi theo cùng domain/epic như SRS:

```
SRS:  M domains → M codebase-srs agents
IMP:  M domains → M codebase-imp agents (∥ với TST)
TST:  M domains → M codebase-tst agents
→ Tổng: 2M agents thay vì 2F (F = số features)
```

**Lợi ích:**
- Features trong cùng domain share service, code patterns → agent có context đầy đủ hơn
- IMP agent thấy related features → document được cross-feature execution flows
- TST agent thấy test patterns xuyên suốt domain → phát hiện coverage gaps tốt hơn
- Giảm số lượng agent → workflow chạy nhanh hơn, ít overhead

**IMP+TST fan-out pattern trong workflow:**
```js
phase('IMP+TST')
const impTasks = domains.map(d => () => agent(impPrompt(d), {
  label: `IMP: ${d.name}`,
  agentType: 'codebase-imp',
  phase: 'IMP+TST',
}))
const tstTasks = domains.map(d => () => agent(tstPrompt(d), {
  label: `TST: ${d.name}`,
  agentType: 'codebase-tst',
  phase: 'IMP+TST',
}))
// IMP và TST song song — tất cả domains cùng lúc
const results = await parallel([...impTasks, ...tstTasks])
```

### Scout Report Integration + Explore Subagent Pattern

**Vấn đề:** Scout report có thể không đủ chi tiết cho 1 số service hoặc pattern. Agent cần tự đào sâu.

**Giải pháp:** Tất cả codebase-* agents có `Agent` trong tools và tuân theo pattern:

```
Với mỗi codebase-* agent:
  1. ĐỌC scout report trước tiên — đây là input CHÍNH
  2. Đánh giá: scout có đủ thông tin cho nhiệm vụ của mình không?
  3a. Nếu ĐỦ → tiến hành extract + viết output
  3b. Nếu THIẾU → spawn Explore subagents để đào sâu:
      - "Tìm tất cả exception classes và error handlers trong {service_path}/"
      - "Tìm tất cả API route definitions và controllers trong {service_path}/"
      - "Tìm tất cả database migration files và ORM models trong {service_path}/"
  4. Dùng kết quả Explore + tự Read code → viết output
```

**Agent configuration — tất cả 7 agents có pattern giống nhau:**

```yaml
---
name: codebase-{phase}
description: >-
  [Reverse engineering purpose]. Use when [trigger contexts].
  Input from scout report and prior phase outputs. Writes to agent_docs/ only.
model: sonnet
tools: Read, Write, Edit, Bash, Glob, Agent
permissionMode: acceptEdits
---
[System prompt bao gồm:]
- Core Mission: extract từ code, không design từ specs
- Scout Report First: luôn đọc scout report làm input chính
- Explore Gap Filling: nếu scout không đủ → spawn Explore subagents
- UNCERTAINTY Protocol: flag những gì không xác định được
- Summary for Synthesis: output section để synthesis agent tiêu thụ
```

---

### Tạo mới: 1 workflow script

**`.claude/workflows/codebase/workflow-codebase-reverse.js`**

Script nhận `args` từ skill:
```js
{
  scope: ".",                              // codebase scope
  scoutReportPath: ".work/scouts/scout-20260708-*.md",
  services: [                              // từ scout report
    { name: "auth", path: "src/auth/", type: "node" },
    { name: "payment", path: "src/payment/", type: "go" },
  ],
  domains: [                               // nhóm feature theo domain (từ HLD hoặc scout)
    { name: "identity", services: ["auth"], features: ["login", "registration", "profile"] },
    { name: "billing", services: ["payment"], features: ["checkout", "refund"] },
  ],
  artifacts: ["hld","lld","srs","imp","tst"],
  focus: "Authentication module",          // optional
  foundationPath: "agent_docs/",
  workDir: "/path/to/repo",
}
```

**Workflow structure:**
```
HLD:  1 agent codebase-hld (single — kiến trúc là cross-cutting)
  ↓
LLD:  parallel(N agents codebase-lld) → gate check mỗi agent
      → 1 agent codebase-lld-synthesis (cross-cutting + contracts + FR enrichment)
  ↓
SRS:  parallel(M agents codebase-srs) → gate check mỗi agent
      → 1 agent codebase-srs-synthesis (traceability matrix + README)
  ↓
IMP+TST: parallel(M agents codebase-imp + M agents codebase-tst)
         → gate check mỗi agent (tổng 2M agents song song)
  ↓
Report: cross-reference validation + final summary
```

---

### Sửa: 3 files trong `.claude/skills/sdlc-codebase/`

**`SKILL.md`:**
- Bước 5: thay "spawn sdlc-* agent" → "Workflow({scriptPath, args})"
- Hard Boundaries: thêm rule về workflow invocation, không spawn agent trực tiếp
- Human-in-the-Loop: Plan tổng thể trước workflow, không plan từng agent
- Agent Reference: cập nhật bảng từ sdlc-* → codebase-*

**`flow-reverse.md`:**
- Viết lại thành hướng dẫn package args cho workflow
- Mỗi phase: input args cần gì, agent type tương ứng, expected outputs, gate criteria
- Thêm "Workflow Args Packaging" section chi tiết

**`procedures.md`:**
- Xóa Agent Spawn Templates cũ (không còn dùng)
- Thêm "Workflow Args Packaging" templates
- Thêm "Explore Gap Filling Protocol" — hướng dẫn agent tự spawn Explore
- Giữ Gate Criteria (vẫn áp dụng sau workflow)
- Cập nhật Error Handling (workflow failure, partial agent failure)
- Cập nhật Progress Reporting (từ workflow result, không từ agent)

---

## Verification

1. **Tạo 7 agents qua `subagent-creator`** — validate từng agent (configuration, delegation signals, prompt quality, tool scoping)
2. **Viết workflow script** — kiểm tra syntax, `meta` block, `args` parsing
3. **Cập nhật SKILL.md + flow-reverse.md + procedures.md** — consistency check
4. **End-to-end test scenarios:**
   - 1 service, 1 domain → workflow chạy với 1 agent mỗi phase (giống single-agent path)
   - 3 services, 2 domains → fan-out: 3 LLD agents, 2 SRS agents, 4 IMP+TST agents (2+2)
   - 10 services, 5 domains → fan-out: 10 LLD agents, 5 SRS agents, 10 IMP+TST agents

---

## Không làm

- Không sửa `sdlc-*` agents — giữ nguyên cho forward flow
- Không sửa `sdlc-orchestrator` — phạm vi chỉ trong sdlc-codebase
- Không sửa `sdlc-scout` — đã đủ tốt
- Không giữ lại cơ chế spawn Agent trực tiếp trong skill cho reverse pipeline
- Không tạo IMP+TST per-feature — quá nhiều agents, dùng per-domain

---

## Thứ tự triển khai

1. **Tạo 7 codebase-* agents** bằng `subagent-creator` skill
   - `codebase-hld`, `codebase-lld`, `codebase-lld-synthesis`
   - `codebase-srs`, `codebase-srs-synthesis`
   - `codebase-imp`, `codebase-tst`
2. **Tạo workflow script** `.claude/workflows/codebase/workflow-codebase-reverse.js`
3. **Cập nhật `procedures.md`** (workflow args, gate criteria, error handling)
4. **Cập nhật `flow-reverse.md`** (phase → workflow invocation guide)
5. **Cập nhật `SKILL.md`** (orchestrator → thin routing layer + workflow invocation)
