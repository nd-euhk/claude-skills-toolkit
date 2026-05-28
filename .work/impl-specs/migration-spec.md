---
doc_type: MigrationSpec
domain: AUTH
version: 1.0.0
status: draft
---

# Migration Spec: Auth Service Database Schema

## Tables

### 1. users
Primary store for user accounts.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary identifier |
| email | VARCHAR(254) | UNIQUE, NOT NULL, INDEXED | Normalized (lowercase, trimmed) |
| password_hash | TEXT | NOT NULL | argon2id output |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'unverified' | enum: unverified, verified, deactivated |
| failed_login_count | INTEGER | NOT NULL, DEFAULT 0 | Atomic increment/decrement |
| locked_until | TIMESTAMPTZ | NULLABLE | NULL = not locked |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Trigger-updated |

Indexes:
- `idx_users_email` on email (unique lookup)
- `idx_users_status` on status (filter by status)

### 2. verification_tokens
One-time tokens for email verification.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK -> users(id), NOT NULL, INDEXED | |
| token_hash | VARCHAR(64) | NOT NULL, INDEXED | HMAC-SHA256 of raw token |
| expires_at | TIMESTAMPTZ | NOT NULL | created_at + 24 hours |
| used_at | TIMESTAMPTZ | NULLABLE | NULL = unused |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

Indexes:
- `idx_vt_user_id` on user_id
- `idx_vt_token_hash` on token_hash (lookup)
- `idx_vt_user_unused` on user_id WHERE used_at IS NULL (invalidation)

### 3. reset_tokens
One-time tokens for password reset.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| user_id | UUID | FK -> users(id), NOT NULL, INDEXED | |
| token_hash | VARCHAR(64) | NOT NULL, INDEXED | HMAC-SHA256 |
| expires_at | TIMESTAMPTZ | NOT NULL | created_at + 30 minutes |
| used_at | TIMESTAMPTZ | NULLABLE | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

Indexes:
- `idx_rt_user_id` on user_id
- `idx_rt_token_hash` on token_hash
- `idx_rt_user_unused` on user_id WHERE used_at IS NULL

### 4. idempotency_keys
Stores idempotency key -> response mapping.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK | |
| key_hash | VARCHAR(64) | UNIQUE, NOT NULL, INDEXED | HMAC-SHA256 of key |
| response_body | TEXT | NOT NULL | Serialized response |
| expires_at | TIMESTAMPTZ | NOT NULL | created_at + 24 hours |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

## Migration Order
1. Create users table
2. Create verification_tokens table (FK -> users)
3. Create reset_tokens table (FK -> users)
4. Create idempotency_keys table

## Rollback
Reverse creation order: 4, 3, 2, 1. DROP TABLE CASCADE handles FK dependencies.
