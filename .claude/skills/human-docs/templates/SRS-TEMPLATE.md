> **Source**: agent_docs/features/ ({{fr_count}} FRs, {{domain_count}} domains) | **Last synced**: {{sync_timestamp}}

# Software Requirements Specification — {{project_name}}

## 1. Introduction

### 1.1 System Purpose

{{system_purpose}}

### 1.2 Scope

**In Scope:**
{{#in_scope}}
- {{item}}
{{/in_scope}}

**Out of Scope:**
{{#out_of_scope}}
- {{item}}
{{/out_of_scope}}

### 1.3 Glossary

| Term | Definition |
|------|-----------|
{{#glossary_terms}}
| {{term}} | {{definition}} |
{{/glossary_terms}}

### 1.4 User Personas

| Persona | Role | Goals |
|---------|------|-------|
{{#personas}}
| {{name}} | {{role}} | {{goals}} |
{{/personas}}

## 2. Functional Requirements Overview

| FR ID | Feature | Domain | Priority | Sprint | Layer |
|-------|---------|--------|----------|--------|-------|
{{#fr_overview}}
| {{fr_id}} | {{title}} | {{domain}} | {{priority}} | {{sprint}} | {{layer}} |
{{/fr_overview}}

## 3. Feature Details

{{#domains}}
### 3.{{domain_index}} {{domain_name}}

{{#features}}
#### {{fr_id}} — {{title}}

**Priority:** {{priority}} | **Sprint:** {{sprint}} | **Layer:** {{layer}}

**Description:** {{description}}

**Preconditions:**
{{#preconditions}}
- {{precondition}}
{{/preconditions}}

**Process Summary:**
{{#process_steps}}
{{step_number}}. {{step_description}}
{{/process_steps}}

**Happy-Path Scenario:**
```gherkin
{{happy_path_gherkin}}
```

**Constraints:**
{{#constraints}}
- {{constraint}}
{{/constraints}}
{{^constraints}}
_No specific constraints._
{{/constraints}}

**NFR References:**
{{#nfr_references}}
- {{nfr_id}} → {{nfr_summary}}
{{/nfr_references}}
{{^nfr_references}}
_No NFR references._
{{/nfr_references}}

---
{{/features}}
{{/domains}}

## 4. Non-Functional Requirements

### 4.1 Performance

#### Backend

| NFR ID | Metric | Target | Measurement | Priority |
|--------|--------|--------|-------------|----------|
{{#nfr_perf_backend}}
| {{nfr_id}} | {{metric}} | {{target}} | {{measurement}} | {{priority}} |
{{/nfr_perf_backend}}

#### Frontend (Web Vitals)

| NFR ID | Metric | Target | Measurement | Priority |
|--------|--------|--------|-------------|----------|
{{#nfr_perf_frontend}}
| {{nfr_id}} | {{metric}} | {{target}} | {{measurement}} | {{priority}} |
{{/nfr_perf_frontend}}

### 4.2 Availability

| NFR ID | Metric | Target |
|--------|--------|--------|
{{#nfr_availability}}
| {{nfr_id}} | {{metric}} | {{target}} |
{{/nfr_availability}}

### 4.3 Security

| NFR ID | Requirement | OWASP Ref | Priority |
|--------|------------|-----------|----------|
{{#nfr_security}}
| {{nfr_id}} | {{requirement}} | {{owasp_ref}} | {{priority}} |
{{/nfr_security}}

### 4.4 Scalability

| NFR ID | Requirement | Target | Priority |
|--------|------------|--------|----------|
{{#nfr_scalability}}
| {{nfr_id}} | {{requirement}} | {{target}} | {{priority}} |
{{/nfr_scalability}}

## 5. Traceability Matrix

| Requirement (BRD/PRD) | FR ID | Test ID | Status |
|------------------------|-------|---------|--------|
{{#traceability}}
| {{requirement}} | {{fr_id}} | {{test_id}} | {{status}} |
{{/traceability}}

## 6. External Interfaces

### 6.1 API Conventions

- **Style**: {{api_style}}
- **Auth**: {{api_auth}}
- **Versioning**: {{api_versioning}}
- **Format**: {{api_format}}
- **Pagination**: {{api_pagination}}

### 6.2 Error Code Catalog

| Code | HTTP Status | Description |
|------|------------|-------------|
{{#error_codes}}
| {{code}} | {{http_status}} | {{description}} |
{{/error_codes}}

### 6.3 Event Catalog

| Event Name | Trigger | Payload Summary |
|-----------|---------|-----------------|
{{#events}}
| {{name}} | {{trigger}} | {{payload_summary}} |
{{/events}}

## 7. Constraints & Assumptions

### 7.1 Constraints

| Type | Description | Source |
|------|------------|--------|
{{#constraints_table}}
| {{type}} | {{description}} | {{source}} |
{{/constraints_table}}
{{^constraints_table}}
_No constraints specified._
{{/constraints_table}}

### 7.2 Assumptions

{{#assumptions}}
- {{assumption}}
{{/assumptions}}
{{^assumptions}}
_No assumptions documented._
{{/assumptions}}

## 8. User Journeys

{{#user_journeys}}
### {{journey_name}}

{{#steps}}
{{step_number}}. {{step_description}}
{{/steps}}

---
{{/user_journeys}}
{{^user_journeys}}
_No user journeys documented._
{{/user_journeys}}
