---
name: sdlc-phase-manual
description: >-
  Thực thi tuần tự một hoặc nhiều pha SDLC (SRS, HLD, LLD, IMP, TST) ở chế độ
  thủ công với brainstorming tương tác cùng con người và xác minh gate
user-invocable: false
version: 1.6.0
argument-hint: "[srs][hld][lld][imp][tst] [--no-gate]"
allowed-tools: Read, Write, Bash(*), Glob, Grep, Agent, Skill, TaskCreate, TaskUpdate, TaskGet, TaskList
---

# SDLC Phase Manual — Multi-Phase Executor (Interactive)

Thực thi tuần tự tất cả các pha SDLC được chỉ định trong mỗi lần gọi. Bạn được gọi bởi các skill khác cần chạy một hoặc nhiều pha cụ thể — bạn KHÔNG phải là trình điều phối pipeline end-to-end. Các phase được thực thi tuần tự theo đúng thứ tự được chỉ định trong argument (vd: `srs hld lld`). Mỗi phase hoàn thành và được verify trước khi phase tiếp theo bắt đầu.

## Architecture Pattern

**Khởi tạo một lần** ở đầu, sau đó **mỗi phase vào plan mode riêng** trước khi triển khai:

```
INPUT: [srs][hld][lld][imp][tst] [--no-gate]
         ↓
  ┌─ KHỞI TẠO (MỘT LẦN DUY NHẤT) ──────────────────────────┐
  │ Skill(brainstorming) → khám phá TẤT CẢ phase cùng lúc   │
  │ Agent(Explore) → quét codebase (nếu cần)                │
  │ Skill(sequential-thinking) → phân tích phức tạp (nếu cần)│
  │ Skill(problem-solving) → giải quyết xung đột (nếu cần)  │
  │   ↓ consolidated context dùng chung                     │
  └────────────────────────────────────────────────────────┘
         ↓
  ╔══════════════════════════════════════════════════════════════╗
  ║     TUẦN TỰ TỪNG PHASE (plan → execute → report → review)     ║
  ║                                                              ║
  ║  ┌─ PHASE 1 ─────────────────────────────────────────┐      ║
  ║  │ ① EnterPlanMode → lập kế hoạch chi tiết cho phase  │      ║
  ║  │    ↓ human approval                                │      ║
  ║  │ ② ExitPlanMode → triển khai                        │      ║
  ║  │    ├── Agent(phase-{X}-specialist) → tạo documents  │      ║
  ║  │    └── Agent(Explore) → verify gate (trừ --no-gate)│      ║
  ║  │    ↓ documents + gate result                       │      ║
  ║  │ ③ Report kết quả phase                             │      ║
  ║  │    ↓ human review                                  │      ║
  ║  └────────────────────────────────────────────────────┘      ║
  ║         ↓                                                    ║
  ║  ┌─ PHASE 2 ─────────────────────────────────────────┐      ║
  ║  │ ① EnterPlanMode → lập kế hoạch chi tiết cho phase  │      ║
  ║  │ ... (lặp lại: plan → execute → report → review) ...│      ║
  ║  └────────────────────────────────────────────────────┘      ║
  ║         ↓                                                    ║
  ║  ┌─ PHASE N ─────────────────────────────────────────┐      ║
  ║  │ ... (lặp lại: plan → execute → report → review) ...│      ║
  ║  └────────────────────────────────────────────────────┘      ║
  ╚══════════════════════════════════════════════════════════════╝
         ↓
  TỔNG HỢP KẾT QUẢ TẤT CẢ CÁC PHASE
```

**Tại sao dùng pattern này:** Khởi tạo chạy MỘT LẦN — brainstorming + explore + reasoning — để có consolidated context cho tất cả phase. Sau đó MỖI PHASE vào plan mode riêng: lập kế hoạch chi tiết → human approval → triển khai (specialist + verify) → report → human review → phase tiếp theo. Cách này đảm bảo con người kiểm soát từng bước, có thể điều chỉnh hướng đi giữa các phase. Specialist tạo documents, Agent Explore verify độc lập — creator và verifier luôn là các agent khác nhau.

**Cờ `--no-gate`:** Khi calling context truyền `--no-gate`, bỏ qua hoàn toàn bước xác minh cho TẤT CẢ các phase. Hữu ích khi skill gọi tự xử lý verification riêng, hoặc khi tốc độ quan trọng hơn gate compliance. Cờ được parse từ arguments của skill trước khi thực thi toàn bộ chuỗi phase.

**Specialist + Verifier mapping:**

| Phase | Specialist Agent | Gate Verification |
|-------|-----------------|-------------------|
| SRS | `Agent(phase-srs-specialist)` | `Agent(Explore)` với prompt từ `references/gate-verifiers.md#srs-gate-verification` |
| HLD | `Agent(phase-hld-specialist)` | `Agent(Explore)` với prompt từ `references/gate-verifiers.md#hld-gate-verification` |
| LLD | `Agent(phase-lld-specialist)` | `Agent(Explore)` với prompt từ `references/gate-verifiers.md#lld-gate-verification` |
| IMP | `Agent(phase-imp-specialist)` | `Agent(Explore)` với prompt từ `references/gate-verifiers.md#imp-gate-verification` |
| TST | `Agent(phase-tst-specialist)` | `Agent(Explore)` với prompt từ `references/gate-verifiers.md#tst-gate-verification` |

Mỗi specialist được định nghĩa trong `.claude/agents/phase-{X}-specialist.md` với hooks validate output paths. Verifier prompt trong `references/gate-verifiers.md` (mục tương ứng cho từng phase) tham chiếu đến gate criteria file tại `.claude/agents/_shared/gate-verifier/gate-verifier-{X}.md`.

## Quick Start

### Step 1: Xác Định Phases

Dựa trên calling context, xác định danh sách phase cần thực thi:

| Argument | Phase(s) | Thứ tự |
|----------|----------|--------|
| `srs` | SRS | — |
| `hld` | HLD | — |
| `lld` | LLD | — |
| `imp` | IMP | — |
| `tst` | TST | — |
| `srs hld` | SRS, HLD | SRS → HLD |
| `srs hld lld` | SRS, HLD, LLD | SRS → HLD → LLD |
| `imp tst` | IMP, TST | IMP + TST parallel |
| `srs hld lld imp tst` | Toàn bộ 5 phase | SRS → HLD → LLD → IMP + TST parallel |

**Thứ tự thực thi:** Các phase luôn được thực thi theo đúng thứ tự xuất hiện trong argument. Thứ tự khuyến nghị: SRS → HLD → LLD → IMP + TST parallel (mỗi phase phụ thuộc vào output của phase trước đó).

**Nếu không có phase nào được chỉ định:** Dùng `Skill(sequential-thinking)` để suy luận phase cần thiết từ context, sau đó route. **KHÔNG hỏi con người** — bạn được gọi bởi skill khác, không phải trực tiếp bởi con người.

### Step 2: Parse Flags

Trích xuất flags từ calling context trước khi thực thi:
- `--no-gate`: Bỏ qua bước gate verification cho TẤT CẢ các phase. Truyền flag này qua cho từng procedure của reference file.

### Step 3: Khởi Tạo (Một Lần Duy Nhất)

Gọi `Skill(brainstorming)` với toàn bộ danh sách phase để:
- Khám phá intent và scope cho TẤT CẢ các phase cùng lúc
- Xác định dependencies và cross-phase concerns
- Làm rõ ambiguities trước khi bắt đầu chuỗi
- Output: consolidated context lưu tại `.work/brainstorming/BRAIN-YYYYMMDD--{slug}.md`

Sau brainstorming, nếu cần:
- `Agent(Explore)` — quét codebase tìm patterns, conventions, artifacts hiện có
- `Skill(sequential-thinking)` — phân tích decisions phức tạp ảnh hưởng nhiều phase
- `Skill(problem-solving)` — giải quyết xung đột giữa các phase

Kết quả khởi tạo được dùng chung làm context cho TẤT CẢ phase.

### Step 4: Thực Thi Từng Phase (Plan → Execute → Report → Review)

Với mỗi phase trong danh sách (theo đúng thứ tự):

**① EnterPlanMode — Lập kế hoạch chi tiết cho phase:**
- Load reference file cho phase đó (`references/{phase}-phase.md`)
- Dùng consolidated context từ Step 3
- Lập kế hoạch: xác định inputs cần verify, brainstorming scope (đã có từ khởi tạo), specialist prompt cụ thể, artifacts sẽ tạo
- Trình bày plan cho con người phê duyệt qua `EnterPlanMode`

**② ExitPlanMode → Triển khai sau khi được phê duyệt:**
- Verify inputs tồn tại (theo reference file's Input Detection)
- Nếu thiếu input, báo cáo và dừng — KHÔNG tiếp tục
- Spawn specialist: `Agent(phase-{X}-specialist)` với consolidated context + plan đã duyệt
- Verify (trừ khi `--no-gate`): `Agent(Explore)` với prompt từ `references/gate-verifiers.md` (mục cho phase `{X}`)

**③ Report kết quả phase:**
- Phase đã thực thi
- Brainstorming context đã dùng
- Specialist agent đã spawn
- Verification: pass/fail với checklist — hoặc `SKIPPED (--no-gate)`
- Output files đã tạo/sửa
- Bất kỳ blockers hoặc issues nào

**④ Human review trước khi tiếp tục:**
- Con người xem xét kết quả phase
- Có thể yêu cầu điều chỉnh trước khi chuyển phase tiếp
- Nếu phase fail, dừng chuỗi — phase sau phụ thuộc vào output của phase trước
- **⚠️ Trước khi vào plan mode cho phase tiếp theo:** raise yêu cầu con người chạy `/compact` với custom instruction bên dưới. Instruction này đảm bảo consolidated context từ Step 3 không bị mất — nếu mất context khởi tạo, phase tiếp theo sẽ thiếu foundation.

**Custom `/compact` instruction (đưa cho con người paste):**

````
You have written a partial transcript for the initial task above. Please write a summary of the transcript. The purpose of this summary is to provide continuity so you can continue to make progress towards solving the task in a future context, where the raw history above may not be accessible and will be replaced with this summary. Write down anything that would be helpful, including the state, next steps, learnings etc. You must wrap your summary in a <summary></summary> block.

CRITICAL — giữ lại đầy đủ, không được cắt bớt:
1. TOÀN BỘ consolidated context từ Step 3 Khởi Tạo:
   - Brainstorming results (intent, scope, cross-phase concerns, ambiguities đã resolved)
   - Agent(Explore) findings (codebase patterns, conventions, artifacts hiện có)
   - Sequential-thinking/problem-solving conclusions (decisions phức tạp, xung đột đã giải quyết)
   - Path tới file `.work/brainstorming/BRAIN-YYYYMMDD--{slug}.md`
2. Danh sách phase đã hoàn thành + kết quả từng phase (output files, gate status)
3. Danh sách phase còn lại cần thực thi (theo thứ tự)
4. Path các file output quan trọng đã tạo (để phase sau dùng làm input)
5. Trạng thái `--no-gate` flag
````

### Step 5: Tổng Hợp Kết Quả

Sau khi tất cả phase hoàn thành, trả về structured summary cho skill gọi:

**Tổng quan:**
- Tổng số phase đã thực thi
- Số phase pass / fail / skipped gate
- Tổng thời gian thực thi

**Chi tiết từng phase:**
- Phase đã thực thi
- Plan đã duyệt (tóm tắt)
- Brainstorming context path (dùng chung)
- Specialist agent đã dùng
- Verification: pass/fail với checklist — hoặc `SKIPPED (--no-gate)`
- Output files đã tạo/sửa
- Bất kỳ blockers hoặc issues nào

**Trạng thái chuỗi:**
- Phase nào đã hoàn thành thành công
- Phase nào đã fail (nếu có) — và lý do dừng chuỗi

## Common Reasoning Skills

Những skills này khả dụng cho TẤT CẢ các phase. Mỗi phase reference định nghĩa trigger conditions cụ thể — chỉ invoke khi điều kiện được đáp ứng, không bao giờ gọi theo phản xạ.

### Skill(brainstorming)
Dùng MỘT LẦN ở Step 3 (Khởi Tạo) để khám phá TẤT CẢ phase cùng lúc: requirements intent, architectural approaches, design alternatives. Brainstorming context được dùng chung cho toàn bộ chuỗi — từng phase không gọi lại.

**Khi nào skip:** Calling skill đã cung cấp detailed plan không có ambiguity cho tất cả phase; inputs straightforward với obvious approaches.

### Skill(sequential-thinking)
Dùng khi đối mặt với decisions ảnh hưởng đến nhiều components hoặc cần step-by-step analysis:
- Multi-step reasoning có dependencies
- Hypothesis verification trước khi commit vào một direction
- Adaptive planning khi new information xuất hiện mid-phase
- LUÔN dùng trước khi đưa ra questions/solutions cho con người hoặc calling skill

**Anti-pattern:** Dùng sequential-thinking cho trivial single-step decisions (vd: "nên đọc file A hay file B").

### Skill(problem-solving)
Dùng khi stuck trên complex problems:
- Requirements ambiguous với nhiều valid interpretations
- Design constraints xung đột với nhau
- Implementation approach fundamentally unclear
- Cross-cutting concerns không fit clean patterns
- Kết hợp với sequential-thinking cho complex multi-variable problems

### Agent(Explore)
Dùng để codebase scanning khi phase cần discover existing patterns, files, hoặc conventions. Mỗi phase reference định nghĩa specific scouting triggers. Explore agent là read-only — dùng để discovery, không dùng để thay đổi.

## Key Notes

**Tuần tự từng phase với plan mode.** Mỗi phase: EnterPlanMode → lập kế hoạch chi tiết → human approval → ExitPlanMode → triển khai (specialist + verify) → report → human review → phase tiếp theo. Nếu một phase fail, dừng toàn bộ chuỗi — các phase sau phụ thuộc vào output của phase trước.

**Khởi tạo một lần duy nhất.** Step 3 chạy MỘT LẦN ở đầu: brainstorming + Agent(Explore) nếu cần + sequential-thinking/problem-solving nếu cần. Kết quả là consolidated context dùng chung cho TẤT CẢ phase — từng phase không khởi tạo lại. Khởi tạo diễn ra ở skill level vì cần tương tác với con người.

**Two-agent verification pattern.** Mỗi phase dùng `Agent(phase-{X}-specialist)` để tạo documents và `Agent(Explore)` để verify — creator và verifier LUÔN là các agents khác nhau. Verification prompt được định nghĩa trong `references/gate-verifiers.md` (một mục cho mỗi phase), tham chiếu đến gate criteria tại `.claude/agents/_shared/gate-verifier/gate-verifier-{X}.md`. Xem [shared patterns](references/shared-patterns.md) để biết chi tiết.

**`--no-gate` bypass.** Dùng khi calling skill tự xử lý verification riêng, cần rapid iteration, hoặc verification không cần thiết. Luôn ghi chú `SKIPPED (--no-gate)` trong return summary.

**Plan mode cho từng phase.** Bạn vào `EnterPlanMode` cho MỖI phase trước khi triển khai. Plan mode để con người phê duyệt kế hoạch chi tiết của phase đó. Sau khi approved, `ExitPlanMode` rồi mới spawn specialist. Không vào plan mode cho toàn bộ chuỗi — chỉ cho từng phase riêng lẻ.

**Bảo toàn context khởi tạo qua `/compact`.** Sau mỗi phase, trước khi vào plan mode phase tiếp theo, raise yêu cầu con người chạy `/compact` với custom instruction (xem template trong Step 4 ④). Instruction yêu cầu giữ lại: (1) toàn bộ consolidated context từ Step 3 (brainstorming + explore + reasoning), (2) danh sách phase đã done + output files, (3) danh sách phase còn lại, (4) `--no-gate` flag. Context khởi tạo là ESSENTIAL — nếu mất, phase tiếp theo mất foundation để lập plan chính xác.

**Language.** Kế thừa language preference từ calling context. Technical terms và code identifiers không bao giờ được dịch.

**Templates.** Mỗi specialist agent biết default templates của nó. Trừ khi calling skill override, dùng agent's defaults.

**Task management.** Dùng Task tools để track progress trong phase — điều này cung cấp visibility vào phase's work khi nó đang chạy.

