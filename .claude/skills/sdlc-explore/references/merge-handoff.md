# System-Wide Merge Handoff — sdlc-explore v3

Handoff giữa `sdlc-explore` skill Phase 7 và `workflow-sdlc-system-merge.js` workflow. Skill chuẩn bị inputs từ state, workflow chạy 6 phase merge tổng, skill xử lý kết quả và cập nhật state.

## Merge Args Structure (Skill → Workflow)

```js
const mergeArgs = {
  projectName: "my-platform",            // string — từ state.projectName
  slug: "my-platform",                  // string — từ state.slug
  language: "vi",                        // "vi" | "en"
  runDate: "2026-06-30",                // string YYYYMMDD
  services: [                            // string[] — danh sách service đã explore-done
    "auth-service",
    "payment-service",
  ],
  fromPhase: null,                       // string | null — optional force-start trên retry
}
```

Workflow tự đọc tất cả file từ `knowledge/` và `.work/system-wide-notes/` dựa trên `services`. Không cần truyền path cụ thể.

## Merge Workflow Invocation

```
Workflow({ scriptPath: "workflows/workflow-sdlc-system-merge.js", args: mergeArgs })
```

Workflow xử lý 6 phase system-wide: **Collect** → **C4∥CodingConventions∥GlobalErrorCodes** → **HardBoundaries∥CrossCutting** → **Events∥APIs** → **ADRs** → **Final Gate**.

## Merge Result Structure (Workflow → Skill)

### Success

```js
{
  completed: ['Collect', 'C4', 'Coding-Conventions', 'Global-Error-Codes',
              'Hard-Boundaries', 'Cross-Cutting', 'Events', 'APIs', 'ADRs', 'Gate'],
  results: {
    c4: { passed: true },
    codingConventions: { passed: true },
    globalErrorCodes: { passed: true, totalCodes: 42 },
    hardBoundaries: { passed: true },
    crossCutting: { passed: true },
    events: { total: 5, generated: 5 },
    apis: { total: 3, generated: 3 },
    adrs: { total: 2, generated: 2 },
    gate: { passed: true }
  }
}
```

### Partial Failure

```js
{
  phase: 'C4',
  error: 'Gate failed after 2 retries',
  feedback: 'Missing bounded context mapping for payment-service...',
  completed: ['Collect']
}
```

## Error Handling

Xem `references/error-handling.md#system-wide-merge-patterns-phase-7` cho M1 (C4 gate fail) và M2 (Events/APIs partial).

## State Update Sau Merge

```js
function updateAfterSystemMerge(state, mergeResult) {
  const now = new Date().toISOString()

  state.systemMerge = {
    done: true,
    lastMergeAt: now,
    services: mergeResult.services || mergeResult.args?.services,
    results: mergeResult.results,
  }
  state.updatedAt = now
  state.history.push({
    action: 'system-merge',
    projects: mergeResult.services || [],
    timestamp: now,
    status: mergeResult.phase ? 'failed' : 'completed'
  })

  writeFile('knowledge/explore.json', JSON.stringify(state, null, 2))
}
```

Xem `references/state-management.md` để biết schema `systemMerge` field đầy đủ.
