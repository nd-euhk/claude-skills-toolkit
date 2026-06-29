# Shared Patterns — Common Architecture & Conventions

File này định nghĩa các pattern và quy ước dùng chung cho tất cả 5 phase reference files (srs, hld, lld, imp, tst). Mỗi phase reference file kế thừa các pattern này và chỉ giữ lại nội dung phase-specific.

## Architecture Pattern (3-Actor)

Mọi phase tuân theo cùng một mẫu 3 tác nhân. Thay `{X}` bằng phase identifier (`srs`, `hld`, `lld`, `imp`, `tst`):

```
Skill level (KHỞI TẠO MỘT LẦN):
  Skill(brainstorming) → consolidated context cho TẤT CẢ phase
  Skill(sequential-thinking) → phân tích phức tạp (nếu cần)
  Skill(problem-solving) → giải quyết xung đột (nếu cần)
  Agent(Explore) → quét codebase (nếu cần)
    ↓ consolidated context dùng chung

MỖI PHASE (plan → execute → report → review):
  EnterPlanMode → lập kế hoạch chi tiết cho phase
    ↓ human approval
  ExitPlanMode → triển khai
    ├── Agent(phase-{X}-specialist) → tạo/cập nhật documents
    └── [if --no-gate] → SKIP verification
        [default] → Agent(Explore) với prompt từ references/gate-verifiers.md → verify gate criteria (read-only)
    ↓ pass/fail
  Report results
    ↓ human review → phase tiếp theo
```

**Key principle:** Brainstorming + analysis + explore diễn ra MỘT LẦN ở SKILL level (có thể tương tác với con người). Kết quả là consolidated context dùng chung cho TẤT CẢ phase. Mỗi phase NHẬN context này — không tự chạy brainstorming/analyze/scout riêng.

**Creator ≠ Verifier:** Specialist tạo documents và Explore agent verify documents LUÔN là các agents khác nhau — không bao giờ để một agent tự verify output của chính nó.

## Phase Procedure Template (Dùng cho mọi phase reference file)

Mỗi phase reference file tuân theo cấu trúc sau. Chỉ giữ lại nội dung phase-specific; phần chung tham chiếu đến file này.

### Step 1: Nhận Consolidated Context Từ Skill Level

Phase nhận context đã được thu thập từ skill level (SKILL.md Step 3 Khởi Tạo):
- Brainstorming conclusions (intent, scope, decisions)
- Explore findings (existing patterns, conventions, artifacts)
- Sequential-thinking / problem-solving conclusions

**KHÔNG tự chạy brainstorming/analyze/scout** — những việc này đã hoàn thành ở skill level.

### Step 2: Spawn Specialist to Create Documents

Mỗi phase định nghĩa prompt template riêng cho specialist, truyền vào:
- `{brainstorming_summary}` — từ consolidated context
- `{scout_discoveries}` — từ consolidated context
- `{decisions}` — từ consolidated context
- `{language}` — kế thừa từ calling context

```
Agent(phase-{X}-specialist, prompt: "
  Tạo/cập nhật {PHASE} documents với context sau:

  BRAINSTORMING SUMMARY:
  {brainstorming_summary}

  SCOUT DISCOVERIES:
  {scout_discoveries}

  DECISIONS MADE:
  {decisions}

  INPUTS:
  - Language: {language}

  Viết tất cả output bằng {language}.

  Tạo: {phase_specific_artifacts_list}.
  KHÔNG verify — chỉ tạo.
")
```

### Step 3: Verify via Agent(Explore) (trừ khi --no-gate)

**Nếu `--no-gate` được truyền:** Bỏ qua hoàn toàn bước này. Ghi chú trong report: `"Gate verification SKIPPED (--no-gate)."`

**Default (không có --no-gate):** Sau khi specialist hoàn thành, spawn `Agent(Explore)` với prompt xác minh:

Đọc file `references/gate-verifiers.md` và dùng prompt cho phase `{X}`. Prompt tham chiếu đến gate criteria tại `.claude/agents/_shared/gate-verifier/gate-verifier-{X}.md` và liệt kê artifacts cần verify.

Mỗi phase reference file liệt kê artifacts cụ thể của phase đó trong Step 3.

### Step 4: Report Results

Trả về structured summary cho skill level:
- Phase đã thực thi
- Brainstorming context đã dùng
- Specialist agent đã spawn
- Verification: pass/fail với checklist — hoặc `SKIPPED (--no-gate)`
- Output files đã tạo/sửa
- Bất kỳ blockers hoặc issues nào

## Shared Anti-Patterns

Những anti-patterns này áp dụng cho TẤT CẢ các phase. Mỗi phase reference file có thể thêm phase-specific anti-patterns.

- **Không tự chạy brainstorming/analyze/scout trong phase** — những việc này đã hoàn thành ở skill level. Phase chỉ nhận và dùng consolidated context.
- **Không spawn specialist mà không có consolidated context** — context từ skill level là essential input cho specialist.
- **Không yêu cầu specialist tự verify outputs của nó** — verification là việc của Agent(Explore). Creator và verifier LUÔN là different agents.
- **Không skip verification step trừ khi `--no-gate` được explicitly passed** — gate verification bảo vệ chất lượng artifact.
- **Không dùng `Agent({phase})` để verification** — dùng `Agent(Explore)` với prompt từ `references/gate-verifiers.md`. Explore agent là read-only và độc lập.
