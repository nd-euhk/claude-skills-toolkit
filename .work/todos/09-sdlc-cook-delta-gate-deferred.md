---
date: 2026-09-04
status: open
tags: [sdlc-cook, sdlc-cook-overnight, tdd, delta-gate, pre-existing-red]
---

# Todo — Delta-gate (tolerated pre-existing red TCs): phần chưa xử lý

Context: patch delta-gate cho cook-overnight — loại bỏ "exit code 0" làm tín hiệu clean khi
baseline có pre-existing red TCs (TC đã đỏ trước khi cook). Đã xử lý: baseline.py (exit-code +
incomplete + compare 3-field), per-feature-cook.md, RED/GREEN-overnight delta-aware, GATE L1
delta-gate trong workflow prompt, report carry-forward `preExistingFailures`. Các mục dưới đây là
phần CÒN LẠI, chưa nằm trong patch này.

---

## D-01: REFACTOR-overnight vẫn exit-code-blind (`testSuiteStillPassing`)

- **Status:** ✅ Done (2026-09-04)
- **Files:** `agents/sdlc/sdlc-tdd-be-refactor-overnight.md`, `sdlc-tdd-fe-refactor-overnight.md`,
  `workflows/cook/workflow-sdlc-cook-overnight.js` (`refactorAgentPrompt`)
- **Vấn đề (đã fix):** `testSuiteStillPassing` = "full test suite passes sau mọi change" → dùng exit
  code làm tín hiệu. Với pre-existing red, suite KHÔNG bao giờ exit 0 ⇒ refactor agent báo
  `testSuiteStillPassing: false` SAI ⇒ workflow push warning giả "REFACTOR full may have caused test failures".
- **Đã làm:** `testSuiteStillPassing` giờ = "no NEW failures vs pre-existing set". Inject
  `preExistingFailures` vào refactor prompt + đổi wording "Introduce NO NEW failures" ở intro / Two
  Tasks / Rules / Critical Rule. Judge bằng PARSE OUTPUT, không exit code.

## D-02: Standalone sdlc-cook (per-TC) chưa delta-aware

- **Status:** 🔲 Todo
- **Files:** base agents `sdlc-tdd-be/fe-red|green|gate.md` (non-overnight) + `sdlc-cook/references/tdd-orchestration.md` + `merge-manager.md`
- **Vấn đề:** patch này chỉ cover phased-batch overnight. Per-TC sdlc-cook vẫn dùng exit-code-as-clean
  cho RED/GREEN/INTERFERENCE-LIGHT/GATE-light, không tolerate pre-existing red. Khác biệt: per-TC có
  sabotage×3 confirmation (RED) nên trade-off khác — áp cùng tolerated-red cần cân nhắc riêng.
- **Fix đề xuất:** áp tolerated-red + delta-gate tương tự, nhưng giữ sabotage confirmation ở RED.

## D-03: `preExistingStillFailing` không được trả structured từ GATE

- **Status:** ✅ Done (2026-09-04)
- **Files:** `workflows/cook/workflow-sdlc-cook-overnight.js` (GATE_RESULT + COOK_REPORT schema,
  gateAgentPrompt L1/full, deltaBucketsFrom, report), `agents/sdlc/sdlc-tdd-be/fe-gate-overnight.md`,
  `scripts/persist-cook-report.py`, `references/morning-report.md`
- **Vấn đề (đã fix):** gate agent chạy `baseline compare --json` (3-field) nhưng chỉ trả `summary`
  string. Workflow carry-forward `preExistingFailures` = **full baseline list**, không precise
  "still failing sau cook". Morning report không phân biệt "vẫn đỏ" vs "vô tình được fix".
- **Đã làm:** `GATE_RESULT` + `COOK_REPORT` mang thêm `interference[]` / `preExistingStillFailing[]`
  / `notInBaselineNowFailing[]` (object verbatim từ compare `--json`, schema `DELTA_BUCKET_ITEM`);
  gateAgentPrompt L1 + full-mode hướng dẫn trả 3 array verbatim; `deltaBucketsFrom(gateLight,
  gateFull)` forward vào report; log phân biệt "still red / accidentally fixed"; persist validate
  type; morning-report phân loại chính xác (vẫn đỏ → ticket; vô tình fix → bonus).

## D-04: Flaky test gây false-positive ở `notInBaselineNowFailing`

- **Status:** ✅ Done (2026-09-04)
- **Files:** `workflows/cook/workflow-sdlc-cook-overnight.js` (GATE_RESULT + COOK_REPORT schema,
  gateAgentPrompt L1 retry-before-fail, deltaBucketsFrom, report), `agents/sdlc/sdlc-tdd-be/fe-gate-overnight.md`,
  `scripts/persist-cook-report.py`, `references/morning-report.md`
- **Vấn đề (đã fix):** `notInBaselineNowFailing` (no baseline + current fail) → L1 FAIL cứng. Test
  fail có thể **flaky** (không regression). `interference` (baseline pass → fail) cùng cơ chế flaky.
- **Nhận định (2 nguồn của `notInBaselineNowFailing`):** (1) test TC DONE đã GREEN nhưng flaky fail ở
  GATE; (2) test TC ERROR chưa xanh (GREEN thất bại — `failedCount > 0` check ở line ~799 chỉ log
  "proceeding", không return, nên pipeline VẪN tới GATE light). Retry-before-fail áp dụng ĐỀU cho cả 2
  nguồn là đủ — không cần phân biệt TC DONE/ERROR tường minh: re-run pass = test đã xanh (bất kể nguồn)
  → loại khỏi fail; re-run vẫn fail = fail thật → giữ.
- **Đã làm:** retry-before-fail targeted (re-run riêng từng test fail 1 lần) cho cả `interference` +
  `notInBaselineNowFailing`; pass → chuyển sang bucket mới `flaky[]` (tolerated, KHÔNG fail L1, report
  cho human); vẫn fail → giữ nguyên bucket. `flaky[]` forward vào COOK_REPORT + morning-report.

---

## Đã xử lý trong patch (tham chiếu — không phải todo)

- baseline.py **+ baseline.js** (cả 2 path — wrapper ưu tiên node): `--exit-code` + `incomplete`
  flag (capture), compare `--json` 3-field (`interference` / `preExistingStillFailing` /
  `notInBaselineNowFailing`), compare junit-xml qua `--test-output-dir`.
- per-feature-cook.md: hứng exit code, chặn HARD-FAIL (incomplete) → skip feature.
- RED/GREEN-overnight (BE+FE): confirm bằng parse-output, không exit code.
- GATE L1 (workflow prompt): delta-gate — PASS iff `interference[]` empty AND `notInBaselineNowFailing[]` empty.
- Report: `preExistingFailures` carry-forward vào COOK_REPORT + morning-report.md surface.
