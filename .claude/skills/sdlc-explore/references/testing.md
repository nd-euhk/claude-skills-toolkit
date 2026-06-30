# Testing & Quality Gates — sdlc-explore v3

Test cases và quality gates để xác thực skill hoạt động đúng trước khi deploy.

## Activation Tests

Các trigger phrases phải kích hoạt được skill:

| # | Trigger Phrase | Expected | Mode |
|---|---------------|----------|------|
| 1 | "explore codebase" | Auto-activate | Full |
| 2 | "khám phá codebase" | Auto-activate | Full |
| 3 | "reverse engineer dự án X" | Auto-activate | Full |
| 4 | "phân tích mã nguồn service X" | Auto-activate | Full |
| 5 | "tạo tài liệu SDLC từ code" | Auto-activate | Full |
| 6 | "explore service auth" | Auto-activate | Full |
| 7 | "explore architecture" | Auto-activate | Architect |
| 8 | "sync documents for payment-service" | Auto-activate | Sync |
| 9 | "cập nhật tài liệu" | Auto-activate | Sync |
| 10 | "/sdlc-explore" | Manual invoke | AskUserQuestion mode |

## Mode Selection Tests

| # | Input | Expected Mode | Args |
|---|-------|--------------|------|
| 1 | `sdlc-explore` (no args) | AskUserQuestion | — |
| 2 | `sdlc-explore full` | Full Pipeline | mode=full |
| 3 | `sdlc-explore architect` | Architect Only | mode=architect |
| 4 | `sdlc-explore sync` | Sync Mode | mode=sync |
| 5 | `sdlc-explore full --lang en` | Full Pipeline | mode=full, lang=en |
| 6 | `sdlc-explore --en` | AskUserQuestion | lang=en |

## State Management Tests

| # | Scenario | Expected Behavior |
|---|----------|------------------|
| 1 | `knowledge/explore.json` chưa tồn tại | Tạo mới với default schema |
| 2 | `knowledge/explore.json` tồn tại, valid | Load + validate, merge discovered |
| 3 | `knowledge/explore.json` corrupt | AskUserQuestion: tạo mới hay abort |
| 4 | Project mới được thêm vào repo | Merge → status: "todo" |
| 5 | Commit hash thay đổi | Reset status về "todo" |
| 6 | Project bị xóa khỏi repo | Xóa khỏi state.projects |
| 7 | Reclassify libs → service | Cập nhật type, reset về "todo" |
| 8 | 0 service được phát hiện | AskUserQuestion: gộp tất cả thành 1 project |

## Human-in-the-Loop Gate Tests

| # | Gate | Expected AskUserQuestion | Options |
|---|------|------------------------|---------|
| 1 | Mode selection (no --mode) | "Chọn chế độ khám phá" | Full Pipeline / Architecture Only / Sync Documents |
| 2 | Plan (Phase 3) | EnterPlanMode → Plan agent → ExitPlanMode | — |
| 3 | Plan approved | "Tiếp tục thực thi pipeline?" | Tiếp tục / Xem lại plan |
| 4 | Service selection (nhiều todo) | "Chọn service để khám phá" | Danh sách service + "Dừng ở đây" |
| 5 | Libs reuse (có reusedLibs) | "Dùng lại scout có sẵn hay scout lại?" | Dùng lại / Scout lại tất cả / Scout lại đã thay đổi |
| 6 | Next action (còn service todo) | "Chọn service tiếp theo" | Service list + Dừng + System-Wide Merge |
| 7 | All explored | "Hoàn tất!" | System-Wide Merge / Sync / Dừng |
| 8 | FR-Discovery partial fail | "Retry failed EPIC, skip, or abort?" | Retry / Skip / Abort |
| 9 | LLD blocking fail | "Retry LLD, skip and proceed, or abort?" | Retry / Skip / Abort |
| 10 | IMP/TST partial fail | "Retry failing group, skip, or abort?" | Retry / Skip / Abort |

## Error Handling Tests

| # | Scenario | Expected Behavior |
|---|----------|------------------|
| 1 | State file corrupt | AskUserQuestion: tạo mới / abort |
| 2 | State file not found | Tạo mới từ Phase 0 |
| 3 | No services found (all libs) | AskUserQuestion: gộp 1 project / chọn / abort |
| 4 | Workflow FR-Discovery partial fail | Pattern 1: AskUserQuestion retry/skip/abort per EPIC |
| 5 | Workflow LLD gate fail (3 retries) | Pattern 2: AskUserQuestion retry/skip/abort |
| 6 | Workflow IMP/TST group fail | Pattern 3: AskUserQuestion retry/skip/abort per group |
| 7 | Sync: no changes detected | AskUserQuestion: force run / chọn phases / bỏ qua |
| 8 | Sync: service chưa explore (only scout-done) | AskUserQuestion: tiếp tục sync / explore trước |
| 9 | Merge: C4 gate failure | AskUserQuestion: retry C4 / skip / abort |
| 10 | Merge: Events/APIs partial | AskUserQuestion: retry failed / skip / abort |
| 11 | Workflow tool unavailable | Fallback: manual agent orchestration |
| 12 | Stale state (>30 days) | Warning + gợi ý explore lại |

## Quality Gates (Internal Validation)

Chạy các gate này SAU mỗi lần refine skill:

### Gate A: SKILL.md Constraints
- [ ] Body < 500 dòng
- [ ] Frontmatter có name, description, version
- [ ] description chứa ≥ 3 trigger phrases
- [ ] allowed-tools áp dụng principle of least privilege

### Gate B: Reference Integrity
- [ ] Tất cả files referenced trong SKILL.md tồn tại
- [ ] Không có orphaned reference files
- [ ] References chỉ 1 cấp (không có nested dirs)
- [ ] Mỗi reference file có mục đích rõ ràng

### Gate C: Workflow Integration
- [ ] `workflow-sdlc-explore-pipeline.js` tồn tại và khớp args structure
- [ ] `workflow-sdlc-system-merge.js` tồn tại và khớp args structure
- [ ] Args structure trong SKILL.md khớp với workflow-handoff.md

### Gate D: Human-in-the-Loop
- [ ] Mọi quyết định quan trọng đều có AskUserQuestion gate
- [ ] Plan approval luôn dùng EnterPlanMode → ExitPlanMode
- [ ] Không có `--auto` flag (human-in-the-loop bắt buộc)

### Gate E: State Consistency
- [ ] explore.json schema khớp giữa SKILL.md và state-management.md
- [ ] State updates được ghi sau mỗi phase
- [ ] nextActions được rebuild sau mỗi thay đổi

## Regression Test Scenarios

### Full Pipeline Happy Path
```
1. Chạy sdlc-explore full trên repo có 2 services
2. Verify: explore.json được tạo
3. Verify: cả 2 services được explore tuần tự
4. Verify: FR files được tạo với EPIC codes đúng
5. Verify: tech-design.md tồn tại cho mỗi service
6. Verify: IMP+TST files tồn tại
7. Verify: explore-summary.md được tạo
8. Verify: System-Wide Merge có thể chạy sau khi explore xong
```

### Architect Mode Happy Path
```
1. Chạy sdlc-explore architect trên repo có 1 service
2. Verify: FR files được tạo
3. Verify: tech-design.md tồn tại
4. Verify: KHÔNG có IMP+TST files
5. Verify: KHÔNG có Service Notes
```

### Sync Mode Happy Path
```
1. Explore 1 service trước
2. Thay đổi source code của service đó
3. Chạy sdlc-explore sync
4. Verify: change detection hoạt động
5. Verify: human chọn được phases
6. Verify: chỉ phases được chọn chạy lại
```

### Multi-Service Explore
```
1. Repo có 3 services: auth, payment, notification
2. Chạy full mode
3. Verify: auth được explore → AskUserQuestion chọn service tiếp
4. Chọn payment → explore → AskUserQuestion
5. Chọn "System-Wide Merge" → merge workflow chạy
6. Verify: C4 diagram, error codes, events, APIs được tạo
```
