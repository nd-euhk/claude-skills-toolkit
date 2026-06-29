# Integration Guide — Tích Hợp sdlc-scout Vào Skill SDLC

Cách tích hợp `sdlc-scout` vào bất kỳ skill SDLC nào. Pattern chung giống nhau cho mọi skill — chỉ khác `--mode` và `--focus`.

## Tổng quan

```
Trước: Mỗi skill tự implement scout (duplicate code, không nhất quán)
Sau:   Mọi skill SDLC gọi sdlc-scout (single source of truth, structured output)

Skill(sdlc-scout, "{path} --mode {mode} --focus '{mô tả}'")
  → scoutResult.reports[]  — structured report paths + metadata
  → scoutResult.gaps       — missed areas, recommendations
```

## Pattern Tích Hợp Chung

Mọi skill SDLC tuân theo pattern giống nhau:

```js
// 1. Gọi sdlc-scout trước khi vào logic chính
const scoutResult = await Skill(sdlc-scout, 
  "{targetPath} --mode {review|explore} --focus '{mô tả ngữ cảnh}'")

// 2. Truyền scoutReports vào workflow/agent
const args = {
  ...otherArgs,
  scoutReports: scoutResult.reports,  // structured, không phải string
}

// 3. Downstream agents đọc report thay vì tự explore
function agentContext(scoutReports) {
  return `## Scout Reports
${scoutReports.map(r => `- ${r.name}: ${r.filesFound} files (${r.highRelevance} high), 
  ${r.modulesFound} modules, ${r.entryPointsFound} entry points.
  Report: ${r.outputPath}`).join('\n')}

## Instructions
Đọc scout report(s) ở trên để hiểu cấu trúc codebase.
Sau đó explore các file liên quan đến nhiệm vụ của bạn.`
}
```

## Ví Dụ Cho Từng Skill

### sdlc-review --code

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

### sdlc-explore

```diff
- Phase 1: Discover Sub-Projects (4 patterns, repomix packing)
- Phase 2: Scout — Workflow({scriptPath: "workflow-sdlc-scout-pipeline.js"})
+ Phase 1: Scout via sdlc-scout
+ const scoutResult = await Skill(sdlc-scout, ". --mode explore")
+ // scoutResult.reports → dùng cho Plan và SDLC pipeline
```

### sdlc-fixbug

```js
const scoutResult = await Skill(sdlc-scout, 
  "{bug-area} --mode review --focus '{bug description}'")
// fix agent đọc report, xác định root cause nhanh hơn
```

### sdlc-flow-task

```js
const scoutResult = await Skill(sdlc-scout, 
  "{feature-area} --mode explore --focus '{feature description}'")
// spec agents (SRS, LLD, IMP, TST) đọc report thay vì tự explore
```

### sdlc-flow-cr / sdlc-flow-contract

```js
const scoutResult = await Skill(sdlc-scout, 
  "{affected-services} --mode review --focus '{change description}'")
// Đánh giá phạm vi ảnh hưởng trước khi thực hiện thay đổi
```

## Sau khi tích hợp

### Cấu trúc thư mục scout

```
.work/scouts/
├── scout-YYYYMMDD-auth--slug.md            # từ sdlc-review
├── scout-YYYYMMDD-api-service--slug.md     # từ sdlc-explore
├── scout-YYYYMMDD-payment-fix--slug.md     # từ sdlc-fixbug
└── ...
```

### Điểm cần verify (cho mọi skill)

- [ ] Skill không còn tự implement scout logic (Bash(find, ls), Grep, Glob để discovery)
- [ ] Workflow/agent nhận `scoutReports` từ args thay vì tự explore
- [ ] Downstream agents được hướng dẫn đọc report trước khi explore
- [ ] Hoạt động với codebase nhỏ (direct Explore agent strategy)
- [ ] Hoạt động với codebase lớn (pipeline strategy)
- [ ] Report có đầy đủ SDLC sections (modules, entry points, dependencies, patterns)
