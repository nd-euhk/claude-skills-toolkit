# Output Standard — sdlc-explore v3

Chuẩn output khớp 100% với `sdlc` orchestrator. Mọi file tạo ra phải tuân theo các quy ước trong file này.

## Cấu trúc knowledge/ (CHUẨN SDLC)

```
knowledge/
├── 01-global-standards/
│   ├── hard-boundaries.md              # Ranh giới service, NFR thresholds
│   ├── coding-conventions.md           # Coding standards toàn hệ thống
│   └── cross-cutting-patterns.md       # Shared infra, auth, tracing
├── 02-central-contracts/
│   ├── apis/                           # OpenAPI specs tập trung
│   │   └── {service}-api.yaml
│   ├── events/                         # Event specs riêng lẻ
│   │   └── evt-{name}.yaml
│   └── global-error-codes.md           # Bảng mã lỗi toàn hệ thống
├── 03-system-architecture/
│   ├── C4-context-diagram.md           # C4 diagrams, bounded contexts, service mapping
│   └── ADRs/                           # Architecture Decision Records
│       └── ADR-{NNN}--{slug}.md
├── 04-microservices/{service}/
│   ├── FR-{EPIC}-{NNN}--{slug}.md      # Functional Requirements
│   ├── FR-{EPIC}-{NNN}--{slug}-impl.md # Implementation Specs
│   ├── FR-{EPIC}-{NNN}--{slug}-test.md # Test Specifications
│   ├── tech-design.md                  # Service internals (LLD)
│   └── explore-summary.md              # Báo cáo khám phá (Phase 5)
└── explore.json                        # State persistence
```

## Quy ước đặt tên

| Thành phần | Format | Ví dụ |
|-----------|--------|-------|
| FR Spec | `FR-{EPIC}-{NNN}--{slug}.md` | `FR-WAL-001--topup-bank.md` |
| IMP Spec | `FR-{EPIC}-{NNN}--{slug}-impl.md` | `FR-WAL-001--topup-bank-impl.md` |
| TST Spec | `FR-{EPIC}-{NNN}--{slug}-test.md` | `FR-WAL-001--topup-bank-test.md` |
| ADR | `ADR-{NNN}--{slug}.md` | `ADR-001--event-sourcing.md` |
| Event | `evt-{name}.yaml` | `evt-payment-completed.yaml` |
| API Spec | `{service}-api.yaml` | `auth-service-api.yaml` |
| Scout Report | `scout-{YYYYMMDD}-{service}--{slug}.md` | `scout-20260630-auth-service--my-platform.md` |
| Plan | `explore-{YYYYMMDD}-{service}--{slug}.md` | `explore-20260630-auth-service--my-platform.md` |

**EPIC codes:** Lấy từ Phase 3 plan (human-confirmed). KHÔNG tự suy đoán từ tên domain kỹ thuật.
Nếu không xác định được EPIC, dùng mã project/service viết tắt (vd: `AUTH`, `PAY`, `NTF`).

## Files KHÔNG tạo (khác biệt với sdlc-explore cũ)

Các file sau từ phiên bản cũ **không** được tạo trong skill v3:

| File cũ | Lý do bỏ | Nội dung chuyển vào |
|---------|---------|-------------------|
| `nfr-thresholds.md` | Không có trong chuẩn sdlc | `hard-boundaries.md` |
| `api-conventions.md` | Không có trong chuẩn sdlc | `global-error-codes.md` hoặc OpenAPI specs |
| `api-{svc}.yaml` (per-service) | Không có trong chuẩn sdlc | OpenAPI specs tập trung trong `apis/` |
| `events.md` (gộp chung) | Không có trong chuẩn sdlc | File riêng `evt-{name}.yaml` trong `events/` |
| `system-architecture.md` | Không có trong chuẩn sdlc | `C4-context-diagram.md` |
| `architecture.md` | Trùng lặp | Gộp vào `C4-context-diagram.md` |
| `domain-service-mapping.yaml` | Không có trong chuẩn sdlc | Gộp vào C4 diagram |
| `tech-design-index.md` | Không có trong chuẩn sdlc | Gộp vào từng `tech-design.md` |

## So sánh với sdlc-explore cũ (v2)

| File | v2 (cũ) | v3 (mới — khớp sdlc) | Ghi chú |
|------|---------|----------------------|--------|
| `hard-boundaries.md` | ✅ | ✅ | Thêm NFR thresholds |
| `coding-conventions.md` | ❌ | ✅ | **Mới — chuẩn sdlc** |
| `cross-cutting-patterns.md` | ✅ | ✅ | Giữ nguyên |
| `nfr-thresholds.md` | ✅ | ❌ | **Gộp vào hard-boundaries.md** |
| `api-conventions.md` | ✅ | ❌ | **Gộp vào global-error-codes.md** |
| `api-{svc}.yaml` (per-service) | ✅ | ❌ | **Dùng OpenAPI specs tập trung** |
| `events.md` (gộp) | ✅ | ❌ | **Dùng file evt-{name}.yaml riêng** |
| `global-error-codes.md` | ❌ | ✅ | **Mới — chuẩn sdlc** |
| `system-architecture.md` | ✅ | ❌ | **Đổi thành C4-context-diagram.md** |
| `C4-context-diagram.md` | ❌ | ✅ | **Mới — chuẩn sdlc** |
| `architecture.md` | ✅ | ❌ | **Gộp vào C4-context-diagram.md** |
| `domain-service-mapping.yaml` | ✅ | ❌ | **Gộp vào C4-context-diagram.md** |
| `tech-design-index.md` | ✅ | ❌ | **Gộp vào từng tech-design.md** |
| `FR-{DOMAIN}-{NNN}--{slug}.md` | ✅ | ❌ | **Đổi thành FR-{EPIC}-{NNN}** |
| `FR-{EPIC}-{NNN}--{slug}.md` | ❌ | ✅ | **Mới — chuẩn sdlc** |

## Phase Artifacts Mapping

Mỗi SDLC phase tạo ra những file nào:

| Phase | Files Created | Vị trí |
|-------|--------------|--------|
| **FR Discovery** | `FR-{EPIC}-{NNN}--{slug}.md` | `knowledge/04-microservices/{service}/` |
| **LLD** | `tech-design.md` | `knowledge/04-microservices/{service}/` |
| **IMP** | `FR-{EPIC}-{NNN}--{slug}-impl.md` | `knowledge/04-microservices/{service}/` |
| **TST** | `FR-{EPIC}-{NNN}--{slug}-test.md` | `knowledge/04-microservices/{service}/` |
| **Service Notes** | `{service}.md` | `.work/system-wide-notes/` |
| **System Merge** | `hard-boundaries.md`, `coding-conventions.md`, `cross-cutting-patterns.md`, `C4-context-diagram.md`, `global-error-codes.md`, `*.yaml` (events), `{svc}-api.yaml`, `ADR-*.md` | `knowledge/01-global-standards/`, `02-central-contracts/`, `03-system-architecture/` |
