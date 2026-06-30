# Sync Mode — sdlc-explore v3 (Human-in-the-Loop)

Cập nhật tài liệu exploration hiện có bằng cách phát hiện thay đổi từ lần chạy trước, phân tích impact, và chỉ chạy các SDLC phase bị ảnh hưởng — cho TỪNG service một.

**Human-in-the-loop ở mọi bước quyết định:** chọn service → xem change summary → chọn phases → confirm thực thi.

## Sync Flow Overview

```
Phase S0: Load knowledge/explore.json
    │
Phase S1: Display state summary → 🔴 Human chọn service cần sync
    │
Phase S2: Git change detection cho service được chọn (+ libs của nó)
    │
Phase S3: Impact analysis (Tier 1 rule-based + Tier 2 AI)
    │
Phase S4: Hiển thị change summary → 🔴 Human chọn phases cần chạy lại
    │
Phase S5: Execute selected phases
    │
Phase S6: Cập nhật state + summary
    │
Phase S7: 🔴 Human — sync service tiếp theo?
```

## Sync Step 0: Load State

### Load knowledge/explore.json

```js
const state = JSON.parse(readFile('knowledge/explore.json'))
```

Nếu state không tồn tại:
```
AskUserQuestion: "Chưa có knowledge/explore.json. Chạy explore trước khi sync?" (header: "No State")
- "Chạy explore trước" → chuyển sang full mode
- "Tạo state từ scratch" → tạo state cơ bản
- "Abort"
```

### Display State Summary

```
| # | Service | Status | Last Scout | Last Explore | Last Sync |
|---|---------|--------|------------|--------------|-----------|
| 1 | auth-service | explore-done | 2026-06-26 14:25 | 2026-06-26 15:10 | 2026-06-20 09:00 |
| 2 | payment-service | explore-done | 2026-06-26 14:25 | 2026-06-26 16:00 | — |
| 3 | notification-service | scout-done | 2026-06-26 14:25 | — | — |
```

## Sync Step 1: Human Chọn Service 🔴

```
AskUserQuestion:
- Question: "Chọn service để sync:" (header: "Sync Service")
- Options: danh sách service đã explore-done hoặc scout-done + "Dừng ở đây"
```

Chỉ sync được service đã có ít nhất scout-done.

## Sync Step 2: Git Change Detection

### Determine Baseline

**Priority order:**
1. `service.sync.lastSyncAt` trong knowledge/explore.json
2. `service.explore.lastExploreAt`
3. `service.scout.lastScoutAt` (fallback)

### Collect Changes for Service

```bash
# Main repo (monorepo)
git diff --stat $(git rev-list -1 --before="$BASELINE_DATE" HEAD)..HEAD -- {service.path}/

# Service là submodule
git -C {service.path} log --oneline $BASELINE_HASH..HEAD

# Service là nested repo
git -C {service.path} log --oneline --since="$BASELINE_DATE"

# Libs liên quan
for lib in {libs_scouted_with_service}; do
  git -C {lib.path} log --oneline --since="$BASELINE_DATE"
done
```

### No git fallback

```bash
find {service.path} -newer {baseline_file} -type f | head -50
```

### No changes?

```
AskUserQuestion: "No changes detected for {service} since {baseline}. Run sync anyway?" (header: "No Changes")
- "Chạy sync toàn bộ" → force run tất cả phases
- "Chọn phases để chạy" → skip change detection, hiển thị tất cả phases
- "Bỏ qua, chọn service khác" → quay lại Sync Step 1
```

## Sync Step 3: Impact Analysis

### Tier 1 — Rule-Based Mapping

Áp dụng cho danh sách file đã thay đổi của service hiện tại:

| Change Pattern | Glob | SDLC Impact |
|----------------|------|-------------|
| Source code | `src/**`, `lib/**`, `app/**`, `services/**` | **IMP + TST** |
| API contracts | `*.proto`, `*.graphql`, `openapi*`, `contracts/**` | **FR + LLD** |
| Architecture / Infra | `package.json`, `Dockerfile*`, `docker-compose*`, `terraform/**` | **HLD** |
| Database | `migrations/**`, `*.sql`, `prisma/**` | **LLD + IMP** |
| Tests only | `*.test.*`, `*.spec.*`, `__tests__/**` | **TST** |
| Config | `config/**`, `.env*`, `application*.yml` | **IMP** |
| Docs only | `README*`, `CHANGELOG*`, `docs/**` | **No sync needed** |
| New service/directory | New dir under services/apps/packages | **FR + HLD + LLD** |

### Tier 2 — AI Deep Analysis

Trigger khi: diff > 100 lines, > 10 files, hoặc changes touch core architecture.

Spawn `Agent(Explore)` để phân tích impact sâu hơn:

```
Phân tích impact của các thay đổi trong service {serviceName} ({servicePath}).

Changes:
{list of changed files with diff stats}

Dựa trên FR files hiện tại (knowledge/04-microservices/{serviceName}/), HLD (knowledge/03-system-architecture/C4-context-diagram.md), LLD (knowledge/04-microservices/{serviceName}/tech-design.md):
1. FR nào bị ảnh hưởng?
2. Service dependencies nào bị ảnh hưởng?
3. Architecture patterns nào thay đổi?
4. Đề xuất phases cần cập nhật (FR/HLD/LLD/IMP/TST) và lý do.

Trả về JSON: { affectedFRs: string[], affectedServices: string[], architectureImpact: 'none'|'low'|'medium'|'high', suggestedPhases: string[], reasoning: string }
```

## Sync Step 4: Human Chọn Phases 🔴

**Hiển thị change summary trước khi hỏi:**

```
📊 Change Summary — {service}
├── Files changed: {N}
├── Lines: +{added} -{removed}
├── Change patterns detected:
│   ├── Source code: {N} files → IMP + TST
│   ├── API contracts: {N} files → FR + LLD
│   └── Config: {N} files → IMP
├── AI Analysis: {reasoning tóm tắt}
└── Suggested phases: FR, IMP, TST
```

Sau đó:

```
AskUserQuestion:
- Question: "Phases nào cần chạy lại cho {service}?" (header: "Sync Scope")
  multiSelect: true
- Options:
  - "FR" (pre-select nếu HIGH impact từ Tier 1+2)
  - "HLD" (pre-select nếu HIGH impact)
  - "LLD" (pre-select nếu HIGH impact)
  - "IMP" (pre-select nếu HIGH impact)
  - "TST" (pre-select nếu HIGH impact)
```

## Sync Step 5: Execute Selected Phases

Chạy Phase 4 pipeline với `fromPhase` và `mode` tùy theo phases được chọn.

```js
const workflowArgs = {
  projectName: state.projectName,
  runDate: YYYYMMDD,
  slug: state.slug,
  scoutReports: [
    service.scout.reportPath,
    ...libNames.map(l => state.projects[l].scout.reportPath)
  ],
  language,
  mode: selectedPhases.includes('LLD') || selectedPhases.includes('IMP') || selectedPhases.includes('TST') ? 'full' : 'architect',
  focusedService: serviceName,
  fromPhase: determineStartPhase(selectedPhases),
  epicCodes: service.explore.epicCodes,  // dùng lại EPIC codes đã xác nhận
}
```

### determineStartPhase

```js
function determineStartPhase(phases) {
  if (phases.includes('FR')) return 'FR-Discovery'
  if (phases.includes('HLD')) return 'HLD'
  if (phases.includes('LLD')) return 'LLD'
  if (phases.includes('IMP') || phases.includes('TST')) return 'IMP+TST'
}
```

## Sync Step 6: Update State

Sau khi sync hoàn tất:

```js
function updateAfterSync(state, serviceName, syncResult) {
  const now = new Date().toISOString()

  const svc = state.projects[serviceName]
  svc.sync.lastSyncAt = now
  state.current = { service: serviceName, phase: 'sync-done', startedAt: now }
  state.updatedAt = now
  state.history.push({
    action: 'sync',
    projects: [serviceName],
    timestamp: now,
    duration: syncResult.duration,
    status: syncResult.status,
    phases: syncResult.phases,
  })

  writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
}
```

## Sync Step 7: Human — Next Service? 🔴

```
AskUserQuestion:
- Question: "Sync service tiếp theo hay dừng?" (header: "Continue Sync")
- Options: danh sách service còn lại (đã explore-done hoặc scout-done) + "Dừng ở đây"
```

Nếu chọn service → vòng lại Sync Step 2 với service đó.

## Sync Multiple Services (optional batch)

```
AskUserQuestion:
- Question: "Sync từng service một hay chọn nhiều?" (header: "Sync Batch")
- Options:
  - "Từng service một (Recommended)"
  - "Chọn nhiều service" → multiSelect services, xử lý tuần tự
```

## Edge Cases

### Service Never Explored

Nếu service mới chỉ `scout-done`, chưa `explore-done`:
```
AskUserQuestion: "{service} chưa được explore đầy đủ. Sync sẽ chỉ cập nhật các phase đã có. Tiếp tục?" (header: "Partial Explore")
- "Tiếp tục sync"
- "Chạy explore trước" → chuyển sang full mode
```

### Stale State

Nếu `lastSyncAt` > 30 ngày hoặc `lastExploreAt` > 30 ngày:
```
"Warning: {service} chưa được cập nhật {N} ngày. Cân nhắc chạy explore lại thay vì sync."
```

### Libs Changed but Service Unchanged

```
AskUserQuestion: "Libs {libName} đã thay đổi nhưng {service} không có thay đổi. Cập nhật IMP/TST cho {service}?" (header: "Libs Changed")
- "Có, cập nhật IMP+TST"
- "Không, bỏ qua"
```
