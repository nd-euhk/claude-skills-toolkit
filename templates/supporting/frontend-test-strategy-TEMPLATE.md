---
title: "Frontend Test Strategy — {{project_name}}"
status: draft
created: {{date}}
last_updated: {{date}}
updated_by: "{{author}}"
depends_on:
  - frontend-architecture.md
  - api-routing.md
  - error-handling.md
referenced_by:
  - impl-spec-frontend.md
  - test-spec.md
changelog:
  - 1.0 | {{date}} | Initial frontend test strategy
---

# Frontend Test Strategy — {{project_name}}

> **Context budget**: ~750 dòng. Load khi viết frontend tests. Sections 1-3 là REQUIRED, code examples là OPTIONAL reference.

> **Stack**: Next.js 15 + React 19 + TypeScript
> **Test Stack**: Vitest + React Testing Library + Playwright + MSW
> **Audience**: AI Agent — đọc file này để biết CÁCH viết test cho frontend code.
>
> **Nguyên tắc**: Test behavior, KHÔNG test implementation.
> User không biết component dùng `useState` hay `useReducer` — user biết "bấm nút → thấy kết quả".

---

## 1. Test Pyramid — Frontend

```
         ╱╲
        ╱  ╲         E2E Tests (Playwright)
       ╱ 10% ╲       → Critical user journeys only
      ╱────────╲
     ╱          ╲     Integration Tests (Vitest + RTL + MSW)
    ╱    30%     ╲    → Component + API interaction
   ╱──────────────╲
  ╱                ╲   Unit Tests (Vitest)
 ╱       60%        ╲  → Hooks, utils, pure logic
╱____________________╲
```

| Layer | Tool | Scope | Speed | Khi nào viết |
|-------|------|-------|-------|-------------|
| **Unit** | Vitest | Hooks, utils, formatters, validators | ~1ms/test | Mọi pure function, custom hook |
| **Integration** | Vitest + RTL + MSW | Component renders, user interactions, API calls | ~50ms/test | Mọi component có user interaction |
| **E2E** | Playwright | Full user journey qua nhiều pages | ~5s/test | Critical paths only (auth, checkout, core flow) |

---

## 2. Project Setup

### 2.1 Dependencies

```json
// package.json — devDependencies
{
  "vitest": "^3.x",
  "@testing-library/react": "^16.x",
  "@testing-library/jest-dom": "^6.x",
  "@testing-library/user-event": "^14.x",
  "msw": "^2.x",
  "@playwright/test": "^1.x",
  "jsdom": "^25.x"
}
```

### 2.2 Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.*',
        '**/types/**',
        'app/layout.tsx',   // Layout wrapper — tested via integration
        'app/**/loading.tsx',
        'app/**/error.tsx',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
  },
});
```

### 2.3 Test Setup

```typescript
// tests/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

### 2.4 Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 3. MSW — API Mocking Strategy

> **Rule**: Frontend tests KHÔNG gọi backend thật. Dùng MSW mock API ở network layer.

### 3.1 Handler Structure

```
tests/
├── mocks/
│   ├── server.ts              ← MSW server setup
│   ├── handlers/
│   │   ├── index.ts           ← Export tất cả handlers
│   │   ├── auth.handlers.ts   ← Mock /api/v1/auth/*
│   │   └── {{domain}}.handlers.ts  ← Mock /api/v1/{{domain}}/*
│   └── data/
│       ├── auth.fixtures.ts   ← Test data factories
│       └── {{domain}}.fixtures.ts
```

### 3.2 MSW Server

```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### 3.3 Handler Pattern

```typescript
// tests/mocks/handlers/{{domain}}.handlers.ts
import { http, HttpResponse } from 'msw';
import { make{{Resource}} } from '../data/{{domain}}.fixtures';

const API = '/api/v1/{{resource}}';

export const {{domain}}Handlers = [
  // ── GET list ──────────────────────────────────────
  http.get(API, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    return HttpResponse.json({
      content: [make{{Resource}}(), make{{Resource}}()],
      page: { number: page, size: 20, totalElements: 42 },
    });
  }),

  // ── GET by ID ─────────────────────────────────────
  http.get(`${API}/:id`, ({ params }) => {
    return HttpResponse.json(make{{Resource}}({ id: params.id as string }));
  }),

  // ── POST create ───────────────────────────────────
  http.post(API, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(make{{Resource}}(body), { status: 201 });
  }),

  // ── DELETE ────────────────────────────────────────
  http.delete(`${API}/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
```

### 3.4 Test Data Factory

```typescript
// tests/mocks/data/{{domain}}.fixtures.ts
let counter = 0;

export function make{{Resource}}(overrides?: Partial<{{Resource}}>): {{Resource}} {
  counter++;
  return {
    id: `test-${counter}`,
    name: `Test {{Resource}} ${counter}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
```

### 3.5 Override Handlers trong Test (Error Scenarios)

```typescript
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';

it('shows error toast when API returns 500', async () => {
  // Override handler cho test cụ thể này
  server.use(
    http.post('/api/v1/{{resource}}', () => {
      return HttpResponse.json(
        { errorCode: 'INTERNAL_ERROR', message: 'Server error' },
        { status: 500 }
      );
    })
  );

  // ... test UI shows error toast
});
```

---

## 4. Unit Tests — Patterns

### 4.1 Custom Hook Test

```typescript
// hooks/__tests__/use-debounce.test.ts
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useDebounce } from '../use-debounce';

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.restoreAllMocks());

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'hello' } }
    );

    rerender({ value: 'world' });
    expect(result.current).toBe('hello'); // Not yet updated

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe('world'); // Now updated
  });
});
```

### 4.2 Utility / Formatter Test

```typescript
// lib/__tests__/format-currency.test.ts
import { formatCurrency } from '../format-currency';

describe('formatCurrency', () => {
  it.each([
    [1000, 'vi', '1.000 ₫'],
    [1234567, 'vi', '1.234.567 ₫'],
    [0, 'vi', '0 ₫'],
    [1000, 'en', '$1,000.00'],
  ])('formats %i in locale %s as %s', (amount, locale, expected) => {
    expect(formatCurrency(amount, locale)).toBe(expected);
  });
});
```

### 4.3 Zod Schema Validation Test

```typescript
// lib/__tests__/schemas.test.ts
import { create{{Resource}}Schema } from '../schemas/{{resource}}.schema';

describe('create{{Resource}}Schema', () => {
  it('accepts valid input', () => {
    const result = create{{Resource}}Schema.safeParse({
      name: 'Valid Name',
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });

  it.each([
    [{ name: '', email: 'test@example.com' }, 'name'],
    [{ name: 'Valid', email: 'not-an-email' }, 'email'],
    [{ name: 'V', email: 'test@example.com' }, 'name'], // min length
  ])('rejects invalid input %o for field %s', (input, expectedField) => {
    const result = create{{Resource}}Schema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain(expectedField);
    }
  });
});
```

---

## 5. Integration Tests — Patterns

### 5.1 Component Rendering + User Interaction

```typescript
// components/features/{{domain}}/__tests__/{{Feature}}List.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { {{Feature}}List } from '../{{Feature}}List';
import { QueryWrapper } from '@/tests/utils/query-wrapper';

// Test wrapper with providers
function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: QueryWrapper });
}

describe('{{Feature}}List', () => {
  it('renders list of items from API', async () => {
    renderWithProviders(<{{Feature}}List />);

    // Wait for data load (MSW handler returns mock data)
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);  // MSW default returns 2 items
  });

  it('shows empty state when no items', async () => {
    // Override MSW to return empty list
    server.use(
      http.get('/api/v1/{{resource}}', () => {
        return HttpResponse.json({
          content: [],
          page: { number: 0, size: 20, totalElements: 0 },
        });
      })
    );

    renderWithProviders(<{{Feature}}List />);

    expect(await screen.findByText(/chưa có/i)).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    renderWithProviders(<{{Feature}}List />);

    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
  });
});
```

### 5.2 Form Submit + API Call

```typescript
// components/features/{{domain}}/__tests__/Create{{Feature}}Form.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Create{{Feature}}Form } from '../Create{{Feature}}Form';
import { QueryWrapper } from '@/tests/utils/query-wrapper';

describe('Create{{Feature}}Form', () => {
  const user = userEvent.setup();

  it('submits form and shows success toast', async () => {
    // Given: form rendered với onSuccess callback
    const onSuccess = vi.fn();
    render(<Create{{Feature}}Form onSuccess={onSuccess} />, { wrapper: QueryWrapper });
    await user.type(screen.getByLabelText(/name/i), 'New Item');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');

    // When: user submit form
    await user.click(screen.getByRole('button', { name: /submit|save|tạo/i }));

    // Then: onSuccess được gọi
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows validation errors for empty required fields', async () => {
    // Given: form rỗng
    render(<Create{{Feature}}Form />, { wrapper: QueryWrapper });

    // When: user submit khi chưa nhập gì
    await user.click(screen.getByRole('button', { name: /submit|save|tạo/i }));

    // Then: hiển thị inline error
    expect(await screen.findByText(/là bắt buộc/i)).toBeInTheDocument();
  });

  it('shows API error toast on server error', async () => {
    server.use(
      http.post('/api/v1/{{resource}}', () => {
        return HttpResponse.json(
          { errorCode: 'VALIDATION_FAILED', message: 'Duplicate name' },
          { status: 409 }
        );
      })
    );

    render(<Create{{Feature}}Form />, { wrapper: QueryWrapper });
    await user.type(screen.getByLabelText(/name/i), 'Duplicate');
    await user.click(screen.getByRole('button', { name: /submit|save|tạo/i }));

    expect(await screen.findByText(/duplicate/i)).toBeInTheDocument();
  });

  it('disables button during submission', async () => {
    render(<Create{{Feature}}Form />, { wrapper: QueryWrapper });
    await user.type(screen.getByLabelText(/name/i), 'Valid');
    await user.click(screen.getByRole('button', { name: /submit|save|tạo/i }));

    expect(screen.getByRole('button', { name: /submit|save|tạo/i })).toBeDisabled();
  });
});
```

### 5.3 Test Utilities

```typescript
// tests/utils/query-wrapper.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,         // Không retry trong test
        gcTime: Infinity,     // Giữ cache trong suốt test
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

---

## 6. E2E Tests — Playwright Patterns

### 6.1 File Structure

```
tests/e2e/
├── auth.spec.ts           ← Login, register, logout flows
├── {{domain}}.spec.ts     ← CRUD flow cho {{domain}}
├── fixtures/
│   └── auth.fixture.ts    ← Reusable auth login steps
└── pages/
    ├── login.page.ts      ← Page Object Model
    └── {{domain}}.page.ts
```

### 6.2 Page Object Model

```typescript
// tests/e2e/pages/login.page.ts
import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email/i);
    this.passwordInput = page.getByLabel(/password|mật khẩu/i);
    this.submitButton = page.getByRole('button', { name: /login|đăng nhập/i });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/auth/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

### 6.3 Auth Flow E2E

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';

test.describe('Authentication', () => {
  test('login with valid credentials → redirect to dashboard', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'Password123!');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/welcome|xin chào/i)).toBeVisible();
  });

  test('login with invalid credentials → show error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('test@example.com', 'WrongPassword');

    await expect(loginPage.errorMessage).toBeVisible();
    await expect(page).toHaveURL('/auth/login');  // No redirect
  });

  test('access protected page without login → redirect to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
```

### 6.4 CRUD Flow E2E

```typescript
// tests/e2e/{{domain}}.spec.ts
import { test, expect } from '@playwright/test';

test.describe('{{Feature}} CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Login trước mỗi test
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('Password123!');
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL('/dashboard');
  });

  test('create → appears in list → view detail → delete', async ({ page }) => {
    // Navigate to list
    await page.goto('/{{resource}}');

    // Create
    await page.getByRole('link', { name: /create|tạo mới/i }).click();
    await page.getByLabel(/name/i).fill('E2E Test Item');
    await page.getByRole('button', { name: /save|lưu/i }).click();

    // Verify in list
    await expect(page).toHaveURL('/{{resource}}');
    await expect(page.getByText('E2E Test Item')).toBeVisible();

    // View detail
    await page.getByText('E2E Test Item').click();
    await expect(page.getByRole('heading', { name: 'E2E Test Item' })).toBeVisible();

    // Delete
    await page.getByRole('button', { name: /delete|xoá/i }).click();
    await page.getByRole('button', { name: /confirm|xác nhận/i }).click();

    // Verify removed
    await expect(page).toHaveURL('/{{resource}}');
    await expect(page.getByText('E2E Test Item')).not.toBeVisible();
  });
});
```

---

## 7. What to Test vs What NOT to Test

### ✅ PHẢI test

| Category | Examples | Layer |
|----------|---------|-------|
| User interactions | Click, type, submit, navigate | Integration |
| Form validation | Required fields, format, min/max length | Unit + Integration |
| API error handling | 400, 401, 403, 404, 500 responses | Integration (MSW) |
| Loading states | Skeleton shows → data appears | Integration |
| Empty states | No data → empty state component | Integration |
| Auth flows | Login, logout, token expired redirect | E2E |
| Critical user journeys | Register → Login → Core action → Result | E2E |
| Custom hooks | State changes, side effects | Unit |
| Utility functions | Formatters, validators, parsers | Unit |

### ❌ KHÔNG test

| Category | Reason |
|----------|--------|
| CSS styling / layout | Quá fragile, dùng visual regression thay thế |
| Third-party library internals | TanStack Query works, Zustand works — đã được test |
| Implementation details | `useState` called? `useEffect` ran? → Không quan tâm |
| Static Server Components | Không có logic, chỉ render markup |
| `console.log` / `console.error` | Observation, not behavior |
| Next.js built-in behavior | Routing, SSR, Image optimization |

---

## 8. Test File Convention

### Naming

```
{{Component}}.test.tsx       ← Integration test (RTL)
{{hook}}.test.ts             ← Unit test (hooks)
{{util}}.test.ts             ← Unit test (pure function)
{{feature}}.spec.ts          ← E2E test (Playwright)
```

### Co-location Rule

```
components/features/{{domain}}/
├── {{Feature}}List.tsx
├── {{Feature}}List.test.tsx      ← Test ngay cạnh component
├── Create{{Feature}}Form.tsx
└── Create{{Feature}}Form.test.tsx

hooks/
├── use-debounce.ts
└── __tests__/
    └── use-debounce.test.ts      ← Hoặc đặt trong __tests__/

tests/e2e/                         ← E2E tách riêng (Playwright)
├── auth.spec.ts
└── {{domain}}.spec.ts
```

---

## 9. Coverage Targets

| Metric | Minimum | Recommended |
|--------|---------|-------------|
| **Lines** | 80% | 90% |
| **Branches** | 70% | 80% |
| **Functions** | 80% | 90% |
| **Statements** | 80% | 90% |

### Per-layer Targets

| Layer | Coverage Focus | Not Counted |
|-------|---------------|-------------|
| hooks/ | 95% | — |
| lib/utils/ | 95% | — |
| components/ui/ | 70% | CSS-only components |
| components/features/ | 85% | Loading/error wrappers |
| app/ pages | 60% (via integration) | layout.tsx, loading.tsx |

---

## 10. npm Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:all": "vitest run --coverage && playwright test"
  }
}
```

---

## 11. Anti-patterns

| Anti-pattern | Tại sao sai | Cách đúng |
|-------------|------------|-----------|
| `getByTestId` everywhere | Test tied to implementation | `getByRole`, `getByLabelText`, `getByText` |
| `await waitFor(() => {})` no assertion inside | Race condition | Always assert inside `waitFor` |
| Mocking `fetch` directly | Fragile, misses Headers/Body | Dùng MSW (network-level mock) |
| Testing component renders without interaction | Snapshot trá hình | Test user behavior: click → see result |
| Import component internals for assertion | Tight coupling | Assert via DOM: `screen.getByText(...)` |
| `act()` wrapping manually | Usually unnecessary with RTL | RTL auto-wraps, chỉ dùng khi timer |
| E2E test mọi edge case | Quá chậm, quá fragile | E2E cho happy path + critical errors only |

---

## 12. Quick Reference — Agent Checklist

Khi implement frontend feature, Agent PHẢI tạo tests theo checklist này:

```markdown
### Test Checklist — FR-{{DOMAIN}}-{{NNN}}

#### Unit Tests (vitest)
- [ ] Custom hooks tested (if any)
- [ ] Utility functions tested (formatters, validators)
- [ ] Zod schemas tested (valid + invalid inputs)

#### Integration Tests (vitest + RTL + MSW)
- [ ] Component renders with mock data
- [ ] Loading state shows skeleton/spinner
- [ ] Empty state renders when no data
- [ ] User can interact: fill form, click buttons
- [ ] Form validation shows inline errors
- [ ] API success: correct UI update
- [ ] API errors: error toast/message shown (400, 403, 404, 500)
- [ ] Button disabled during submission

#### E2E Tests (playwright) — chỉ critical paths
- [ ] Happy path: full user journey works
- [ ] Auth required: redirect when not logged in
```
