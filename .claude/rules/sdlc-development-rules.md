# SDLC Development Rules

Áp dụng khi SDLC agents viết hoặc sửa code: `sdlc-tdd-be-green`,
`sdlc-tdd-fe-green`, `sdlc-tdd-be-refactor`, `sdlc-tdd-fe-refactor`. Rule này
đảm bảo code từ các agent khác nhau tuân theo cùng một chuẩn — không phụ thuộc
vào agent nào sinh ra code.

**Không** áp dụng cho `sdlc-imp` — IMP agent viết implementation specs
(execution flows, business rules, error mapping), không viết code.

## Baseline

- Tuân theo project docs trong `agent_docs/` và patterns hiện có trong codebase.
- Ưu tiên YAGNI, KISS, DRY — theo thứ tự đó.
- Triển khai hành vi thực. **Không** thêm fake data, mock tạm thời, hoặc
  shortcut chỉ để pass test.
- Giữ thay đổi trong phạm vi TC hiện tại (TDD) hoặc feature hiện tại (IMP).
- Dùng kebab-case cho tên file mới khi repo không có convention mạnh hơn.
- Chỉ tách code khi thực sự giảm complexity hoặc khớp module boundary hiện có.

## Quality Gates

- Chạy narrowest test trước, mở rộng ra nếu shared contracts thay đổi.
- **Không** giấu failing tests, lint errors, type errors, build errors.
- Giữ public contracts trừ khi thay đổi được xác nhận trong scope.
- Commit format: conventional commits (`feat:`, `fix:`, `refactor:`, `test:`),
  **không** có AI reference trong commit message.
- **Không** commit secrets, `.env` files, tokens, private keys, database
  credentials, hoặc personal data.

## TDD Discipline

- RED phase: test PHẢI fail trước khi viết implementation. Báo cáo
  `accidental-green` nếu test pass mà không có implementation mới.
- GREEN phase: implementation tối thiểu để pass test — không refactor, không
  optimize sớm.
- REFACTOR phase: chỉ refactor khi tất cả tests đang pass. Giữ tests xanh qua
  từng thay đổi.
- INTERFERENCE: nếu TC mới làm vỡ TC cũ → dừng, báo cáo, không tự sửa.

## Spec Traceability

- Code từ IMP agent PHẢI trace được về LLD work package.
- Code từ TDD agent PHẢI trace được về TST spec test case.
- Implementation deviations từ spec → ghi rõ trong commit message hoặc code
  comment lý do. Khi TDD agent deviates từ spec, dùng `Skill("fable-thinking")`
  để verify đây là justified adaptation hay scope creep trước khi continue.
