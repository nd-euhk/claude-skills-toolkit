---
title: "Frontend Architecture — {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - architecture.md
  - api-routing.md
  - ../../docs/SECURITY/frontend-security.md
referenced_by:
  - impl-spec-frontend.md
  - frontend-test-strategy.md
  - ../../docs/INTERACTION/INTERACTION-CONTRACT.md
changelog:
  - 2.0 | {{date}} | Refactor lean — bỏ compile-ready code (middleware, Zustand, hooks, next.config); giữ decision matrix
  - 1.0 | {{date}} | Initial frontend architecture
---

<!--
HARD RULES (xem SPEC-BOUNDARIES.md):

  1. File này mô tả DECISION (rendering strategy, state category, data
     fetching pattern, SEO policy, performance target). KHÔNG cài đặt.
  2. middleware.ts, store code, hook code, next.config.js đầy đủ thuộc
     source code — chỉ tả shape/responsibility ở đây.
  3. Snippet ≤10 dòng, chỉ khi minh hoạ shape interface hoặc decision
     phức tạp. Gắn nhãn "illustrative, not source of truth".
  4. Field/class cụ thể trong source code là ground truth — file này
     mô tả "area + policy", không ép tên.
-->

# Frontend Architecture — {{project_name}}

> **Context budget**: ~230 dòng. Load khi cần quyết định kiến trúc FE.

> **Stack**: Next.js 15 + React 19 + TypeScript
> **Audience**: FE dev, AI agent generate FE code
> **Mục đích**: SSOT cho **quyết định kiến trúc** — rendering, state, data fetching, error boundary, i18n, SEO, performance. Cài đặt nằm ở source code.

---

## 1. Rendering Strategy

### 1.1 Decision Matrix

| Page type | Strategy | Reason | Example |
|---|---|---|---|
| Marketing / Landing | **SSG** | Content hiếm đổi → fastest TTFB | `/`, `/about`, `/pricing` |
| Blog / Docs | **ISR** (`revalidate: 3600`) | Near-static, update theo giờ | `/blog/[slug]`, `/docs/[id]` |
| Dashboard / User data | **SSR** (`dynamic = 'force-dynamic'`) | Data cá nhân, phải fresh | `/dashboard`, `/profile` |
| Interactive forms | **CSR** (Client Component) | Heavy interactivity | Form wizard, rich editor |
| Search results | **SSR** + client-side filter | SEO + UX — render initial ở server, filter ở client | `/search?q=xxx` |

### 1.2 Rules

- **Default**: Server Component (SSG/SSR). Chỉ thêm `'use client'` khi cần.
- **Triggers `'use client'`**: `useState`, `useEffect`, event handlers (`onClick`, `onChange`), browser APIs, third-party client lib.
- **Data fetching**: ưu tiên ở Server Component → pass props xuống Client Component.
- **Anti-pattern**: `useEffect` để fetch initial data — dùng Server Component.

---

## 2. Next.js Middleware

### 2.1 Use Cases & Responsibility

| Use case | Decision | Condition |
|---|---|---|
| Auth guard (redirect khi chưa login) | Required | Mọi route thuộc `protectedPaths` |
| Redirect sau login (nếu đã authenticated không cho vào `/auth/*`) | Required | `authPaths` + có access token |
| Role-based route guard | Optional | Khi có admin/role-specific routes |
| Locale redirect | Optional | Khi bật i18n prefix-based |
| Maintenance mode | Optional | Triggered bằng env flag |
| A/B testing / feature flag rewrite | Optional | Khi có experiment platform |
| Rate limiting | Optional (API routes) | Thường đẩy xuống BE/gateway |

### 2.2 Matcher Policy

- Exclude: `_next/static`, `_next/image`, `favicon.ico`, `api` (API routes tự handle).
- Keep middleware **thin** — quyết định nhanh (cookie check, path match), không gọi DB/API synchronous.
- Source of truth cho `protectedPaths` / `adminPaths` / `authPaths`: hằng số trong source code, **không** duplicate trong spec.

---

## 3. State Management Architecture

### 3.1 State Categories

| Category | Tool | Scope | Example |
|---|---|---|---|
| Server state | TanStack Query (client) hoặc Server Component fetch | Per-request, cached | API data, user profile |
| Client state (global) | Zustand | Cross-component, có thể persist | Theme, sidebar, preferences |
| Client state (local) | `useState` / `useReducer` | Single component | Form values, modal toggle |
| URL state | `nuqs` hoặc `useSearchParams` | Shareable, bookmarkable | Filter, pagination, sort |
| Form state | React Hook Form + Zod | Per-form | Registration, search form |

### 3.2 Rules

- ✅ Server Component fetch → props → Client Component (simple data flow).
- ✅ Zustand cho state cross-component persist across navigations.
- ✅ URL params cho state cần shareable / bookmarkable.
- ✅ React Hook Form cho **mọi** form (không raw `onChange`).
- ❌ Redux (quá nặng cho architecture này).
- ❌ Global state cho server data — dùng cache của TanStack Query.
- ❌ React Context cho state update thường xuyên (gây re-render).
- ❌ `localStorage` cho auth token (security risk — xem §5).

### 3.3 Store Design Guideline (không code)

Khi tạo Zustand store:
- Đặt mỗi domain concern thành store riêng (`ui-store`, `notification-store`), không gom hết vào một.
- Persist chọn lọc (theme, sidebar), **không** persist token/PII.
- Actions: tên theo intent (`toggleSidebar`, `setTheme`), không theo state setter (`setSidebarOpen`).
- Selector: component chỉ subscribe slice cần thiết để tránh re-render.

---

## 4. Data Fetching & Caching

### 4.1 Decision Matrix (client-side)

| Data type | staleTime | Tool | Reason |
|---|---|---|---|
| User profile | 5 min | TanStack Query | Rarely changes |
| List paginated | 1 min | TanStack Query | Balance freshness/perf |
| Dashboard metrics | 30 sec | TanStack Query + `refetchInterval` | Near real-time |
| Dropdown options | 30 min | TanStack Query | Nearly static |
| Search results | 0 | Server Component fetch | User muốn fresh |

### 4.2 Query Key Convention

- Centralized factory per resource: `{{resource}}Keys.all / lists / list(filters) / details / detail(id)`.
- Mutation invalidate theo key prefix (`{{resource}}Keys.lists()`).
- Không ghép query key ad-hoc trong component — phải qua factory để refactor an toàn.

### 4.3 Server-Side Fetch Rules

- Dùng `fetch` của Next.js (có cache layer) — tận dụng `next.revalidate` + `next.tags`.
- File util `server-only` → chỉ import ở Server Component/Route Handler.
- Không leak base URL / secret ra Client Component.

> Contract endpoint ↔ page/component mapping: xem `api-routing.md`.

---

## 5. Auth & Security

> Conventions: `docs/SECURITY/frontend-security.md`.

| Concern | Rule |
|---|---|
| Access token storage | **Memory** (React context / closure) — KHÔNG `localStorage` / `sessionStorage` |
| Refresh token | **httpOnly cookie** (BE set) — tự động với `credentials: 'include'` |
| Auto-attach Bearer | Qua `fetchWithAuth()` util của source code |
| 401 handling | Silent refresh → retry → redirect login nếu fail |
| CSRF | Cookie-based request dùng `SameSite=Strict`; Bearer token request không cần |
| XSS | JSX default escape; cấm `dangerouslySetInnerHTML` trừ khi dùng `DOMPurify.sanitize()` + ghi rõ lý do |
| URL safety | Validate protocol khi render user-supplied link (https/http only) |
| Logging | Không log token / PII ra browser console |
| Security headers | `next.config.js` PHẢI có CSP, HSTS, X-Frame-Options — config chi tiết xem `frontend-security.md §2` |

---

## 6. Error Boundary Strategy

### 6.1 Hierarchy

Mỗi route segment có thể có `error.tsx` / `not-found.tsx` riêng. Từ cạn đến sâu:
- Root `app/error.tsx` — catch-all unhandled errors.
- Group-level (`app/(dashboard)/error.tsx`) — error domain-specific.
- Page-level — khi cần granular fallback.
- Root `app/not-found.tsx` cho 404.

### 6.2 Mapping

| Error type | Handler | UX |
|---|---|---|
| Page data fetch fail | Route `error.tsx` | "Đã xảy ra lỗi" + Retry |
| Component render error | Nearest `error.tsx` | Partial fallback |
| 404 Not Found | Route `not-found.tsx` | Custom 404 |
| 401 expired | Middleware / client interceptor | Redirect `/login?redirect=current` |
| 403 forbidden | Route error hoặc redirect | "Không có quyền" |
| Network error | Client error handler | Toast "Không có kết nối mạng" |

### 6.3 Rules

- Error component PHẢI là `'use client'` + accept `{ error, reset }` props.
- Log error vào tracking (Sentry/equivalent) ở `useEffect` trong error component.
- **KHÔNG** expose `error.message` raw cho user nếu message nhạy cảm — map sang message chung.

---

## 7. Internationalization

### 7.1 Decisions

| Aspect | Decision | Reason |
|---|---|---|
| Library | `next-intl` | Best App Router support |
| Routing | Prefix-based (`/vi/...`, `/en/...`) | SEO-friendly, shareable |
| Default locale | `vi` | Primary market |
| Message storage | `messages/{locale}.json` (flat, ≤2 levels) | Easy to maintain |
| Detection | `Accept-Language` → cookie → default | Via middleware |

### 7.2 Rules

- ❌ Hardcode UI text trong component → luôn dùng translation key.
- ✅ Date/time: `Intl.DateTimeFormat` hoặc `next-intl` formatter.
- ✅ Number/currency: `Intl.NumberFormat`.
- Key naming: `{namespace}.{key}` — namespace theo domain, không theo component.

---

## 8. Image Optimization

| Rule | Detail |
|---|---|
| Dùng `next/image` | Auto optimize, lazy load, WebP/AVIF |
| `priority` cho LCP image | Hero, above-the-fold |
| Set `width` + `height` | Tránh CLS |
| `fill` cho aspect ratio động | Parent phải `position: relative` |
| Remote images | Whitelist trong `next.config.js` → `images.remotePatterns` |

---

## 9. SEO Architecture

### 9.1 Metadata Strategy

| Level | Scope | Rule |
|---|---|---|
| `app/layout.tsx` | Global | `metadataBase`, title template `"%s \| {{project}}"`, default OG image |
| `app/{route}/page.tsx` | Static per route | `title`, `description` cụ thể |
| `generateMetadata({ params })` | Dynamic `[slug]` | Fetch data + trả metadata |

### 9.2 Structured Data & Sitemap

- JSON-LD inject qua component riêng (đừng inline khắp nơi).
- `app/sitemap.ts` + `app/robots.ts` — generated per Next.js API.
- Disallow `/api/`, `/admin/`, `/auth/` trong `robots.ts`.

---

## 10. Web Vitals Targets

| Metric | Target | Tool |
|---|---|---|
| LCP | ≤ 2.5s | `next/web-vitals` + RUM |
| INP | ≤ 200ms | `next/web-vitals` + RUM |
| CLS | ≤ 0.1 | `next/web-vitals` + RUM |
| TTFB | ≤ 800ms | Lighthouse, RUM |
| FCP | ≤ 1.8s | Lighthouse |
| JS bundle initial | ≤ 200KB gzipped | `next build` |
| Lighthouse Performance | ≥ 90 | Lighthouse CI |

> Chi tiết reporting pipeline: source code + `operations/monitoring-spec.md`.

---

## 11. Responsive Design

### 11.1 Breakpoints (Tailwind defaults)

| Name | Width | Device |
|---|---|---|
| `xs` | < 640px | Mobile portrait |
| `sm` | ≥ 640px | Mobile landscape |
| `md` | ≥ 768px | Tablet |
| `lg` | ≥ 1024px | Desktop |
| `xl` | ≥ 1280px | Large desktop |
| `2xl` | ≥ 1536px | Ultra-wide |

### 11.2 Per-page Testing Checklist

- [ ] Mobile 375px: readable, no horizontal scroll.
- [ ] Mobile 414px: images/buttons sized đúng.
- [ ] Tablet 768px: sidebar collapse / menu.
- [ ] Desktop 1024px: full layout.
- [ ] Large 1440px: content không stretch quá max-width.
- [ ] Touch targets ≥ 44×44px trên mobile.
- [ ] Text readable không cần zoom.

---

## 12. Design System Integration

- Component layer: `ui/` (primitives, shadcn-style) → `features/` (domain composition) → `layouts/`.
- Design tokens: CSS custom properties (`--color-*`, `--font-*`, `--spacing-*`, `--radius-*`).
- Theme: class-based (`.dark`) override.
- **Rule**: component không hardcode màu/spacing — luôn dùng token.

---

## 13. PWA (Optional)

Kích hoạt khi project yêu cầu offline / app-like. Cần:
- `next-pwa` configured trong `next.config.js`.
- `public/manifest.json` với `name`, `short_name`, `start_url`, `display: standalone`, icons 192/512.
- Service worker strategy chọn theo use case (offline-first vs network-first).
