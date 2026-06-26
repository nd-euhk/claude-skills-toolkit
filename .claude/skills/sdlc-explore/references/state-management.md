# State Management — sdlc-explore

Trạng thái exploration được lưu trong `.explore/state.json` ở gốc project. File này là single source of truth — mọi phase đọc và ghi vào đây.

## State Schema

```json
{
  "version": "1.0.0",
  "projectName": "my-platform",
  "slug": "my-platform",
  "createdAt": "2026-06-26T09:00:00+07:00",
  "updatedAt": "2026-06-26T14:30:00+07:00",

  "current": {
    "service": "auth-service",
    "phase": "scout-done",
    "startedAt": "2026-06-26T14:00:00+07:00"
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
        "phases": {
          "srs": false,
          "hld": false,
          "lld": 0,
          "impTst": { "total": 0, "passed": 0 }
        }
      },

      "sync": {
        "lastSyncAt": "ISO8601 or null",
        "baselineTag": "explore-20260626-auth-service--my-platform or null"
      }
    }
  },

  "history": [
    {
      "action": "scout | explore | sync",
      "projects": ["auth-service", "shared-utils"],
      "timestamp": "ISO8601",
      "duration": "25m",
      "status": "completed | failed | partial"
    }
  ]
}
```

## Classification: service vs libs

### Nguyên tắc chung

**service** = build ra artifact có thể chạy độc lập (server, worker, cron job).
**libs** = chỉ export functions/types/classes, được services khác import.

### Build Detection Logic

Thực hiện detection ở skill level (Bash only, không tốn agent context):

#### Step 1: Kiểm tra build files

```bash
# Tìm build file trong thư mục project
ls {path}/pom.xml {path}/build.gradle* {path}/package.json {path}/go.mod {path}/Cargo.toml {path}/pyproject.toml {path}/Makefile 2>/dev/null
```

#### Step 2: Phân loại theo build system

**Spring Boot Maven (pom.xml):**
```bash
# service nếu có spring-boot-maven-plugin
grep -q 'spring-boot-maven-plugin' {path}/pom.xml && echo "service" || echo "libs"
```

**Spring Boot Gradle (build.gradle):**
```bash
# service nếu có 'org.springframework.boot' plugin HOAC 'application' plugin
grep -qE "org\.springframework\.boot|id\s*'application'" {path}/build.gradle* && echo "service" || echo "libs"
```

**Quarkus Maven (pom.xml):**
```bash
# service nếu có quarkus-maven-plugin
grep -q 'quarkus-maven-plugin' {path}/pom.xml && echo "service" || echo "libs"
```

**Micronaut (build.gradle / pom.xml):**
```bash
# service nếu có micronaut plugin hoặc Dockerfile
grep -qE 'io\.micronaut|micronaut' {path}/build.gradle* {path}/pom.xml 2>/dev/null && echo "service" || echo "libs"
```

**Node.js (package.json):**
```bash
# service nếu có "start" script HOAC web framework dependency
grep -qE '"start"' {path}/package.json && echo "service"
grep -qE '"express"|"fastify"|"koa"|"hapi"|"@nestjs/core"|"next"' {path}/package.json && echo "service"
# Nếu không có cả 2 → libs
echo "libs"
```

**Go (go.mod):**
```bash
# service nếu main.go có func main() và http.ListenAndServe HOAC tương tự
grep -qE 'func main\(\)' {path}/main.go 2>/dev/null && echo "service" || echo "libs"
```

**Rust (Cargo.toml):**
```bash
# service nếu Cargo.toml có web framework dependency
grep -qE 'actix|axum|rocket|warp|tide' {path}/Cargo.toml 2>/dev/null && echo "service"
# HOAC có src/main.rs
[ -f "{path}/src/main.rs" ] && echo "service" || echo "libs"
```

**Python (pyproject.toml):**
```bash
# service nếu có web framework dependency
grep -qE 'fastapi|flask|django|aiohttp|litestar|sanic' {path}/pyproject.toml 2>/dev/null && echo "service"
# HOAC có entry point với uvicorn/gunicorn
grep -qE 'uvicorn|gunicorn|flask run|django manage' {path}/pyproject.toml {path}/Dockerfile 2>/dev/null && echo "service"
echo "libs"
```

#### Step 3: Secondary signals (bất kể build system)

```bash
# Dockerfile ở root project = dấu hiệu mạnh của service
[ -f "{path}/Dockerfile" ] && echo "service"

# docker-compose.yml reference đến project này
grep -q "{project_name}" docker-compose*.yml 2>/dev/null && echo "service"

# Kubernetes manifests (k8s/, deploy/, helm/) reference đến project
find {path} -name 'deployment*.yaml' -o -name 'service*.yaml' 2>/dev/null | head -1 && echo "service"
```

#### Step 4: Rule ưu tiên

1. Nếu bất kỳ secondary signal nào match → **service**
2. Nếu build system detection trả về "service" → **service**
3. Mặc định (fallback) → **libs** (an toàn hơn — libs scout chung service đầu tiên)

### Implementation (Bash script at skill level)

```bash
classify_project() {
  local path="$1"
  local name="$2"

  # Secondary signals first (strongest)
  if [ -f "$path/Dockerfile" ]; then echo "service"; return; fi
  if grep -q "$name" docker-compose*.yml 2>/dev/null; then echo "service"; return; fi

  # Maven
  if [ -f "$path/pom.xml" ]; then
    if grep -qE 'spring-boot-maven-plugin|quarkus-maven-plugin' "$path/pom.xml"; then
      echo "service"; return
    else
      echo "libs"; return
    fi
  fi

  # Gradle
  if [ -f "$path/build.gradle" ] || [ -f "$path/build.gradle.kts" ]; then
    if grep -qE "org\.springframework\.boot|id\s*'application'|io\.micronaut" "$path"/build.gradle* 2>/dev/null; then
      echo "service"; return
    else
      echo "libs"; return
    fi
  fi

  # Node.js
  if [ -f "$path/package.json" ]; then
    if grep -qE '"start"|"express"|"fastify"|"koa"|"@nestjs/core"|"next"' "$path/package.json"; then
      echo "service"; return
    else
      echo "libs"; return
    fi
  fi

  # Go
  if [ -f "$path/go.mod" ]; then
    if [ -f "$path/main.go" ] && grep -q 'func main()' "$path/main.go"; then
      echo "service"; return
    else
      echo "libs"; return
    fi
  fi

  # Rust
  if [ -f "$path/Cargo.toml" ]; then
    if grep -qE 'actix|axum|rocket|warp|tide' "$path/Cargo.toml" || [ -f "$path/src/main.rs" ]; then
      echo "service"; return
    else
      echo "libs"; return
    fi
  fi

  # Python
  if [ -f "$path/pyproject.toml" ]; then
    if grep -qE 'fastapi|flask|django|aiohttp|litestar|uvicorn|gunicorn' "$path/pyproject.toml"; then
      echo "service"; return
    else
      echo "libs"; return
    fi
  fi

  # Fallback: check for entry point patterns
  if grep -qE 'func main|def main|if __name__' "$path"/main.* "$path"/index.* "$path"/server.* 2>/dev/null; then
    echo "service"; return
  fi

  # Default
  echo "libs"
}
```

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

- **todo**: Chưa xử lý gì
- **scouting**: Đang scout (transient, chỉ trong current)
- **scout-done**: Scout hoàn tất, có thể explore hoặc sync
- **exploring**: Đang explore (transient)
- **explore-done**: Explore hoàn tất
- **syncing**: Đang sync (transient)
- **sync-done**: Sync hoàn tất, có thể sync tiếp nếu có thay đổi mới

## State Operations

### Create (first run)

```js
const state = {
  version: "1.0.0",
  projectName,
  slug,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  current: null,
  nextActions: [],
  projects: {},
  history: []
}
```

### Load + Merge (subsequent runs)

```js
// 1. Load existing state
const existing = JSON.parse(readFile('.explore/state.json'))

// 2. Merge newly discovered projects
for (const proj of discoveredProjects) {
  if (existing.projects[proj.name]) {
    // Already known — check if source changed
    const prev = existing.projects[proj.name]
    if (proj.commitHash && prev.scout.commitHash !== proj.commitHash) {
      // Source changed — reset to todo
      prev.status = 'todo'
      prev.scout.done = false
      prev.scout.commitHash = proj.commitHash
      prev.explore.done = false
    }
    // Update type if reclassified
    if (proj.type !== prev.type) {
      prev.type = proj.type
    }
  } else {
    // New project — add with status 'todo'
    existing.projects[proj.name] = {
      type: proj.type,
      path: proj.path,
      gitRef: proj.gitRef,
      buildSystem: proj.buildSystem,
      status: 'todo',
      scout: { done: false, lastScoutAt: null, commitHash: proj.commitHash, reportPath: null, filesFound: 0, scoutedWith: null },
      explore: { done: false, lastExploreAt: null, phases: {} },
      sync: { lastSyncAt: null, baselineTag: null }
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
writeFile('.explore/state.json', JSON.stringify(existing, null, 2))
```

### Update after scout

```js
function updateAfterScout(state, serviceName, libNames, scoutResults) {
  const now = new Date().toISOString()

  // Update service
  const svc = state.projects[serviceName]
  svc.status = 'scout-done'
  svc.scout = {
    done: true,
    lastScoutAt: now,
    commitHash: svc.scout.commitHash,
    reportPath: scoutResults.reports.find(r => r.name === serviceName)?.outputPath,
    filesFound: scoutResults.reports.find(r => r.name === serviceName)?.filesFound || 0
  }

  // Update libs
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

  // Update state
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
}
```

### Update after explore

```js
function updateAfterExplore(state, serviceName, exploreResult) {
  const now = new Date().toISOString()

  const svc = state.projects[serviceName]
  svc.status = 'explore-done'
  svc.explore = {
    done: true,
    lastExploreAt: now,
    phases: {
      srs: exploreResult.results.srs?.passed || false,
      hld: exploreResult.results.hld?.passed || false,
      lld: exploreResult.results.lld || 0,
      impTst: {
        total: exploreResult.results.impTst?.total || 0,
        passed: exploreResult.results.impTst?.impPassed + exploreResult.results.impTst?.tstPassed || 0
      }
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
}
```

### Update after sync

```js
function updateAfterSync(state, serviceName, syncResult) {
  const now = new Date().toISOString()

  const svc = state.projects[serviceName]
  svc.status = 'sync-done'
  svc.sync.lastSyncAt = now
  svc.sync.baselineTag = syncResult.tag

  state.current = { service: serviceName, phase: 'sync-done', startedAt: now }
  state.updatedAt = now
  state.history.push({
    action: 'sync',
    projects: [serviceName],
    timestamp: now,
    status: 'completed'
  })
}
```

## Libs Reuse Logic

Khi chọn service thứ 2 (hoặc sau đó), các libs có thể đã được scout với service trước đó.

### Logic

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

### AskHuman về reused libs

Nếu có `reusedLibs.length > 0`:

```
AskUserQuestion:
- Question: "{N} thư viện đã được scout trước đó với {scoutedWith}. Dùng lại scout có sẵn hay scout lại?"
  (header: "Libs Scout")
- Options:
  - "Dùng lại scout có sẵn (Recommended)" — tiết kiệm thời gian
  - "Scout lại tất cả" — đảm bảo dữ liệu mới nhất
  - "Scout lại các libs đã thay đổi" — chỉ scout libs có commit hash thay đổi
```

## Display State Summary

Hiển thị bảng trạng thái trước khi ask human chọn service tiếp theo:

```
| Service | Status | Last Scout | Last Explore | Last Sync |
|---------|--------|------------|--------------|-----------|
| auth-service | explore-done | 2026-06-26 14:25 | 2026-06-26 15:10 | — |
| payment-service | todo | — | — | — |
| notification-service | scout-done | 2026-06-26 14:25 | — | — |

Libs: shared-utils (scout-done, with auth-service), http-kit (scout-done, with auth-service)
```

## Edge Cases

### Project bị xóa khỏi workspace

Khi merge state, project không còn trong discoveredProjects → xóa khỏi state.projects và nextActions.

### Project thay đổi type

Nếu reclassify từ `libs` → `service` (do thêm Dockerfile): cập nhật type, reset status về `todo`.

Nếu từ `service` → `libs`: cập nhật type. Nếu đã explore-done, hỏi human có muốn giữ không.

### State file bị corrupt

```
try {
  JSON.parse(readFile('.explore/state.json'))
} catch {
  AskUserQuestion: ".explore/state.json bị hỏng. Xóa và tạo mới?" (header: "State Corrupt")
  - "Tạo mới" → xóa file, tạo từ scratch
  - "Abort" → dừng
}
```

### Không có service nào

Nếu tất cả projects đều là `libs` (workspace chỉ có thư viện, không có service):
```
AskUserQuestion: "Không phát hiện service nào (chỉ có libs). Xử lý toàn bộ như một project?" (header: "No Service")
- "Gộp tất cả thành 1 project" → gán type=service cho tất cả, gom vào 1 scout+explore
- "Chọn project để xử lý" → hiển thị danh sách libs để chọn
- "Abort"
```
