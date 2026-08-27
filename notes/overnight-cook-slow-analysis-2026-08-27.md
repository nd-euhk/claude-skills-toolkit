# Overnight Cook Analysis — hotel-core-workspace (2026-08-26 → 08-27)

> Report phân tích tại sao session cook-overnight tối 26/08 chậm/không xong.
> Lưu 2026-08-27 để chuẩn bị compact. Lỗi workflow `scripts is not defined`
> đang được session khác xử lý — report này không đi sâu vào bug, chỉ ghi nhận
> ảnh hưởng của nó đến độ trễ.

## Session liên quan

| Session | Vai trò | Thời gian |
|---------|---------|-----------|
| `72e4e2e5-c9a8-4a08-bf1d-8595cf7d5886` | **Cook-overnight executor** (session chính) | 21:26 (26/08) → 10:28 (27/08), span 13h |
| `63933d40-6914-43f5-b92d-304a9fbd22d1` | Monitor/coordinator (hỏi trạng thái qua cross-session) | 23:08 (26/08) → 06:17 (27/08) |
| `51a178d3-...` / `6f603d2b-...` | Session trước (v5 spec discussion) → khởi động cook | kết thúc 21:23 → 21:26 |
| session `-9f` | Gửi chỉ đạo user (checkout FR-014 từ FR-013; cảnh báo FEAT-002) | 00:47 (27/08) |
| session xử lý bug workflow | Được user xác nhận đang xử lý `scripts is not defined` | — |

## Scope overnight batch

- Skill: `sdlc-cook-overnight` (version 1.3.0), args `"FR của search api"`.
- Chiến lược: **Sequential** (user confirm qua AskUserQuestion).
- 7 feature cookable: FR-DISCOVERY-013..020 (trừ 017 thiếu dependency) — đều thuộc `hotel-search-api` (Java/Spring Boot, Maven).
- Model workflow: `deepseek-v4-flash`.

## Timeline (giờ local, UTC+7)

| Thời gian | Sự kiện | Evidence |
|---|---|---|
| 21:26 | `/sdlc-cook-overnight "FR của search api"` (sau 1 lần interrupt) | session first-entry |
| 21:29–21:30 | FR-013 setup: baseline Maven + board → 🚧 In Progress | queue-op `Maven baseline FR-013`; subagent `sdlc-sprint-board` |
| ~21:45–23:13 | FR-013 workflow run đầu: 22 RED TDD cycles (~1h+), rồi hit bug `scripts is not defined` ở GATE-light | 5 workflow repro/bisect 23:26–23:32; cross-session hỏi trạng thái 23:13 |
| 23:26–23:37 | Root-cause bug + workaround `/tmp/workflow-sdlc-cook-fixed.js` | `gate-repro2`, `gate-bisect` workflows |
| 23:37–00:37 | FR-013 resume (RED replay từ cache): GATE-light + REFACTOR-full + GATE-full → **PASS** (60 phút) | wf `startTime`; GATE-full 10/10 PASS |
| 00:37–00:47 | FR-013 commit `a27edcf` + push + board → 👀 In Review; FR-014 setup (checkout từ FR-013 theo chỉ đạo session `9f`) | board.md changelog 1.2/1.3 |
| 00:47–03:22 | FR-014 workflow: **26 RED TDD cycles** (2.45M tokens) → **RED #26 hit budget $30** | wf `workflowProgress` |
| 03:22–04:07 | **10 agents fail `429 · Budget has been exceeded! Current cost: 30.00059292000001, Max budget: 30.0`**, mỗi cái chờ ~3 phút (179–192s) retry timeout | wf errors (RED 27–30, GATE-light, 2 fix, 2 retry) |
| 04:07–09:59 | Batch im lặng — không có gì chạy | session gap |
| 09:59 | User gõ `continue` → session resume | session |

**Kết quả qua đêm:** FR-013 → PR-ready (branch `feature/FR-DISCOVERY-013-hotel-search-api`, board 👀 In Review). FR-014 → 🚧 In Progress (dở dang). FR-015..020 → chưa được chạm (board.md).

## Token / thời gian per workflow

| Workflow | Feature | Duration | Agents | Tokens | Tool calls | Kết quả |
|---|---|---|---|---|---|---|
| `wf_c60619c9-396` | FR-013 | 60.4 phút | 33 | 1,190,091 | 562 | GATE light+full PASS |
| `wf_139d6d62-11d` | FR-014 | 188.3 phút | 35 | 2,454,929 | 924 | Chết vì budget (26 RED xong, còn lại 429) |

Tổng: ~3.64M tokens cho 1.5 feature.

## Nguyên nhân "chậm" — xếp theo mức ảnh hưởng

### 1. Hết budget $30 → batch chết, không phải chậm (lớn nhất)
- OBSERVED: `429 · Budget has been exceeded! Current cost: 30.00059292000001, Max budget: 30.0` — lặp ở 10 agents cuối FR-014.
- Mỗi feature ngốn 1.2–2.5M tokens; budget cạn giữa feature thứ 2.
- **~30 phút lãng phí**: sau khi cạn budget, workflow vẫn dispatch 10 agents; mỗi agent 429 ngay lập tức nhưng chờ 179–192s retry timeout mới fail. Workflow không detect budget-exhaustion để fail-fast.

### 2. Bug workflow `scripts is not defined` (L298 `workflow-sdlc-cook.js`) chặn FR-013
- Chặn đúng lúc FR-013 vừa xong 22 RED cycles → mất ~25 phút root-cause + workaround (workflows `gate-repro2`/`gate-bisect` 23:26–23:32 để truy tìm bug).
- Session khác đang xử lý — ghi nhận ảnh hưởng, không đào sâu.

### 3. Chiến lược Sequential + full TDD per feature
- 7 features nối tiếp, mỗi feature 1 full TDD cycle. FR-013 = 33 agents; FR-014 = 26 RED + GATE agents.
- Mỗi RED agent là mini-orchestrator (spawn GREEN + REFACTOR-light + chạy `./mvnw test`) → 2–16 phút, 44–159k tokens mỗi cái.
- Agent 749KB điển hình: 21 Read, 18 Bash — đọc nhiều file + chạy Maven test liên tục.

### 4. GATE fix loops tốn kém
- FR-013 GATE-full fail → 4 fix agents: `V5PilotGate.java` retry = **20.2 phút / 217,880 tokens** (outlier); `SecurityContext.java` 6.4 phút; `application.yml` 7.5 phút; `V5BaseResponse.java` 4.7 phút.

### 5. Outlier agents dài
- FR-014 RED #8 = 16 phút / 124k tokens; RED #9 = 12.4 phút / 159k; RED #18 = 11.7 phút / 136k — các vòng compile/test-fix lặp.

## Khuyến nghị

1. **Nâng/gỡ budget cho overnight run** — budget $30 là nút thắt chết người. Đặt budget theo ước lượng tokens, không phải con số cố định thấp.
2. **Fail-fast khi 429 budget** — workflow detect `budget has been exceeded` → dừng ngay, không retry (tiết kiệm ~30 phút/feature dở dang).
3. **Giảm token burn per agent** — agents đọc rất nhiều file + chạy Maven test lặp; cân nhắc giới hạn reference material trong prompt RED/GATE agents.
4. **Sau khi fix bug L298**: re-run FR-014..020 (FR-014 resume được — 26 RED cycles đã chạy).

---

## Bổ sung 2026-08-27: Có nên chuyển sang phased-batch (RED batch → GREEN chunk → REFACTOR 1 lượt)?

> Câu hỏi của user sau compact: "TDD chạy như vậy đang đúng chuẩn rồi, nhưng quá chậm. 22 TCs thôi.
> Có nên chuyển sang chạy hết red → hết green → refactor 1 lượt?"
> Nguồn ground: đọc trực tiếp `toolkit/.claude/workflows/cook/workflow-sdlc-cook.js`.

### Verdict

**Có — nhưng không phải "1 lượt" theo nghĩa đen (1 agent cho cả phase).** Chuyển sang **phased-batch**:
RED batch (viết hết test) → GREEN theo **chunk 3-5 TC** → REFACTOR + GATE 1 lượt.
Ước tính giảm ~60-75% wall-clock và ~70-80% token per-feature (DERIVED — chưa benchmark batch thật).

### Cơ chế — tại sao per-TC chậm (OBSERVED từ workflow script)

- **RED agent hiện tại là mini-orchestrator, không phải "viết 1 test".** Prompt RED (dòng 174, 197-237)
  làm 5 việc mỗi TC: viết test → chạy verify RED → **spawn GREEN** (chạy test verify pass) →
  chạy INTERFERENCE-LIGHT (run cả file) → **spawn REFACTOR-light** (chạy test lại).
- Mỗi TC = **3 agent spawns + 4-5 test runs**. 22 TC → ~90 agent spawns (22 RED top-level +
  44 nested GREEN/REFACTOR-light; "33 agents" trong report chỉ đếm top-level) + ~90-110 test runs,
  và suite *lớn dần* theo TC → chi phí cộng dồn ~O(TC²).
- Workflow chạy **tuần tự cố định** (dòng 552-554); comment ghi rõ `parallelTCs` đã bị bỏ vì
  "không có human verify TCs thực sự độc lập" — quyết định thiết kế từ trước.

### Phased-batch sẽ thành gì

| | Per-TC (hiện tại) | Phased-batch (đề xuất) |
|---|---|---|
| RED | 22 agent, mỗi cái orchestrate + 1 run | 1-2 agent viết hết test, **1 run** detect RED + accidental-green + same-file interference |
| GREEN | 22 agent nested | 4-6 agent, mỗi chunk 3-5 TC, 1-2 run/chunk |
| REFACTOR-light | 22 agent nested | bỏ — gom vào REFACTOR-full |
| REFACTOR + GATE | full + light/full | giữ nguyên |
| **Test runs** | ~90-110 | ~15 |
| **Agent spawns** | ~90 | ~10 |

**Interference coverage giữ nguyên:** same-file → batch RED run; cross-file → GATE-light
INTERFERENCE-FULL. Chỉ detect trễ hơn, không mất.

### "Đúng chuẩn" không?

- **Red→green→refactor invariant giữ nguyên** — chỉ đổi granularity (per-test → per-chunk).
  Batch TDD là variant hợp lệ.
- Nhưng `sdlc-pipeline-rules.md` §TDD Cycle **định nghĩa chuẩn = per-TC** → đây là **thay đổi
  chuẩn có chủ đích** (update rules + workflow + prompts + gate timing), không phải fix bug.
- Điểm mất: feedback granularity. Nhưng overnight unattended không có human can thiệp giữa đêm
  → granularity đó phần lớn bị lãng phí. Trade nghiêng về batch.

### Rủi ro / precondition

1. **Batch RED cần TCs spec-independent** — test TC sau compile được *chưa cần* impl TC trước.
   Pipeline spec-first (IMP+TST đầy đủ, API đã định) → thường đúng. TC chain thật → fallback
   per-TC subset (ASSUMED).
2. **Batch GREEN phải chunk** — 1 agent cầm 22 TC impl = context blowout + mất attribution.
3. **Accidental-green handling coarser** — 1 run detect hết, nhưng protocol explore/sabotage
   từng cái tốn hơn.

### Quick wins bổ sung (độc lập với batching)

- **Targeted Maven** (`-Dtest=ClassName#method`) cho RED/GREEN confirm — cắt run cost ngay khi giữ per-TC.
- **Budget fail-fast** (mục 2 ở trên) — dừng khi gặp `429 budget`, không retry ~30 phút.
- **Parallel across features** — skill đã có `Parallel` strategy (Type-2 disjoint services); giai đoạn 2.

### What changes in code

`workflow-sdlc-cook.js` (loop → 3 phase), RED prompt (bỏ mini-orchestrator role), GREEN prompt
(chunk context), `sdlc-pipeline-rules.md` §TDD Cycle, `sdlc-cook`/`sdlc-cook-overnight` docs
+ bump skill + plugin version (rule CLAUDE.md).

### Weakest link (DERIVED/ASSUMED)

- Con số 60-75% / 70-80% là DERIVED — chưa có benchmark batch thật.
- TC-independence là ASSUMED dựa trên spec-first pipeline.
- **Settle:** pilot 1 feature (FR-015..020) với bản batch trên worktree, so wall-clock + token
  với FR-013/014.

## Weakest link (DERIVED, chưa verify 100%)

- Phần "21:45–23:13 = run đầu FR-013 chạy 22 RED cycles": suy diễn từ (a) bug xảy ra ở GATE-light (22 RED đã xong), (b) cross-session hỏi trạng thái 23:13 — chưa đọc trực tiếp journal run đầu (đã bị resume/ghi đè).
- Phần còn lại (budget 429, agent timelines, token counts, board state) là OBSERVED trực tiếp từ workflow state files + board.md.
- Không chắc chắn $30 là session-level hay per-workflow; error message "Current cost" tích lũy cho thấy khả năng cao là session-level/cumulative.

## Nguồn dữ liệu

- Session files: `~/.claude/projects/-home-khuend-projects-vnpay-hotel-hotel-core-workspace/*.jsonl`
- Workflow state: `.../72e4e2e5-.../workflows/wf_*.json` + `.../subagents/workflows/wf_*/`
- Board: `/home/khuend/projects/vnpay/hotel/hotel-core-workspace/.work/board.md`
- Không có telemetry `.logs/` (sdlc-monitor script không chạy được — phân tích trực tiếp từ transcripts)
