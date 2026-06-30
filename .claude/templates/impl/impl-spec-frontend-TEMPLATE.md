---
title: "Frontend Implementation Spec: FR-{{DOMAIN}}-{{NNN}}--{{slug}}-impl"
status: draft
created: { { date } }
last_updated: { { date } }
updated_by: { { author } }

# ── SCOPE — Boundary enforcement (H-32) ──────────────────
# Inherit mặc định từ FR's scope.allowed_paths. Override khi impl touch paths
# ngoài FR declared (với rationale). Consumer: blast-radius.sh.
scope:
  allowed_paths: [] # Glob patterns — default inherit từ FR
  forbidden_paths: []
  rationale: ""

depends_on:
  - ../../features/FR-{{DOMAIN}}-{{NNN}}--{{slug}}.md
  - ../api-routing.md
  - ../../../docs/ux/wireframes/{{wireframe-slug}}.md # Phase 4 wireframe spec — normative
  - ../../../docs/ux/interactions/{{flow-name}}.md
  - ../../ownership/ownership-map.yaml
# IMPORTANT: cũng phải update wireframe `referenced_by:` để add path file này
# (bidirectional trace giữa Phase 4 ↔ Phase 8). Validator: check-traceability.sh.
referenced_by: []
changelog:
  - 1.0 | {{date}} | Initial frontend impl spec
---

<!--
HARD RULES cho file này (xem SPEC-BOUNDARIES.md để hiểu vì sao):

  1. KHÔNG paste compile-ready code. Không JSX đầy đủ, không import,
     không component body, không full Tailwind class list.
  2. Snippet được phép ≤10 dòng và CHỈ khi minh hoạ component tree
     hoặc contract shape khó — phải ghi rõ "illustrative, not source of truth".
  3. Request/response shape: đã có ở OpenAPI / api-routing → CHỈ reference.
  4. File/component cụ thể là trách nhiệm của source code. Ở đây dùng
     "area + responsibility", không ép tên file cứng.
  5. CSS/Tailwind styles, className đầy đủ → thuộc source code.

Mục tiêu: spec tối ưu cho REVIEW QUYẾT ĐỊNH (SC vs CC, rendering, state
strategy, a11y, error handling) — không tối ưu cho copy-paste vào IDE.
-->

# Frontend Implementation: FR-{{DOMAIN}}-{{NNN}}--{{slug}}-impl

> **Context budget**: ~130 dòng. Load khi implement frontend feature.

**FR**: FR-{{DOMAIN}}-{{NNN}}
**App**: app-{{name}}
**Page**: /{{route-path}}
**Wireframe spec**: `docs/ux/wireframes/{{wireframe-slug}}.md` (normative — states, A11y, copy)
**Stitch design**: [`docs/design/stitch/{{screen-slug}}.html`](../../../../docs/design/stitch/{{screen-slug}}.html) (visual concrete reference — Phase 4 output)
**Interaction Contract**: `docs/ux/interactions/{{flow-name}}.md`

## 1. Purpose

- **Mục tiêu**: {{1–2 câu mô tả user value của feature}}
- **In scope**: {{behavior 1, behavior 2}}
- **Out of scope**: {{explicit exclusion}}

## 2. References

| Artifact                                | Link                                                        |
| --------------------------------------- | ----------------------------------------------------------- |
| Feature spec (FR)                       | `../../features/FR-{{DOMAIN}}-{{NNN}}--{{slug}}.md`         |
| **Wireframe spec (Phase 4, normative)** | `docs/ux/wireframes/{{wireframe-slug}}.md`                  |
| **Stitch design (Phase 4, visual ref)** | `docs/design/stitch/{{screen-slug}}.html`                   |
| Interaction contract                    | `docs/ux/interactions/{{flow-name}}.md`                     |
| API routing                             | `../api-routing.md` §{{page}}                               |
| API contract                            | `contracts/api-{{domain}}.yaml#{{operationId}}`             |
| Design tokens / components              | `docs/ux/design-system.md` hoặc `{{component library ref}}` |
| Frontend architecture                   | `../frontend-architecture.md`                               |

## 3. Architecture Decisions

| Aspect                    | Decision                         | Reason (link ref nếu có)                         |
| ------------------------- | -------------------------------- | ------------------------------------------------ |
| Page component type       | {{Server / Client}}              | {{data fetching ở đâu, cần interactivity không}} |
| Rendering strategy        | {{SSG / ISR / SSR / CSR}}        | `frontend-architecture.md §1`                    |
| `revalidate` / cache tags | {{value}}                        | {{freshness requirement}}                        |
| Client data layer         | {{TanStack Query / SWR / none}}  | `frontend-architecture.md §4`                    |
| Form state                | {{RHF+Zod / native / none}}      | {{có form phức tạp không}}                       |
| SEO handling              | {{metadata + JSON-LD / noindex}} | `docs/FRONTEND/seo-metadata.md`                  |

## 4. Affected Areas

> Mô tả **trách nhiệm logic**, KHÔNG tên file cứng. Source code quyết định tên chính xác.

| Area               | Module/Folder (logical)                 | Responsibility                     | Action       |
| ------------------ | --------------------------------------- | ---------------------------------- | ------------ |
| Route/page         | `app/{{route}}`                         | Data fetch ở server, layout        | new / modify |
| Client interactive | `app/{{route}}/_components/{{feature}}` | Form, submit, optimistic state     | new          |
| Validation schema  | `{{route}}/_schemas`                    | Zod schema khớp backend validation | new / reuse  |
| API client         | `lib/api/{{domain}}`                    | Typed wrapper quanh endpoint       | new / reuse  |
| Types              | `types/{{feature}}`                     | Request/Response types từ contract | new          |
| Loading/error UI   | `app/{{route}}/loading, error`          | Skeleton + error boundary          | new          |

## 5. Interaction Flow

> Đánh số 1–N, mỗi bước 1 câu hành vi. Không JSX, không handler code.

1. User vào `/{{route-path}}` → Server Component fetch dữ liệu ban đầu (nếu có).
2. Render layout + hydrate Client Component `{{feature}}`.
3. User nhập form / trigger action → client validate theo Zod schema `§4`.
4. Nếu invalid → hiển thị field-level error, focus field đầu tiên.
5. Nếu valid → disable submit, show loading, call API client `§4`.
6. Nhận response:
   - `2xx` → {{toast success / redirect / update local state theo interaction contract}}.
   - `4xx` (validation / business error) → map sang error message theo `api-routing.md §{{section}}`.
   - `401` → trigger silent refresh → retry; nếu fail → redirect login.
   - `5xx` / network → show retry UI theo interaction contract.
7. Revalidate cache tags `{{tags}}` sau mutation thành công (nếu có).

## 6. State & Data

- **Server data source**: {{endpoint, cache tag, revalidate policy}}
- **Client state owners**: {{form state, UI state (modal/drawer), async state}}
- **Shared state**: {{context / store — nếu N/A thì ghi N/A}}
- **Optimistic update**: {{yes/no — nếu yes, rollback strategy}}
- **Cache invalidation on mutation**: {{tags được revalidate}}

## 7. Accessibility

- **Focus management**: {{focus đi đâu sau submit / open modal / error}}
- **Keyboard**: {{Tab order, Enter = submit, Escape = close, shortcut nếu có}}
- **ARIA**: {{landmarks, labels cho icon-only buttons, live region cho toast/error}}
- **Color/contrast**: tuân `docs/ux/design-system.md` — không override inline.
- **Screen reader**: {{announce khi state đổi quan trọng}}

## 8. Error Handling & Edge Cases

| Condition             | UX Treatment                                  | Source                    |
| --------------------- | --------------------------------------------- | ------------------------- |
| Field validation fail | Field-level message + focus                   | Zod schema `§4`           |
| Business error `4xx`  | Inline banner hoặc toast, retain form state   | `api-routing.md`          |
| `401` unauthenticated | Silent refresh → retry; fail → redirect login | `frontend-security.md §3` |
| `403` forbidden       | Full-page forbidden view hoặc disabled CTA    | —                         |
| Network / `5xx`       | Retry button + error boundary fallback        | Interaction contract      |
| Empty state           | {{illustration + CTA}}                        | Design system             |
| Loading state         | Skeleton match layout                         | `loading.tsx`             |

## 9. Security

> Conventions: `docs/SECURITY/frontend-security.md`

- **Auth token**: access token in memory context (NEVER localStorage); refresh token httpOnly cookie.
- **API calls**: qua `fetchWithAuth()` — tự thêm Bearer + handle 401.
- **XSS**: JSX default escape OK; cấm `dangerouslySetInnerHTML` trừ khi có `DOMPurify.sanitize()` + ghi rõ lý do ở `§11`.
- **URL safety**: validate protocol nếu render user-supplied link (https/http only).
- **Logging**: không log token / PII ra console.

## 10. Observability

- **Events to emit**: {{page view, submit success/fail, critical CTA click}}
- **Performance marks**: {{LCP/INP target, custom marks nếu có}}
- **Error reporting**: unhandled errors → Sentry (hoặc equivalent) qua error boundary.

## 11. Implementation Notes

- **Reuse components**: {{existing components từ design system / shared lib}}
- **Deviation từ conventions**: {{nếu có, giải thích; nếu không → N/A}}
- **Tech debt accepted for MVP**: {{e.g. "chưa optimistic update; thêm sau"}}
- **Unresolved questions**: {{link tới decision chờ xác nhận}}

## 12. Acceptance Checklist

- [ ] Page render đúng theo rendering strategy ở `§3`.
- [ ] Tất cả flow ở `§5` hoạt động end-to-end (thử manual + test).
- [ ] Mọi error condition ở `§8` có UX treatment đúng.
- [ ] A11y checklist `§7` pass (keyboard navigation, screen reader smoke test).
- [ ] Không vi phạm security rule `§9`.
- [ ] Observability hooks `§10` emit đúng event.
- [ ] Interaction contract được tuân thủ 1:1 (loading/success/error states).
- [ ] Test-spec tương ứng cover đủ golden path + error cases.
