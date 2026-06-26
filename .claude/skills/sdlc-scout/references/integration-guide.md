# Integration Guide — sdlc-scout với sdlc-review và sdlc-explore

Cách tích hợp `sdlc-scout` vào các skill SDLC hiện có. Chỉ cần đọc khi đang sửa `sdlc-review` hoặc `sdlc-explore`.

## Tổng quan

```
Trước: Mỗi skill tự implement scout (duplicate code)
Sau:   Cả 2 skill gọi sdlc-scout (single source of truth)

sdlc-review --code ──▶ Skill(sdlc-scout, "{path} --mode review")
sdlc-explore        ──▶ Skill(sdlc-scout, ". --mode explore")
```

## sdlc-review integration

### Thay đổi trong SKILL.md

Trong Phase 5 code mode dispatch:

```diff
- // Phase 0 is inside workflow-sdlc-review-code.js (1 agent)
+ // Phase 0: Call sdlc-scout before dispatching review workflow
+ const scoutResult = await Skill(sdlc-scout, "{targetPath} --mode review --focus '{focus}'")
+ // Pass scoutReports to workflow
  const codeArgs = {
    repoPath, targetPath, dimensions, adversarial, runDate,
+   scoutReports: scoutResult.reports,  // structured, not string
  }
```

### Thay đổi trong workflow-sdlc-review-code.js

```diff
- // Phase 0: Scout — 1 general-purpose agent
- const scoutResult = await agent("You are a codebase explorer...")
- const scoutSummary = scoutResult || "Scout failed..."

+ // No Phase 0 scout — use provided scoutReports
+ // Each review agent reads relevant scout report sections before exploring
  function codeContext(scoutReports) {
    return `## Scout Reports
-   ${scoutSummary}
+   ${scoutReports.map(r => `- ${r.name}: ${r.filesFound} files (${r.highRelevance} high), 
+     ${r.modulesFound} modules, ${r.entryPointsFound} entry points.
+     Report: ${r.outputPath}`).join('\n')}
    
    ## Instructions
+   Read the scout report(s) above for codebase structure.
+   Then explore files relevant to your review dimension.`
-   EXPLORE the codebase first using Bash(find, ls), Glob, Grep, and Read tools.
  }
```

**Workflow meta update:** Bỏ phase "Scout" khỏi `meta.phases[]` — review workflow không còn tự scout.

## sdlc-explore integration

### Thay đổi trong SKILL.md

Phases 1-2 được thay thế:

```diff
- Phase 1: Discover Sub-Projects (4 patterns, repomix packing)
- Phase 2: Scout — Workflow({scriptPath: "workflow-sdlc-scout-pipeline.js"})
+ Phase 1: Scout via sdlc-scout
+ const scoutResult = await Skill(sdlc-scout, ". --mode explore")
+ // scoutResult.reports → dùng cho Phase 2 (Plan) và Phase 3 (SDLC pipeline)
```

**Lưu ý:** Phase numbering trong sdlc-explore giảm đi 1 (Phase 3 cũ → Phase 2 mới, v.v.).

## Sau khi tích hợp

### Cấu trúc thư mục scout

```
.work/scouts/
├── scout-review-YYYYMMDD--auth.md         # từ sdlc-review
├── scout-YYYYMMDD-api-service--slug.md    # từ sdlc-explore
└── ...
```

### Điểm cần verify

- [ ] `sdlc-review --code` không còn Phase 0 scout agent trong workflow
- [ ] `workflow-sdlc-review-code.js` nhận `scoutReports` từ args thay vì tự scout
- [ ] `sdlc-explore` gọi `sdlc-scout` thay vì tự discover + gọi pipeline
- [ ] Cả 2 skill vẫn hoạt động với codebase nhỏ (scout skill strategy)
- [ ] Cả 2 skill vẫn hoạt động với codebase lớn (pipeline strategy)
