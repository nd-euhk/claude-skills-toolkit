---
title: "Frontend Test Spec: FR-{{DOMAIN}}-{{NNN}}--{{slug}}-test"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: {{author}}
depends_on:
  - ../../features/FR-{{DOMAIN}}-{{NNN}}--{{slug}}.md
  - ../../contracts/api-{{domain}}.yaml
  - ../../contracts/error-codes.md
  - ../api-routing.md
  - ../../../docs/ux/interactions/{{flow-name}}.md
referenced_by: []
changelog:
  - 1.0 | {{date}} | Initial frontend test spec (tách khỏi test-spec-TEMPLATE.md)
---

<!--
HARD RULES (xem SPEC-BOUNDARIES.md):

  1. Test spec mô tả BEHAVIOR UI/UX cần verify, KHÔNG cài đặt test.
     Render setup, MSW handler body, Playwright fixture — thuộc source code.
  2. Context Isolation: test spec KHÔNG đọc impl spec. Behavior bắt nguồn từ
     FR / API contract / interaction contract, không từ "component nào xử lý".
  3. Snippet ≤5 dòng, chỉ khi minh hoạ assertion selector hoặc role query.
     Gắn nhãn "illustrative".
  4. Error assertion theo error code từ OpenAPI (flat `code`), không test
     chuỗi message cụ thể (message có thể i18n).
  5. Template này dành cho FRONTEND (Vitest / RTL / Playwright / MSW).
     Cho BE dùng test-spec-backend-TEMPLATE.md.
-->

# Frontend Test Specification: FR-{{DOMAIN}}-{{NNN}}--{{slug}}-test

**FR**: FR-{{DOMAIN}}-{{NNN}}
**App**: app-{{name}}
**Page**: /{{route-path}}
**Layer**: FE (xem `layer` field trong FR frontmatter)
**Interaction Contract**: `docs/ux/interactions/{{flow-name}}.md`

> ⚠️ **Context Isolation**: Tests verify BEHAVIOR UI từ FR + interaction contract + API contract. KHÔNG đọc impl spec khi viết test.

---

## 1. Test Layer Ownership

| Layer | Framework expectation | What it verifies | What it should NOT test |
|---|---|---|---|
| Component — unit | Vitest + React Testing Library | Render, props, state transitions, event handlers | Network, routing, full page |
| Hook — unit | Vitest + `renderHook` | State management, side effects, API call orchestration | UI layer |
| Integration (component tree) | Vitest + RTL + MSW | Form → API → success/error UI, multi-component flow | Real backend, browser-only APIs |
| E2E — critical flow | Playwright | Happy path + auth + error recovery qua browser thật | Edge case UI (để unit/integration) |
| Visual regression (optional) | Playwright snapshots | Layout không đổi ngoài dự tính | Business logic |
| A11y smoke | `@axe-core/playwright` | WCAG violations (keyboard, ARIA, contrast) | Semantic correctness chi tiết |

---

## 2. Behavior Matrix — {{Component}} (Component Unit)

> Vitest + RTL. Dùng `getByRole`/`getByLabelText`; tránh `getByTestId` trừ khi bắt buộc.

| # | Scenario | Given (props/state) | When (user action) | Then (assertion) | Ref |
|---|---|---|---|---|---|
| 1 | Render default | Default props | (chỉ render) | Visible: heading, primary CTA | FR §{{n}} |
| 2 | Loading state | `isLoading=true` | (chỉ render) | Skeleton/spinner hiện, CTA disabled | interaction §loading |
| 3 | Empty state | `data=[]` | (chỉ render) | Empty illustration + CTA "{{create}}" | design-system §empty |
| 4 | Form validation fail | Valid props | User submit với field sai | Field error message, focus field sai, không call API | FR §validation |
| 5 | Form validation pass | Valid props | User submit hợp lệ | API called với payload đúng contract | api-routing §{{page}} |
| 6 | Keyboard interaction | Valid props | Tab → Enter trên CTA | CTA trigger submit handler | a11y §7 |
| 7 | Optional props | Variant props | (chỉ render) | Render đúng variant (size/color) | component spec |

**Mocking policy**: mock API client hook (nếu có) hoặc dùng MSW ở tầng integration (§4). Không mock React itself.

---

## 3. Behavior Matrix — use{{Feature}} (Hook Unit)

> Chỉ liệt kê nếu feature có custom hook. Nếu không → xoá section này.

| # | Scenario | Given | When | Then |
|---|---|---|---|---|
| 1 | Initial state | Fresh mount | — | `isLoading=false, data=null, error=null` |
| 2 | Fetch success | MSW returns 200 | Call `refetch()` | `isLoading` flow true→false, `data` match response |
| 3 | Fetch 4xx | MSW returns 400 body từ error-codes | Call `refetch()` | `error.code` match expected |
| 4 | Fetch network error | MSW `network.error()` | Call `refetch()` | `error` set, retry-able flag true |
| 5 | Optimistic update (nếu có) | Data đã load | Mutate → MSW delay 500ms | UI update ngay, rollback nếu 4xx |
| 6 | Cleanup | Unmount giữa fetch | Unmount | Không memory leak, không state update sau unmount |

---

## 4. Integration (Component Tree + MSW)

> Vitest + RTL + MSW. Render page/feature-level component với MSW intercept network.

| # | Scenario | MSW stub | User flow | Assertion |
|---|---|---|---|---|
| 1 | Happy path submit | `POST {{endpoint}}` → 201 + body | Fill form → submit | Success toast/redirect, form reset hoặc navigate |
| 2 | Validation error 400 | → 400 `code=VALIDATION_ERROR`, `details.errors[]` | Submit invalid | Inline field error theo `details.errors[].field`, form retained |
| 3 | Business error 4xx | → 422 `code={{DOMAIN}}_{{RULE}}` | Submit | Inline banner với message từ i18n key map từ `code` |
| 4 | Auth 401 | → 401 `code=TOKEN_EXPIRED` | Submit | Silent refresh triggered → retry; fail 2 lần → redirect `/login` |
| 5 | Forbidden 403 | → 403 `code=ACCESS_DENIED` | Submit | Full-page forbidden view hoặc disabled CTA |
| 6 | Server 5xx | → 500 | Submit | Retry UI visible, click retry → refire request |
| 7 | Network failure | MSW `network.error()` | Submit | Error boundary fallback hoặc retry UI |
| 8 | Cache invalidation | 2 mutation liên tiếp | Mutate → refetch | List/detail query re-fetch đúng cache tags |

**Error mapping**: assertion dùng `code` từ `contracts/error-codes.md`, **KHÔNG** test chuỗi message tiếng Việt cụ thể (message thuộc i18n, có thể đổi).

---

## 5. E2E — Critical Flow (Playwright)

> Chỉ critical happy path + 1-2 error recovery. Edge case để §2/§4.

| # | Scenario | Steps | Assertion |
|---|---|---|---|
| 1 | Happy path full flow | Login → navigate → fill form → submit → verify success state | URL đúng, success indicator visible, data persisted (verify qua API GET) |
| 2 | Auth expired mid-flow | Login → wait token expire → submit action | Silent refresh → action complete, user không bị logout |
| 3 | Network resilience | Happy path với `route.abort()` lần đầu | Retry UI → user click retry → thành công |
| 4 | Multi-tab (nếu applicable) | 2 tabs cùng session → action tab A → verify tab B | State sync qua storage event hoặc polling |

**E2E scope**: chỉ flow mà unit/integration không cover được (browser navigation, real auth, cross-tab). KHÔNG dùng E2E để test validation/empty state.

---

## 6. Accessibility Tests

| # | Check | Tool | Expected |
|---|---|---|---|
| 1 | Axe violations | `@axe-core/playwright` hoặc `jest-axe` | 0 WCAG A/AA violations ở trạng thái default + loading + error |
| 2 | Keyboard navigation | Manual/Playwright | Tab order hợp lý, Enter submit, Escape đóng modal |
| 3 | Focus management | Playwright | Focus về vị trí đúng sau open modal / submit / error |
| 4 | Screen reader landmarks | `getByRole('main')`, `getByRole('navigation')` | Có landmarks, không role duplication |
| 5 | ARIA live region | Assertion toast/error có `role="status"` hoặc `aria-live` | Announce được cho SR |

---

## 7. Visual Regression (optional)

Chỉ enable khi feature có UI phức tạp (chart, complex layout). Mặc định skip.

| # | Scenario | Viewport | Snapshot name |
|---|---|---|---|
| 1 | Default state | Desktop 1280×800 | `{{feature}}-default-desktop.png` |
| 2 | Mobile responsive | Mobile 375×667 | `{{feature}}-default-mobile.png` |
| 3 | Dark mode (nếu có) | Desktop + dark | `{{feature}}-dark-desktop.png` |

Tolerance: 0.1% pixel diff. Threshold cao hơn → drift khó phát hiện.

---

## 8. Performance (khi có NFR-PERF)

| Metric | Tool | Threshold | Scenario |
|---|---|---|---|
| LCP | Playwright + web-vitals | < {{2.5}}s | Page load trên slow 3G profile |
| INP | Playwright | < {{200}}ms | After primary interaction |
| Bundle size (page chunk) | `next build` output | < {{X}}KB gzipped | CI check |

---

## 9. Acceptance — Test Done khi

- [ ] Mọi row ở §2–§4 có test tương ứng PASS.
- [ ] E2E §5 row 1 (happy path) PASS trên Playwright.
- [ ] A11y §6 row 1 (axe) 0 violations.
- [ ] Error assertion dùng `code` từ OpenAPI, **không** test chuỗi message i18n.
- [ ] Không mock React/framework internals.
- [ ] Không `getByTestId` trừ khi semantic query không khả dụng (comment lý do).
- [ ] Coverage theo policy project — không ép 100%.
