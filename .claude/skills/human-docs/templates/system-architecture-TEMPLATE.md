> **Source**: agent_docs/architecture.md + cross-cutting files | **Last synced**: {{sync_timestamp}}

# System Architecture — {{project_name}}

## 1. Architecture Overview

{{architecture_narrative}}

**Style**: {{architecture_style}}
**Rationale**: {{architecture_rationale}}
{{#has_adrs}}
**Key ADR**: [{{architecture_adr_ref}}](../../agent_docs/adrs/{{architecture_adr_filename}})
{{/has_adrs}}

## 2. C4 System Context (Level 1)

{{#c4_context_mermaid}}
```mermaid
{{c4_context_mermaid}}
```
{{/c4_context_mermaid}}
{{^c4_context_mermaid}}
_No C4 Context diagram available._
{{/c4_context_mermaid}}

## 3. C4 Container Diagram (Level 2)

{{#c4_container_mermaid}}
```mermaid
{{c4_container_mermaid}}
```
{{/c4_container_mermaid}}
{{^c4_container_mermaid}}
_No C4 Container diagram available._
{{/c4_container_mermaid}}

{{#component_diagrams}}
### 3.{{component_index}} {{component_name}}

```mermaid
{{component_mermaid}}
```
{{/component_diagrams}}

## 4. Service Landscape

| Service | Stack | Responsibilities | Key Dependencies |
|---------|-------|-----------------|------------------|
{{#services}}
| {{name}} | {{stack}} | {{responsibilities}} | {{dependencies}} |
{{/services}}

## 5. Communication Patterns

| Pattern | Technology | Use Case |
|---------|-----------|----------|
{{#communication_patterns}}
| {{pattern}} | {{technology}} | {{use_case}} |
{{/communication_patterns}}

## 6. Data Architecture

{{data_architecture_summary}}

| Data Store | Owner Service | Accessed By | Strategy |
|------------|-------------|-------------|----------|
{{#data_stores}}
| {{store}} | {{owner}} | {{accessed_by}} | {{strategy}} |
{{/data_stores}}

## 7. Error Handling

{{#error_handling_summary}}
{{error_handling_summary}}
{{/error_handling_summary}}
{{^error_handling_summary}}
_Error handling strategy not yet defined._
{{/error_handling_summary}}

> Chi tiết: [`agent_docs/error-handling.md`](../../agent_docs/error-handling.md) — error taxonomy, HTTP mapping, logging matrix, frontend contract

## 8. Caching Strategy

{{#caching_summary}}
{{caching_summary}}
{{/caching_summary}}
{{^caching_summary}}
_Caching strategy not yet defined._
{{/caching_summary}}

> Chi tiết: [`agent_docs/caching-strategy.md`](../../agent_docs/caching-strategy.md) — L0-L3 cache layers, invalidation, stampede prevention, Redis config

## 9. Frontend Architecture

{{#frontend_summary}}
{{frontend_summary}}
{{/frontend_summary}}
{{^frontend_summary}}
_Frontend architecture not yet defined._
{{/frontend_summary}}

> Chi tiết: [`agent_docs/frontend-architecture.md`](../../agent_docs/frontend-architecture.md) — rendering strategy, state management, auth, error boundaries, i18n

## 10. Frontend Test Strategy

{{#frontend_test_summary}}
{{frontend_test_summary}}
{{/frontend_test_summary}}
{{^frontend_test_summary}}
_Frontend test strategy not yet defined._
{{/frontend_test_summary}}

> Chi tiết: [`agent_docs/frontend-test-strategy.md`](../../agent_docs/frontend-test-strategy.md) — test pyramid, Vitest + Playwright + MSW, coverage targets

## 11. Performance

{{#performance_summary}}
{{performance_summary}}
{{/performance_summary}}
{{^performance_summary}}
_Performance targets not yet defined._
{{/performance_summary}}

> Chi tiết: [`agent_docs/performance-test.md`](../../agent_docs/performance-test.md) — NFR targets, 5 test types, pass-fail assertions

## 12. Infrastructure & Observability

{{#infra_summary}}
{{infra_summary}}
{{/infra_summary}}
{{^infra_summary}}
_Infrastructure details not specified._
{{/infra_summary}}

{{#observability_table}}
| Pillar | Technology | Purpose |
|--------|-----------|---------|
{{#pillars}}
| **{{pillar}}** | {{technology}} | {{purpose}} |
{{/pillars}}
{{/observability_table}}

## 13. Architecture Decision Records

| ADR | Decision | Status | Full Spec |
|-----|----------|--------|-----------|
{{#adrs}}
| {{adr_id}} | {{title}} | {{status}} | [→](../../agent_docs/adrs/{{adr_filename}}) |
{{/adrs}}
{{^adrs}}
_No architectural decisions yet._
{{/adrs}}

## 14. Hard Boundaries

{{#hard_boundaries_summary}}
{{hard_boundaries_summary}}
{{/hard_boundaries_summary}}
{{^hard_boundaries_summary}}
_No hard boundaries defined._
{{/hard_boundaries_summary}}

> Danh sách đầy đủ: [`agent_docs/hard-boundaries.md`](../../agent_docs/hard-boundaries.md)
