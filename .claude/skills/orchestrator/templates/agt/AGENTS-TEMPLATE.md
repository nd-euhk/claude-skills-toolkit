---
title: "AGENTS.md — Fullstack Project Template"
version: "3.0.1"
status: current
created: 2026-03-19
last_updated: 2026-04-17
updated_by: Xo
default_stack: "Next.js + Spring Boot + PostgreSQL"

changelog:
  - 3.0.1 | 2026-04-17 | H-29 — insert `AI-RISK.md` là step 2 trong Agent Reading Order (bắt buộc load mọi session); stop-reading signal mention AI-RISK explicitly
  - 3.0 | 2026-04-16 | v3.0 — reference Phase 0 Intake (before BRD), L0/L1 maturity split, HLD/LLD rename, tailoring-matrix mode awareness, AI-RISK.md for data governance
  - 2.0 | 2026-03-24 | Initial vendor-neutral template
---

# AGENTS.md — {{project_name}}

> **Khởi tạo dự án**: Khi AI Agent bắt đầu dự án mới, yêu cầu người dùng cung cấp:
>
> 1. **Tên dự án** → điền vào `{{project_name}}`
> 2. **Mô tả dự án** → điền vào `{{project_description}}`
> 3. Xác nhận hoặc điều chỉnh Tech Stack mặc định bên dưới

---

## Xưng hô & Giao tiếp

- Luôn xưng **"Em"**, gọi user là **"Anh"**
- User là Software Architect — giao tiếp ở mức senior-to-senior
- Ưu tiên tiếng Việt, dùng tiếng Anh cho thuật ngữ kỹ thuật

---

## Project Overview

**Tên dự án**: {{project_name}}
**Mô tả**: {{project_description}}

---

## Tech Stack

> _Đây là stack mặc định. Điều chỉnh version/library khi vào dự án cụ thể._

### Frontend

| Hạng mục         | Công nghệ                                                        |
| ---------------- | ---------------------------------------------------------------- |
| Framework        | Next.js 15.x (App Router)                                        |
| Language         | TypeScript 5.x (strict mode)                                     |
| Runtime          | Node.js 22 LTS                                                   |
| Package Manager  | pnpm 9.x                                                         |
| Styling          | Tailwind CSS 4.x                                                 |
| UI Components    | shadcn/ui (Radix UI primitives)                                  |
| State Management | Zustand / React Context (simple) — TanStack Query (server state) |
| Form             | React Hook Form + Zod validation                                 |
| Testing          | Vitest + Testing Library (unit) · Playwright (E2E)               |
| Linting          | ESLint 9.x (flat config) + Prettier                              |

### Backend

| Hạng mục         | Công nghệ                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Language         | Java 21+ (first-class support đến Java 25)                                                              |
| Framework        | Spring Boot 4.0.x · Spring Framework 7.0.x                                                              |
| Build Tool       | Gradle Groovy DSL (wrapper)                                                                             |
| Servlet Baseline | Jakarta EE 11 · Servlet 6.1                                                                             |
| Web Server       | Tomcat (default) hoặc Jetty ⚠️ _Undertow không hỗ trợ Servlet 6.1, đã bị drop từ Boot 4.0_              |
| ORM              | Spring Data JPA + Hibernate 7.x ⚠️ _`hibernate-jpamodelgen` → đổi thành `hibernate-processor`_          |
| Query DSL        | QueryDSL 5.x (jakarta classifier) hoặc Spring Specifications                                            |
| Migration        | Flyway 11.x via `spring-boot-starter-flyway` ⚠️ _Boot 4.0 không auto-config nếu chỉ dùng `flyway-core`_ |
| Mapping          | MapStruct 1.6.x (stable) / 1.7.x (beta, hỗ trợ Java 21 SequencedCollections) + Lombok 1.18.43+          |
| HTTP Client      | Spring RestClient (preferred) hoặc WebClient (reactive)                                                 |
| Validation       | Jakarta Validation (Bean Validation 3.1)                                                                |
| API Docs         | SpringDoc OpenAPI 3.0.x (Swagger UI) ⚠️ _Phải dùng 3.x cho Boot 4.0, không dùng 2.x_                    |
| Testing          | JUnit 5 + Mockito · WireMock (external calls) · Testcontainers (DB/Redis)                               |
| Logging          | Logback + custom MaskingPatternLayout                                                                   |
| Metrics          | Micrometer + Prometheus                                                                                 |
| Tracing          | Micrometer Tracing + OpenTelemetry bridge                                                               |

> **⚠️ Migration notes từ Boot 3.x → 4.0**: Xem chi tiết tại [Spring Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)

### Database & Infra

| Hạng mục      | Công nghệ                                                   |
| ------------- | ----------------------------------------------------------- |
| Database      | PostgreSQL 17.x                                             |
| Cache         | Redis 7.x (Standalone dev / Sentinel production)            |
| Container     | Docker + Docker Compose                                     |
| CI/CD         | _Điền khi vào dự án (GitLab CI / GitHub Actions / Jenkins)_ |
| Artifact Repo | _Điền khi vào dự án_                                        |

---

## Cấu trúc Repo & Naming Convention

> 📖 **SSOT**: [`structure/README.md`](structure/README.md) — routing tới các file chi tiết:
>
> - [`structure/docs-human.md`](structure/docs-human.md) — cấu trúc `docs/`
> - [`structure/agent-docs.md`](structure/agent-docs.md) — cấu trúc `agent_docs/`
> - [`structure/devops.md`](structure/devops.md) — `.work/`, `infra/`, `scripts/`, `projects/`
> - [`structure/api-contract.md`](structure/api-contract.md) — response format, error format, HTTP methods
> - **Naming Conventions**: xem [`AI-BLUEPRINT.md`](AI-BLUEPRINT.md) § "Naming Conventions"
>
> _Khi vào dự án cụ thể, liệt kê danh sách services thực tế bên dưới._

### Danh sách services (điền khi vào dự án)

| Project            | Loại     | Port | Trạng thái | Mô tả   |
| ------------------ | -------- | ---- | ---------- | ------- |
| `app-{{name}}`     | Frontend | 3000 | 📋 Planned | _Mô tả_ |
| `{{name}}-service` | Backend  | 8080 | 📋 Planned | _Mô tả_ |
| `lib-{{name}}`     | Library  | —    | 📋 Planned | _Mô tả_ |

---

## Build & Test Commands

### Frontend

| Task       | Command           |
| ---------- | ----------------- |
| Install    | `pnpm install`    |
| Dev server | `pnpm dev`        |
| Build      | `pnpm build`      |
| Lint       | `pnpm lint`       |
| Format     | `pnpm format`     |
| Unit test  | `pnpm test`       |
| E2E test   | `pnpm test:e2e`   |
| Type check | `pnpm type-check` |

### Backend

| Task        | Command                                |
| ----------- | -------------------------------------- |
| Build       | `./gradlew build`                      |
| Test        | `./gradlew test`                       |
| Single test | `./gradlew test --tests "*ClassName*"` |
| Run dev     | `./gradlew bootRun`                    |
| Lint        | `./gradlew spotlessCheck` (nếu có cài) |
| Publish lib | `./gradlew publish`                    |

### Database

| Task             | Command                    |
| ---------------- | -------------------------- |
| Migrate          | `./gradlew flywayMigrate`  |
| Info             | `./gradlew flywayInfo`     |
| Validate         | `./gradlew flywayValidate` |
| Clean (DEV only) | `./gradlew flywayClean`    |

### Docker (Full Stack)

| Task      | Command                            |
| --------- | ---------------------------------- |
| Start all | `docker compose up -d`             |
| Stop all  | `docker compose down`              |
| Rebuild   | `docker compose up -d --build`     |
| Logs      | `docker compose logs -f {service}` |

---

## API Contract — Frontend ↔ Backend

> 📖 **Chi tiết**: [`structure/api-contract.md`](structure/api-contract.md) — response format, error format, error codes, HTTP methods, JSON conventions.

- Backend expose REST API, document bằng **SpringDoc OpenAPI** (`/swagger-ui.html`, `/v3/api-docs`)
- Frontend gọi Backend qua typed API client (generate từ OpenAPI spec hoặc viết tay với Zod schema)
- Contract template: [`agent_docs/contracts/api-TEMPLATE.yaml`](agent_docs/contracts/api-TEMPLATE.yaml)
- **Nguyên tắc**: Success → trả DTO trực tiếp (KHÔNG wrap), Error → flat `ApiErrorResponse` với `traceId` top-level

> _Điều chỉnh response format khi vào dự án cụ thể._

---

## Agent Reading Order

> 📖 **Chi tiết loading priority + Context Budget Rules**: Xem [`AI-BLUEPRINT.md`](AI-BLUEPRINT.md) § "Agent Quick Start".

Agent PHẢI đọc theo thứ tự này khi bắt đầu task:

```
1. AGENTS.md                                (file này — project config, tech stack, boundaries)
2. AI-RISK.md                               ← ⚠️ BẮT BUỘC — data sensitivity + prompt boundary + denied paths
3. agent_docs/README.md                     ← Routing table, chọn file cần đọc
4. agent_docs/hard-boundaries.md            ← Đọc TRƯỚC khi code BẤT CỨ THỨ GÌ
5. agent_docs/conventions.md                ← Coding style, patterns chung
6. agent_docs/features/FR-{DOMAIN}-{NNN}--{slug}.md          ← Feature spec đang implement
7. agent_docs/{backend|frontend}/{project}/implementation/FR-{DOMAIN}-{NNN}--{slug}-impl.md ← HOW
8. agent_docs/{backend|frontend}/{project}/test-specs/FR-{DOMAIN}-{NNN}--{slug}-test.md     ← TDD
```

> **AI-RISK.md (step 2) bắt buộc load mọi session** — agent không được skip. Cover data classification (L0-L3), provider routing, denied paths, redaction rules. Xem `AI-RISK.md` § 1-3.

**Stop-reading signal**: Khi đã có đủ (1) Constraints (incl. AI-RISK), (2) WHAT to build, (3) HOW to build → bắt đầu code, KHÔNG đọc thêm.

---

## Hard Boundaries (Tóm tắt — Chi tiết xem agent_docs/hard-boundaries.md)

### Chung (Áp dụng mọi layer)

1. **KHÔNG hardcode credentials** — luôn dùng `${ENV_VAR}` / `.env` pattern
2. **KHÔNG commit file secrets** — `.env`, `*.pem`, `*.key` phải nằm trong `.gitignore`
3. **KHÔNG log raw sensitive data** — PII/credentials phải qua masking
4. **KHÔNG bỏ qua timeout config** khi gọi external service
5. **KHÔNG xóa test đang pass**
6. **KHÔNG push trực tiếp lên remote hoặc merge vào main**

### Frontend (Next.js)

1. **KHÔNG dùng `"use client"` khi không cần** — App Router mặc định là Server Component, chỉ thêm `"use client"` khi cần browser API / event handlers / hooks
2. **KHÔNG fetch data từ client khi có thể fetch từ server** — ưu tiên Server Components, Server Actions, Route Handlers
3. **KHÔNG hardcode API URL** — dùng `NEXT_PUBLIC_*` cho client-side, `process.env.*` cho server-side
4. **KHÔNG disable TypeScript strict mode** — `strict: true` bắt buộc trong `tsconfig.json`
5. **KHÔNG dùng `any` type** — dùng `unknown` rồi narrow, hoặc define type/interface rõ ràng
6. **KHÔNG import server-only code vào client component** — dùng `server-only` package để guard

### Backend (Spring Boot)

1. **KHÔNG dùng `ddl-auto: create/update` trên production** — schema do Flyway migration quản lý
2. **KHÔNG sửa migration file đã commit** — chỉ tạo file migration mới (`V{n+1}__description.sql`)
3. **KHÔNG import entity từ service khác** — chỉ dùng shared `lib` hoặc local DTO
4. **KHÔNG duplicate constants/enums** đã có trong shared lib
5. **KHÔNG raw SQL trong service layer** — dùng Spring Data JPA repository / QueryDSL / Specifications
6. **KHÔNG dùng `java.util.Date`** — dùng `java.time.*` (`LocalDateTime`, `Instant`, `ZonedDateTime`)
7. **KHÔNG gọi HTTP external API bên trong `@Transactional`**

---

## Testing Rules

### Frontend

1. **Component test**: Vitest + Testing Library — test behavior, không test implementation
2. **E2E test**: Playwright — cho critical user flows (login, checkout, form submit)
3. **KHÔNG mock fetch trong Server Component test** — dùng MSW (Mock Service Worker)
4. **Snapshot test**: Chỉ dùng cho stable UI components, không cho dynamic content

### Backend

1. **TDD-first**: Viết test TRƯỚC → RED → implement → GREEN → refactor
2. **External calls**: Mock bằng WireMock (REST) hoặc MockServer
3. **Repository tests**: Testcontainers với PostgreSQL image (match production)
4. **KHÔNG mock repository trong service test** khi có thể dùng Testcontainers
5. **Test layers**: Unit → Controller → Repository → Client (WireMock) → Integration

### Chung

1. **Coverage target**: ≥ 80% line coverage cho business logic, ≥ 70% branch coverage
2. **KHÔNG xóa test đang pass**
3. **Test phải isolated** — không depend vào thứ tự chạy hay shared mutable state

---

## Architecture — Simplified Clean Architecture

### Backend — Simplified Clean Architecture

> Chi tiết package structure, dependency rules, quy tắc từng tầng: xem [`structure/backend-architecture.md`](structure/backend-architecture.md)

```
api/  ──→  domain/  ←──  integration/
 (in)      (core)         (out)
```

- **`domain/`** — vòng trong, KHÔNG import `api/` hay `integration/`
- **`api/`** — gọi `domain/service/`, chuyển đổi DTO ↔ Entity
- **`integration/`** — gọi external, inject qua interface hoặc gọi trực tiếp
- **`common/`** — exception, response wrapper — cả 3 tầng dùng
- **`config/`** — Spring wiring, security, infra config

### Frontend — App Router Colocation

> Chi tiết folder structure, prefix `_`, nguyên tắc phân chia: xem [`structure/frontend-architecture.md`](structure/frontend-architecture.md)

- Colocation theo feature trong `app/` — 1 feature = 1 route folder
- Prefix `_` (`_components/`, `_hooks/`, `_actions/`, `_schemas/`) = private, App Router bỏ qua trong routing
- `components/` = shared cross-feature, `lib/` = pure utilities, `hooks/` = shared hooks

---

## Key Conventions

### Frontend

- **File naming**: `kebab-case` cho files/folders, `PascalCase` cho components
- **Path alias**: `@/` trỏ đến `src/`
- **Data fetching**: Server Components fetch trực tiếp → pass props xuống Client Components
- **Error handling**: `error.tsx` + `not-found.tsx` ở mỗi route segment
- **Loading**: `loading.tsx` với Suspense boundaries

### Backend

- **Architecture**: Simplified Clean — `api/ → domain/ ← integration/`
- **Naming**: `*Controller`, `*Service`, `*Repository`, `*DTO`, `*Mapper`, `*Client`
- **Dates**: `java.time.LocalDateTime` (không timezone) hoặc `Instant` (có timezone)
- **IDs**: UUID v7 (time-ordered) hoặc Snowflake — _chọn khi vào dự án_
- **Response**: Success trả DTO trực tiếp (KHÔNG wrap), Error dùng flat `ApiErrorResponse` với `traceId` top-level — xem [`structure/api-contract.md`](structure/api-contract.md)
- **Exception**: Global `@RestControllerAdvice` xử lý tập trung, domain throw `BusinessException`

### Git & Commits

- **Convention**: `type(scope): description`
- **Types hợp lệ**: `feat`, `fix`, `refactor`, `test`, `migration`, `spec`, `chore`, `docs`

### Database

- **Naming convention**: `snake_case` cho tables/columns
- **Migration file**: `V{version}__{description}.sql` (Flyway convention)
- **Index**: Đặt tên `idx_{table}_{columns}`
- **Foreign key**: Đặt tên `fk_{table}_{ref_table}`

---

## Work Tracking

> 📖 **Chi tiết**: Xem [`AI-BLUEPRINT.md`](AI-BLUEPRINT.md) § "Roadmap & Work Tracking".

- **Roadmap**: `agent_docs/roadmap.md` — SSOT timeline
- **Sprint**: `.work/board.md` — chỉ reference roadmap, không duplicate
- **Task**: `.work/tasks/{task-id}.md`
- **Session log**: `.work/logs/YYYY-MM-DD-{dev}-{task}.md`

---

## TDD Protocol — NEVER skip

1. Write ALL tests FIRST from test spec
2. Run tests → VERIFY every test FAILS (RED)
3. If test passes immediately → test is wrong → rewrite
4. Implement MINIMUM code to make tests pass (GREEN)
5. Refactor: formatting, naming, duplication (REFACTOR)
6. Commit after EACH phase with conventional commit

---

## Autonomous Mode

- Write report to `.work/reports/{FR-ID}-report.md` after each feature
- If stuck after 5 attempts on same error → STOP, write `.work/reports/{FR-ID}-stuck.md`
- NEVER modify files in `agent_docs/`, `.claude/`, `CLAUDE.md`, `AGENTS.md`
- NEVER change API contracts (`.yaml` in `contracts/`)
- NEVER change database schema outside migration spec

---

## Context Budget

- Max 5-7 files per task. Do NOT bulk-load entire directories.
- Always load: `hard-boundaries.md` + `conventions.md`
- Load per task: FR spec + impl spec OR test spec (not both unless needed)
- If context feels large → `/compact` before continuing

---

## When Stuck

- Đọc `agent_docs/tech-design/{service}.md` cho implementation guidance
- Đọc `agent_docs/architecture.md` cho system context
- Khúc mắc business rule → **HỎI human** trước khi đoán, không tự suy diễn (speculative changes)
- Không implement "as-is" nếu phát hiện anti-pattern — đề xuất fix trước
- Nếu bế tắc > 5 attempts cùng 1 lỗi → DỪNG, viết report vào `.work/reports/{FR-ID}-stuck.md`
  - Report cần có: error, những cách đã thử, giả thuyết, đề xuất fix.
- KHÔNG xóa/bypass test đang fail chỉ để code compile.
- KHÔNG tự ý sửa specs/contracts chỉ để bypass lỗi.

---

## Documentation Generation Rules — LUÔN ÁP DỤNG

> 📖 **SSOT**: [`docs/_template/REGISTRY.md`](docs/_template/REGISTRY.md)

Trước khi tạo **bất kỳ tài liệu nào** (BRD, PRD, FR, Tech Design, v.v.) → đọc `REGISTRY.md` để biết dùng template nào, output path ở đâu, đặt tên thế nào. **KHÔNG tự nghĩ format.** Mọi file `.md` trong `docs/` và `agent_docs/` PHẢI có YAML frontmatter đầy đủ
---

## Living Documentation

> 📖 **Frontmatter Convention + Validation rules**: Xem [`AI-BLUEPRINT.md`](AI-BLUEPRINT.md) § "Frontmatter Convention" và § "Validation Script".

- Sau mỗi task: cập nhật `agent_docs/roadmap.md` và file tech-design liên quan
- Nếu implement logic mới chưa có trong docs → cập nhật ngược vào spec
- Tech decision mang tính kiến trúc → tạo ADR tại `docs/architecture/ADRs/`
- API contract thay đổi → cập nhật OpenAPI spec + notify frontend
- **Mọi file `.md`** trong `docs/` và `agent_docs/` PHẢI có frontmatter metadata (xem AI-BLUEPRINT.md)
