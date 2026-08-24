# SDLC Architect Rules

<EXTREMELY-IMPORTANT>
Map hoàn cảnh sử dụng của skill `architect` + agent `architect-specialist` trong SDLC.
Auto-trigger qua `sdlc-architect` khi kiến trúc hệ thống chưa có — chưa có là BẮT BUỘC
phải tạo, không có path bỏ qua. Luôn resolve dựa trên trạng thái live của
`agent_docs/` — không hardcode phán đoán dựa trên "cảm giác đã có kiến trúc".
</EXTREMELY-IMPORTANT>

## Phân Vai — 3 Thành Phần, 1 Trách Nhiệm Mỗi Cái

| Thành phần | Loại | Vai trò |
|-----------|------|---------|
| **sdlc-architect** | skill (gate) | Self-check `agent_docs/architecture.md`, route sang `architect` khi MISSING, verify sau khi xong |
| **architect** | skill (doer, `user-invocable: false`) | Trao đổi, hướng dẫn, cấu trúc kiến trúc — cùng human thảo luận để đạt kiến trúc mong muốn (hệ thống mới/khác, nâng cấp hiện tại, trao đổi thuần túy). Orchestrate design/review/advisory/discuss; input là **optional context**; plan mode = human gate. Không có gate agent riêng — architect-specialist tự self-check output theo Gate Criteria của nó. Chỉ Claude invoke qua `Skill()` — human không gõ trực tiếp. **KHÔNG liên quan sprint/sync** |
| **architect-specialist** | agent (executor, opus) | Thiết kế/review/advisory/discuss thực tế (cùng human thảo luận, input optional). CHỈ được spawn bởi architect skill, không bao giờ trực tiếp |

## Auto-Trigger — Khi Nào Dùng

### Trigger 1 (MANDATORY): Kiến trúc chưa có — forward/greenfield

```
sdlc-architect self-check: test -f agent_docs/architecture.md
MISSING → BẮT BUỘC tạo qua architect skill (workflow design)
```

- Chưa có `agent_docs/architecture.md` → KHÔNG có path "bỏ qua". Skill chỉ hoàn tất khi
  file tồn tại, hoặc báo BLOCKED đang chờ human approve trong architect plan mode.
- Chạy trước SRS trong forward pipeline (logical architecture quyết định trước FR
  decomposition), và trước mọi HLD physical.

### Trigger 2: User yêu cầu review kiến trúc

Kiến trúc đã tồn tại (agent_docs/architecture.md có) + user muốn đánh giá/brownfield
assessment → `architect` workflow `review`. Output vào `agent_docs/architecture-reviews/`.

### Trigger 3: User hỏi quyết định / trade-off kiến trúc

Câu hỏi kiến trúc cụ thể (chọn DB, monolith vs microservice, auth model...) → `architect`
workflow `advisory`. Output vào `agent_docs/architecture-reviews/advisory-*.md`.

### Trigger 4: User muốn trao đổi / hướng dẫn kiến trúc (trao đổi thuần túy)

User muốn thảo luận kiến trúc — hệ thống khác, ý tưởng, nâng cấp, hoặc chưa rõ cần gì →
`architect` workflow `discuss` (trao đổi thuần túy, không bắt buộc viết file). Input là
optional context. Output file CHỈ khi human yêu cầu và có outcome cần ghi (agent_docs/).

## Boundaries — Khi Nào KHÔNG Dùng

<EXTREMELY-IMPORTANT>
Bất kỳ tình huống nào dưới đây → KHÔNG gọi architect skill. Gọi sai = duplicate work
hoặc vi phạm service boundary.
</EXTREMELY-IMPORTANT>

| Tình huống | Lý do | Xử lý đúng |
|-----------|-------|-----------|
| **Reverse pipeline** | Kiến trúc extract từ code qua `codebase-*` pipeline (scout → codebase-hld → ...) | Đi đường reverse; architect skill chỉ dùng nếu user yêu cầu review riêng |
| **Đã có `agent_docs/architecture.md`** | Double-invoke — kiến trúc đã tồn tại | sdlc-architect skip, báo "đã tồn tại". Không gọi architect lại |
| **Post-SRS, cần HLD physical** | sdlc-hld là phase agent chính thức cho HLD vào agent_docs/ sau SRS | Đi qua sdlc-hld. Architect design mode CHỈ là PRE-SRS (logical architecture). sdlc-hld **REFINE** pre-SRS architecture (giữ quyết định logical, bổ sung chi tiết physical từ FR) — không recreate |
| **CR / quick flow** | Change bounded; không được mở rộng scope sang architecture | Chỉ gọi architect nếu user yêu cầu hoặc change chạm service boundary |
| **TDD cycle (cook)** | Cook thực thi specs có sẵn — không tạo quyết định kiến trúc | Nếu thiếu architecture → escalate orchestrator, không tự gọi architect |

## Hoàn Cảnh Sử Dụng Đúng — Flow Quyết Định

```
Input user / trạng thái agent_docs
  ├─ Forward/greenfield, chưa có architecture.md → sdlc-architect → architect design (MANDATORY)
  ├─ Reverse pipeline                       → codebase-* pipeline (KHÔNG architect)
  ├─ SRS đã chạy, architecture.md đã có      → sdlc-hld REFINE pre-SRS architecture (physical detail từ FR), sdlc-architect skip
  ├─ User yêu cầu review kiến trúc           → architect review (vào agent_docs/architecture-reviews/)
  ├─ User hỏi trade-off/quyết định kiến trúc → architect advisory (vào agent_docs/architecture-reviews/)
  └─ User muốn trao đổi/hướng dẫn kiến trúc  → architect discuss (trao đổi thuần túy, không bắt buộc file)
```

## Hard Rules — Khi Gọi Architect Skill

1. **Plan mode = human gate** — invoke KHÔNG `--auto` từ sdlc-architect. Human là
   validator, không phải tác giả; approve trước khi architect-specialist viết.
2. **Agent_docs direction** — input là **optional context** (`agent_docs/project-overview.md`
   pre-SRS, `agent_docs/features/*/FR-*.md` post-SRS, `user-context.md`...) — đọc nếu có,
   thiếu thì thảo luận với human. Output CHỈ vào agent_docs/: `architecture.md`,
   `adrs/ADR-{NNN}--{slug}.md`, `domain-service-mapping.yaml`, `hard-boundaries.md`,
   `contracts/` — và chỉ khi human approve/muốn (trao đổi thuần túy không cần file).
   KHÔNG viết `docs/` — human docs xử lý riêng qua human-docs pipeline. **KHÔNG làm
   sprint/sync** — sprint artifacts thuộc controller.
3. **Luôn qua architect skill** — không spawn architect-specialist trực tiếp, không tự
   thiết kế inline ở controller.
4. **Minimum 3 ADRs** (Service Decomposition, API Conventions, Event Taxonomy) + C4 L1+L2
   inline Mermaid trong architecture.md.
5. **Verify sau khi xong** — sdlc-architect Bước 3 re-check `test -f
   agent_docs/architecture.md`; MISSING → BLOCKED, không coi là hoàn tất.

## Anti-Patterns — Chống Pattern-Match

| Instinct | Rule check |
|----------|-----------|
| "Chưa có kiến trúc nhưng để sau" | Rule: bắt buộc tạo — không có path bỏ qua |
| "Gọi architect-specialist trực tiếp cho nhanh" | Phải qua architect skill (plan mode + gate verify) |
| "Đã có architecture.md, chạy lại design cho chắc" | Double-invoke — skip, sdlc-hld lo post-SRS |
| "Architect design sau SRS cũng được" | Architect design = PRE-SRS logical; post-SRS physical là sdlc-hld |
| "Tự viết kiến trúc luôn cho tiết kiệm" | Controller không tự thiết kế — luôn qua skill |
| "Output vào docs/ cho human dễ đọc" | Agent_docs/ là SSOT; docs/ qua human-docs pipeline |
| "Bỏ plan mode, --auto cho nhanh" | Human là validator — giữ plan mode |

## Tương Tác Với Rule Khác

- **sdlc-routing-rules.md** — intent "tạo kiến trúc hệ thống trước SRS" resolve về
  sdlc-architect skill (xem bảng Intent → Flow).
- **sdlc-pipeline-rules.md** — architect design chạy TRƯỚC SRS (logical), sdlc-hld chạy
  SAU SRS (physical). Không overlap: architect pre-SRS, hld post-SRS.
- **sdlc-orchestration-rules.md** — architect skill là controller orchestrate
  architect-specialist; controller cấp cao (orchestrator) không tự viết architecture.
- **sdlc-output-rules.md** — file artifact trong agent_docs/ thuộc Tầng 1+2; report về
  human thuộc Tầng 3.
