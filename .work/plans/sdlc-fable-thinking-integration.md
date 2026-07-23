# Plan: Tích hợp Fable Thinking vào SDLC Orchestrator + Automation

## Context

Sau khi phân tích toàn bộ 8 skill SDLC, 39 subagent, và 5 rule file, xác định
rằng `fable-thinking` (reasoning protocol từ Claude Fable 5) có giá trị cao nhất
khi được invoke qua `Skill()` tại các **decision points** của orchestrator và
automation — nơi template hijack, frame adoption, và confirmation seeking gây
sai flow/route/escalation.

**Hướng B (Skill invoke)**: Gọi `Skill("fable-thinking", "<context>")` tại
high-stakes decision points, thay vì embed toàn bộ protocol vào skill.

## Deliverables

1. `.claude/rules/sdlc-fable-thinking.md` — **tạo mới** (rule định nghĩa when + how)
2. `.claude/skills/sdlc-orchestrator/SKILL.md` — **sửa** (thêm 4 invoke points)
3. `.claude/skills/sdlc-automation/SKILL.md` — **sửa** (thêm 3 invoke points)

---

## Phase 1: Rule File

### File: `.claude/rules/sdlc-fable-thinking.md` (target ~75 dòng)

Quy ước (từ 5 rule file hiện có):
- Không frontmatter, bắt đầu thẳng `# SDLC Fable Thinking`
- Backtick-wrap skill/flow/file names, bold cho cấm (`**Không**`)
- Bảng cho decision matrix, code block cho protocol template
- Reference skill bằng backtick, không hyperlink đến rule file khác

### Nội dung

```markdown
# SDLC Fable Thinking

Fable-thinking là reasoning middleware cho SDLC decision points — không thay
thế procedure, chỉ verify decision trước khi thực thi. Invoke qua
`Skill("fable-thinking", "<context>")` tại các điểm quyết định high-stakes
được liệt kê bên dưới. Output là calibrated recommendation để human quyết
định — **không** auto-execute.

## When To Invoke

| Decision Point | Skill | Trigger | Action |
|---|---|---|---|
| Flow Detection | `sdlc-orchestrator`, `sdlc-automation` | Keyword match conflict, leftover details contradict matched flow, hoặc ambiguous routing | Invoke trước `AskUserQuestion`, dùng recommendation làm default suggestion |
| Escalation | `sdlc-orchestrator`, `sdlc-automation`, `sdlc-quick` | Bất kỳ escalation trigger nào bắn (trivial gate fail, workflow error, scope vượt lane) | Invoke trước khi propose escalation cho human |
| Pipeline Scope | `sdlc-orchestrator`, `sdlc-automation` | Scope decision skip/run HLD, LLD, hoặc CROSS-CUTTING | Invoke sau grilling, trước khi confirm scope |
| Foundation Gate Fail | `sdlc-orchestrator`, `sdlc-automation` | Preflight không tạo được required files | Invoke trước khi dừng pipeline |
| Grilling Exit | `sdlc-automation` | Sau grilling rounds, không chắc đã đủ info | Invoke trước khi dispatch workflow |
| Fail-Safe | `sdlc-automation` | Workflow dispatch fail hoặc runtime error | Invoke trước khi fallback sang orchestrator |

## Invocation Protocol

Truyền context tóm tắt (không phải full conversation) vào args:

```
Skill("fable-thinking", "<decision-type>: <key facts>.
Options: <list>. Goal: <end-state>.")
```

Context PHẢI gồm: loại quyết định, facts quan sát được (OBSERVED), options,
và goal end-state. Đọc kết quả, trình bày recommendation cho human,
**không** tự động hành động.

## Integration Points

| Skill | Decision Points | Trạng thái |
|---|---|---|
| `sdlc-orchestrator` | Flow Detection, Escalation, Pipeline Scope, Foundation Gate | **Phase 1** |
| `sdlc-automation` | Flow Detection, Grilling Exit, Fail-Safe | **Phase 1** |
| `sdlc-quick` | Trivial Gate, Escalation | Future |
| `sdlc-codebase` | Scope Detection, Overwrite | Future |
| `sdlc-review` | Finding Severity | Future |

## Principles

- **Không** invoke cho mechanical tasks (git check, file existence check, sprint update)
- **Không** thay thế human judgment — recommendation chỉ là input
- **Không** auto-execute — human luôn là người quyết định cuối cùng
- **Luôn** pass đủ context — decision type + facts + options + goal
- **Luôn** report recommendation cùng với lý do và caveats
- **Một lần** invoke cho mỗi decision point — không loop
- Nếu fable-thinking unavailable → fallback về existing procedure (không block pipeline)
```

---

## Phase 2: Orchestrator Integration

### File: `.claude/skills/sdlc-orchestrator/SKILL.md` (331 dòng)

#### Edit 1: Flow Detection Ambiguous (sau dòng 101)

**Vị trí**: Dòng 101 (`> Nếu không chắc chắn → AskUserQuestion (bên dưới).`)

**Thêm vào sau dòng 101**:
```markdown
> **Fable-Thinking Guard**: Khi ambiguous (khớp nhiều flow, leftover details
> mâu thuẫn với flow đã match), invoke `Skill("fable-thinking", "SDLC flow
> routing: user said '<input>'. Candidate flows: <list>. Conflict: <detail>.
> Which flow best serves the user's goal?")` trước khi hỏi human. Dùng
> recommendation làm default option trong `AskUserQuestion`.
```

#### Edit 2: Foundation Gate Fail (dòng 149)

**Vị trí**: Dòng 149 (`3. Post-preflight verify — nếu file vẫn missing → **dừng pipeline**, báo cáo human`)

**Sửa thành**:
```markdown
3. Post-preflight verify — nếu file vẫn missing:
   a. Invoke `Skill("fable-thinking", "Foundation gate: missing <files>
      for flow=<flow>. Can pipeline proceed or must stop? Consider: what
      downstream agents need from each missing file.")`
   b. Trình bày recommendation cho human
   c. Nếu recommendation = stop → **dừng pipeline**; nếu proceed → ghi
      nhận risk và tiếp tục với human approval
```

#### Edit 3: Escalation (Hard Boundaries, dòng 45)

**Vị trí**: Dòng 45 (cuối Hard Boundaries list, trước `---` separator)

**Thêm bullet mới sau dòng 45**:
```markdown
- **Fable-Thinking trước escalation** — khi escalation trigger bắn (theo
  `sdlc-escalation`), invoke `Skill("fable-thinking", "<decision-type>:
  <trigger>. Options: <list>. Goal: <end-state>.")` trước khi propose
  escalation cho human. Recommendation không auto-execute.
```

#### Edit 4: Pipeline Scope (Specs Pipeline, dòng 210-212)

**Vị trí**: Dòng 210-212 (HLD optional, LLD optional, CROSS-CUTTING optional)

**Thêm footnote sau dòng 212**:
```markdown
> **Fable-Thinking Guard**: Trước khi skip HLD, LLD, hoặc CROSS-CUTTING,
> invoke `Skill("fable-thinking", "Pipeline scope: <FR-ID>. Grilling:
> <findings>. Proposing to skip <phase>. Risk: <what could be missed>.
> Should this phase be kept?")`. Nếu recommendation = keep → giữ phase
> và hỏi human xác nhận.
```

---

## Phase 3: Automation Integration

### File: `.claude/skills/sdlc-automation/SKILL.md` (247 dòng)

#### Edit 1: Flow Detection (sau dòng 103)

**Vị trí**: Dòng 103 (sau keyword hint, trước `### Bước 3: Foundation Gate`)

**Thêm vào**:
```markdown
> **Fable-Thinking Guard**: Nếu flow selection ambiguous sau keyword hint
> (nhiều flow khớp, hoặc human input chứa tín hiệu conflicting), invoke
> `Skill("fable-thinking", "SDLC flow routing: user said '<input>'.
> Candidate flows: <list>. Which flow best serves the goal?")` trước
> khi hiển thị `AskUserQuestion`. Recommendation = default suggestion.
```

#### Edit 2: Grilling Exit (trong Hard Boundaries, sau dòng 47)

**Vị trí**: Dòng 47 (cuối Hard Boundaries section), thêm 1 bullet:
```markdown
- **Fable-Thinking trước dispatch** — sau grilling, trước khi dispatch
  workflow, nếu còn gaps không chắc chắn: invoke
  `Skill("fable-thinking", "Automation grilling complete: <findings>.
  Missing: <gaps>. Options: dispatch workflow, grill thêm 1 round, hoặc
  fallback orchestrator. Goal: <end-state>.")`. **Không** dispatch nếu
  fable-thinking recommendation = insufficient.
```

#### Edit 3: Bug Keyword Auto-Escalation (dòng 96-100)

**Vị trí**: Dòng 96-100 (keyword hint: "Nếu human input chứa 'bug'/'lỗi'/'fix' →
**tự động escalate**")

**Sửa keyword hint thành**:
```markdown
> **Keyword hint**: Nếu human input chứa "bug"/"lỗi"/"fix" →
> invoke `Skill("fable-thinking", "Bug keyword escalation: user said
> '<input>'. Does this genuinely need fixbug (root cause diagnosis +
> fix + verify), or is it a false positive (e.g., 'fix config', 'sửa
> typo')? Goal: correct flow routing.")`. Nếu recommendation = genuine
> bug → escalate sang orchestrator với `flow=fixbug`. Nếu false
> positive → route theo flow thực tế. Fixbug yêu cầu human diagnosis
> judgment — không thể autonomous.
```

#### Edit 4: Fail-Safe (dòng 138, Task Automation Flow)

**Vị trí**: Dòng 138 (`Gate fail → workflow tự retry...`)

**Thêm vào cuối paragraph**:
```markdown

  Nếu retry exhausted + gate vẫn fail: trước khi fallback orchestrator,
  invoke `Skill("fable-thinking", "Automation fail-safe: <phase> gate
  failed after <N> retries. Error: <details>. Options: fallback
  orchestrator, skip phase, or abort. Goal: <end-state>.")`.
```

---

## Detection Logic (cách skill nhận biết cần invoke)

### Ambiguity detection cho Flow Detection

Skill coi flow detection là **ambiguous** khi ít nhất 1 trong các điều kiện sau đúng:
1. Input khớp ≥2 flow với priority khác nhau VÀ flow thắng có priority thấp hơn nhưng keyword dài hơn
   - VD: "sửa nhanh API login lỗi 500" → vừa khớp "sửa nhanh" (quick, P=3.5) vừa khớp "lỗi"+"500" (fixbug, P=1)
2. Flow được match chứa keyword quick/trivial NHƯNG input có dấu hiệu non-trivial ("API", "schema", "migration", "auth", "billing", "500")
3. Input quá ngắn (<5 từ) VÀ không có keyword rõ ràng từ bất kỳ flow nào

### Ambiguity detection cho Grilling Exit (Automation)

Coi là ambiguous khi:
1. Còn ≥2 câu hỏi chưa được trả lời trong grilling checklist
2. Human trả lời "không chắc"/"có thể"/"để xem sau" cho bất kỳ câu hỏi load-bearing nào
3. Scope ngầm định từ human answers khác với flow đã chọn

---

## Verification

### Manual test cases

| # | Input | Expected |
|---|---|---|
| 1 | "sửa nhanh API login bị lỗi 500" qua orchestrator | Fable-thinking invoked → recommendation: fixbug, escalate khỏi quick |
| 2 | "triển khai code tính năng thanh toán" qua automation | Fable-thinking invoked tại flow detection → confirm cook |
| 3 | Grilling 2 rounds, còn 3 câu chưa trả lời, automation | Fable-thinking invoked tại grilling exit → recommendation: grill thêm |
| 4 | Foundation gate fail (thiếu user-context.md), flow=task | Fable-thinking invoked → recommendation: stop nếu flow cần user-context |
| 5 | Workflow fail sau 2 retry, gate fail SRS phase | Fable-thinking invoked → phân tích multi-hypothesis trước fallback |

### Self-check
- [ ] Rule file tồn tại và đúng conventions (50-90 dòng, không frontmatter, backtick refs)
- [ ] Orchestrator invoke points không phá vỡ flow hiện tại (chỉ thêm guard)
- [ ] Automation invoke points không thay đổi autonomous behavior (vẫn dispatch)
- [ ] Tất cả invoke đều pass context format: decision-type + facts + options + goal
- [ ] Fallback hoạt động nếu fable-thinking skill unavailable

### Findings từ exploration agents

**Automation (20 DPs, 10 HIGH):**
- DP-6 (Bug keyword auto-escalation): Automation dòng 96-100 tự động escalate
  khi thấy "bug"/"lỗi"/"fix" — **không có human confirmation**. Template hijack nguy hiểm nhất.
- Không có fable-thinking invocation nào tồn tại trong automation ecosystem.
- 2-attempt retry threshold áp dụng uniform cho mọi failure mode.

**Orchestrator (24 DPs, 9 HIGH, 7 MEDIUM, 8 LOW):**
- **DP-2 (CR Blast Radius)** và **DP-9 (Debug Hypothesis)** là 2 điểm cần
  FULL mode nhất — orchestrator là single point of failure, human chỉ confirm
  chứ không thể phát hiện errors of omission.
- DP-1 (Flow Detection keyword matching) được xác nhận là structurally fragile.
- 7/9 HIGH-RISK decisions chỉ dựa vào human confirmation, không có cơ chế
  self-verification cho orchestrator trước khi trình bày cho human.

**Phase 2 (future):** CR Blast Radius, Debug Hypothesis, GATE FAIL handling,
Breaking Change Classification, TDD Interference sẽ được tích hợp vào flow
reference files.

### File changes checklist
- [ ] `.claude/rules/sdlc-fable-thinking.md` — tạo mới (~75 dòng)
- [ ] `.claude/skills/sdlc-orchestrator/SKILL.md` — 4 edits:
  - Dòng 45: Hard Boundaries escalation bullet
  - Dòng 101: Flow Detection guard
  - Dòng 149: Foundation Gate fail procedure
  - Dòng 212: Pipeline Scope footnote (sau CROSS-CUTTING optional)
- [ ] `.claude/skills/sdlc-automation/SKILL.md` — 4 edits:
  - Dòng 44: Hard Boundaries grilling exit + fail-safe bullet
  - Dòng 96-100: Bug keyword auto-escalation → thêm fable-thinking verify
  - Dòng 103: Flow Detection guard
  - Dòng 138: Fail-safe fable-thinking invoke
