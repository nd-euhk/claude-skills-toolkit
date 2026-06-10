# Security Review — Workflow & Checklist

Tài liệu tham khảo cho security review dimension. Dùng bởi main agent để hiểu scope và bởi subagent `review-mr-security` khi thực thi.

## Workflow Overview

### 1. Secret Detection (Always First)
Scan toàn bộ diff với regex patterns cho: API keys, tokens, passwords, private keys, JWT secrets, connection strings, AWS keys, GitHub tokens. **CRITICAL** nếu tìm thấy bất kỳ secret nào.

### 2. OWASP Top 10 Assessment
Đánh giá từng changed file qua 10 categories:

| ID | Category | Key Checks |
|----|----------|------------|
| A01 | Broken Access Control | Missing auth, IDOR, CORS |
| A02 | Cryptographic Failures | Weak algorithms, hardcoded keys |
| A03 | Injection | SQL, NoSQL, XSS, Command, SSTI |
| A04 | Insecure Design | Missing rate limiting, client-side auth |
| A05 | Security Misconfiguration | Debug mode, default creds, verbose errors |
| A06 | Vulnerable Components | Known CVEs, unpinned versions |
| A07 | Auth Failures | Weak passwords, missing MFA, JWT issues |
| A08 | Data Integrity | Unsafe deserialization, missing checksums |
| A09 | Logging Failures | Missing audit logs, PII in logs |
| A10 | SSRF | User-controlled URLs, missing validation |

### 3. Auth/Authz Deep Dive
Nếu MR thay đổi auth: middleware chains đầy đủ? Permission checks granular? Token handling secure? Session management đúng? OAuth flow correct?

### 4. Data Exposure Check
PII trong logs? Error messages leak info? API responses over-fetching? File upload security?

### 5. Dependency Vulnerability Check
Nếu dependency files thay đổi: packages mới có known CVE? Version pinning đúng? Typosquatting check?

## Checklist

### Secret Detection
- [ ] Scan API keys: `/api[_-]?key|apikey|api_secret/`
- [ ] Scan tokens: `/token|access_token|auth_token|bearer/`
- [ ] Scan passwords: `/password|passwd|pwd/`
- [ ] Scan private keys: `/-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/`
- [ ] Scan JWT secrets: `/jwt[_-]?secret|secret[_-]?key/`
- [ ] Scan connection strings: `/mongodb|postgresql|mysql|redis:\/\/[^'"\s]+@/`
- [ ] Scan AWS keys: `/AKIA[0-9A-Z]{16}/`
- [ ] Scan GitHub tokens: `/gh[pous]_[A-Za-z0-9]{36}/`
→ Có secret? **CRITICAL** ngay lập tức.

### OWASP Top 10
- [ ] **A01 — Broken Access Control**: Missing auth? IDOR? CORS misconfig?
- [ ] **A02 — Cryptographic Failures**: Hardcoded keys? Weak algorithms? Custom crypto?
- [ ] **A03 — Injection**: SQL/NoSQL/Command/XSS/SSTI/Path traversal?
- [ ] **A04 — Insecure Design**: Missing rate limiting? Client-side decisions?
- [ ] **A05 — Security Misconfiguration**: Debug mode? Default creds? Verbose errors?
- [ ] **A06 — Vulnerable Components**: Known CVEs? Unpinned versions? EOL components?
- [ ] **A07 — Auth Failures**: Weak password? Missing MFA? JWT no expiration?
- [ ] **A08 — Data Integrity**: Unsafe deserialization? Missing checksums?
- [ ] **A09 — Logging Failures**: Missing audit logs? PII in logs?
- [ ] **A10 — SSRF**: User-controlled URLs? Missing allowlisting?

### Auth/Authz
- [ ] Middleware chains đầy đủ?
- [ ] Permission checks granular?
- [ ] Token handling secure?
- [ ] Session management đúng?

### Data Exposure
- [ ] PII trong logs?
- [ ] Error messages leak info?
- [ ] API over-fetching?
- [ ] File upload security?

## Verdict Decision Tree
```
Có secret leak? → CRITICAL
Có SQL/command injection? → CRITICAL
Có auth bypass? → CRITICAL
Có XSS/SSTI/path traversal? → HIGH
Có weak crypto? → HIGH
Có PII exposure? → HIGH
Có missing rate limit? → MEDIUM
Có debug mode enabled? → MEDIUM
Không có vấn đề gì → APPROVED
```
