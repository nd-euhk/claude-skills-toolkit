# State Management — sdlc-explore v3

Trạng thái exploration được lưu trong `knowledge/explore.json` ở gốc project. File này là single source of truth — mọi phase đọc và ghi vào đây.

## State Schema

```json
{
  "version": "3.0.0",
  "projectName": "my-platform",
  "slug": "my-platform",
  "createdAt": "2026-06-30T09:00:00+07:00",
  "updatedAt": "2026-06-30T14:30:00+07:00",

  "current": {
    "service": "auth-service",
    "phase": "scout-done",
    "startedAt": "2026-06-30T14:00:00+07:00"
  },

  "nextActions": ["payment-service", "notification-service"],

  "projects": {
    "<project-name>": {
      "type": "service | libs",
      "path": "relative/path/from/root",
      "gitRef": "submodule | nested-repo | monorepo | root",
      "buildSystem": "maven | gradle | npm | go-mod | cargo | pip | unknown",
      "status": "todo | scouting | scout-done | exploring | explore-done | syncing | sync-done",

      "scout": {
        "done": false,
        "lastScoutAt": "ISO8601 or null",
        "commitHash": "abc1234 or null",
        "reportPath": "relative/path or null",
        "filesFound": 0,
        "scoutedWith": "service-name or null"
      },

      "explore": {
        "done": false,
        "lastExploreAt": "ISO8601 or null",
        "epicCodes": ["WAL", "PAY"],
        "planPath": ".work/plans/explore-20260630-auth-service--my-platform.md or null",
        "phases": {
          "frDiscovery": false,
          "lld": false,
          "impTst": { "total": 0, "passed": 0 },
          "serviceNotes": false
        }
      },

      "sync": {
        "lastSyncAt": "ISO8601 or null"
      }
    }
  },

  "history": [
    {
      "action": "scout | explore | sync | system-merge",
      "projects": ["auth-service", "shared-utils"],
      "timestamp": "ISO8601",
      "duration": "25m",
      "status": "completed | failed | partial"
    }
  ],

  "systemMerge": {
    "done": false,
    "lastMergeAt": "ISO8601 or null",
    "services": ["auth-service", "payment-service"],
    "results": null
  }
}
```

## Classification: service vs libs

### General Principle

**service** = build ra artifact có thể chạy độc lập (server, worker, cron job).
**libs** = chỉ export functions/types/classes, được services khác import.

### Detection Rules (Priority Order)

Thực hiện detection ở skill level (Bash only):

| Priority | Signal | Classification |
|----------|--------|---------------|
| **1 (strongest)** | `{path}/Dockerfile` tồn tại | → **service** |
| **1** | Tên project xuất hiện trong `docker-compose*.yml` | → **service** |
| **1** | Có `deployment*.yaml` hoặc `service*.yaml` | → **service** |
| **2** | `pom.xml` chứa `spring-boot-maven-plugin` hoặc `quarkus-maven-plugin` | → **service** |
| **2** | `build.gradle*` chứa `org.springframework.boot` hoặc `id 'application'` | → **service** |
| **2** | `package.json` chứa `"start"`, `express`, `fastify`, `koa`, `@nestjs/core`, `next` | → **service** |
| **2** | `go.mod` + `main.go` chứa `func main()` | → **service** |
| **2** | `Cargo.toml` chứa `actix`/`axum`/`rocket`/`warp`/`tide` hoặc có `src/main.rs` | → **service** |
| **2** | `pyproject.toml` chứa `fastapi`/`flask`/`django`/`aiohttp`/`uvicorn`/`gunicorn` | → **service** |
| **3 (fallback)** | Có file entry point (`main.*`, `index.*`, `server.*`) với `func main`/`def main`/`if __name__` | → **service** |
| **default** | Không khớp rule nào | → **libs** |

**Implementation note:** Dùng `grep -q` + `test -f` ở Bash skill level. KHÔNG spawn agent cho việc này.

## State Machine

```
┌──────┐   scout    ┌──────────┐   explore   ┌──────────────┐
│ todo │───────────▶│scout-done│────────────▶│ explore-done │
└──────┘            └──────────┘             └──────────────┘
    │                     │                         │
    │                     │ sync                    │ sync
    ▼                     ▼                         ▼
┌──────┐   sync     ┌──────────┐              ┌───────────┐
│syncing│──────────▶│sync-done │              │ sync-done │
└──────┘            └──────────┘              └───────────┘
```

## State Operations

### Create (first run)

```js
const state = {
  version: "3.0.0",
  projectName,
  slug,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  current: null,
  nextActions: [],
  projects: {},
  history: []
}
writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
```

### Load + Merge (subsequent runs)

```js
// 1. Load existing state
const existing = JSON.parse(readFile('knowledge/explore.json'))

// 2. Merge newly discovered projects
for (const proj of discoveredProjects) {
  if (existing.projects[proj.name]) {
    const prev = existing.projects[proj.name]
    // Commit hash thay đổi → reset về todo
    if (proj.commitHash && prev.scout.commitHash !== proj.commitHash) {
      prev.status = 'todo'
      prev.scout.done = false
      prev.scout.commitHash = proj.commitHash
      prev.explore.done = false
    }
    // Type thay đổi → cập nhật
    if (proj.type !== prev.type) {
      prev.type = proj.type
    }
  } else {
    existing.projects[proj.name] = {
      type: proj.type,
      path: proj.path,
      gitRef: proj.gitRef,
      buildSystem: proj.buildSystem,
      status: 'todo',
      scout: { done: false, lastScoutAt: null, commitHash: proj.commitHash, reportPath: null, filesFound: 0, scoutedWith: null },
      explore: { done: false, lastExploreAt: null, epicCodes: [], planPath: null, phases: {} },
      sync: { lastSyncAt: null }
    }
  }
}

// 3. Remove projects that no longer exist
for (const name of Object.keys(existing.projects)) {
  if (!discoveredProjects.find(p => p.name === name)) {
    delete existing.projects[name]
  }
}

// 4. Rebuild nextActions
existing.nextActions = Object.entries(existing.projects)
  .filter(([_, p]) => p.type === 'service' && p.status === 'todo')
  .map(([name]) => name)

// 5. Save
writeFile('knowledge/explore.json', JSON.stringify(existing, null, 2))
```

### Update after scout

```js
function updateAfterScout(state, serviceName, libNames, scoutResults) {
  const now = new Date().toISOString()

  const svc = state.projects[serviceName]
  svc.status = 'scout-done'
  svc.scout = {
    done: true,
    lastScoutAt: now,
    commitHash: svc.scout.commitHash,
    reportPath: scoutResults.reports.find(r => r.name === serviceName)?.outputPath,
    filesFound: scoutResults.reports.find(r => r.name === serviceName)?.filesFound || 0
  }

  for (const libName of libNames) {
    const lib = state.projects[libName]
    lib.status = 'scout-done'
    lib.scout = {
      ...lib.scout,
      done: true,
      lastScoutAt: now,
      reportPath: scoutResults.reports.find(r => r.name === libName)?.outputPath,
      scoutedWith: serviceName
    }
  }

  state.current = { service: serviceName, phase: 'scout-done', startedAt: now }
  state.nextActions = Object.entries(state.projects)
    .filter(([_, p]) => p.type === 'service' && p.status === 'todo')
    .map(([name]) => name)
  state.updatedAt = now
  state.history.push({
    action: 'scout',
    projects: [serviceName, ...libNames],
    timestamp: now,
    status: 'completed'
  })

  writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
}
```

### Update after explore

```js
function updateAfterExplore(state, serviceName, exploreResult, epicCodes, planPath) {
  const now = new Date().toISOString()

  const svc = state.projects[serviceName]
  svc.status = 'explore-done'
  svc.explore = {
    done: true,
    lastExploreAt: now,
    epicCodes: epicCodes,
    planPath: planPath,
    phases: {
      frDiscovery: exploreResult.results.frDiscovery?.passed || false,
      lld: exploreResult.results.lld?.passed || false,
      impTst: {
        total: exploreResult.results.impTst?.total || 0,
        passed: (exploreResult.results.impTst?.impPassed || 0) + (exploreResult.results.impTst?.tstPassed || 0)
      },
      serviceNotes: exploreResult.results.serviceNotes?.passed || false,
    }
  }

  state.current = { service: serviceName, phase: 'explore-done', startedAt: now }
  state.updatedAt = now
  state.history.push({
    action: 'explore',
    projects: [serviceName],
    timestamp: now,
    status: 'completed'
  })

  writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
}
```

### Update after sync

```js
function updateAfterSync(state, serviceName, syncResult) {
  const now = new Date().toISOString()

  const svc = state.projects[serviceName]
  svc.status = 'sync-done'
  svc.sync.lastSyncAt = now
  state.current = { service: serviceName, phase: 'sync-done', startedAt: now }
  state.updatedAt = now
  state.history.push({
    action: 'sync',
    projects: [serviceName],
    timestamp: now,
    status: 'completed'
  })

  writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
}
```

### Update after system-merge

```js
function updateAfterSystemMerge(state, mergeResult) {
  const now = new Date().toISOString()

  state.systemMerge = {
    done: true,
    lastMergeAt: now,
    services: mergeResult.services,
    results: mergeResult.results
  }
  state.updatedAt = now
  state.history.push({
    action: 'system-merge',
    projects: mergeResult.services,
    timestamp: now,
    status: mergeResult.phase ? 'failed' : 'completed'
  })

  writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
}
```

## Libs Reuse Logic

Khi chọn service thứ 2 (hoặc sau đó), các libs có thể đã được scout với service trước đó.

```js
function getLibsForService(state, serviceName) {
  const libs = Object.entries(state.projects)
    .filter(([_, p]) => p.type === 'libs')
    .map(([name, proj]) => ({ name, ...proj }))

  const freshLibs = libs.filter(l => !l.scout.done)
  const reusedLibs = libs.filter(l => l.scout.done)

  return { freshLibs, reusedLibs }
}
```

### AskHuman About Reused Libs

Nếu có `reusedLibs.length > 0`:

```
AskUserQuestion: (header: "Libs Scout")
  "{N} thư viện đã được scout trước đó với {scoutedWith}. Dùng lại scout có sẵn hay scout lại?"
  - "Dùng lại scout có sẵn (Recommended)"
  - "Scout lại tất cả"
  - "Scout lại các libs đã thay đổi" (chỉ khi có commit hash thay đổi)
```

## Display State Summary

```
| # | Service | Status | Last Scout | Last Explore | Last Sync | Epic Codes |
|---|---------|--------|------------|--------------|-----------|------------|
| 1 | auth-service | explore-done | 2026-06-30 14:25 | 2026-06-30 15:10 | — | AUTH, IAM |
| 2 | payment-service | todo | — | — | — | — |
| 3 | notification-service | scout-done | 2026-06-30 14:25 | — | — | — |

Libs: shared-utils (scout-done, with auth-service), http-kit (scout-done, with auth-service)
State: knowledge/explore.json
```

## Edge Cases

### State File Not Found

Nếu `knowledge/explore.json` không tồn tại → tạo mới từ Phase 0.

### Corrupt State File

```
try {
  JSON.parse(readFile('knowledge/explore.json'))
} catch {
  AskUserQuestion: (header: "State Corrupt")
    "knowledge/explore.json bị hỏng. Xóa và tạo mới?"
    - "Tạo mới" → xóa file, tạo từ scratch
    - "Abort" → dừng
}
```

### Project Removed from Workspace

Khi merge state, project không còn trong discoveredProjects → xóa khỏi state.projects và nextActions.

### Project Type Changed

Nếu reclassify từ `libs` → `service`: cập nhật type, reset status về `todo`.
Nếu từ `service` → `libs`: cập nhật type. Nếu đã explore-done, hỏi human.

### No Services Found

Nếu tất cả projects đều là `libs`:
```
AskUserQuestion: (header: "No Service")
  "Không phát hiện service nào (chỉ có libs). Xử lý toàn bộ như một project?"
  - "Gộp tất cả thành 1 project"
  - "Chọn project để xử lý"
  - "Abort"
```
