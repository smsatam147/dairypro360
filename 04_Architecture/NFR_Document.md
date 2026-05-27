# NFR_Document.md — Non-Functional Requirements
**Solution Architect Agent (Agent 7) | DairyPro 360 | Version 1.0**

---

## Overview

This document specifies all Non-Functional Requirements (NFRs) for DairyPro 360. Each NFR is assigned a measurable acceptance criterion, an implementation strategy, and a test approach for the QA Agent.

---

## NFR-1: Performance

| ID | Requirement | Acceptance Criterion | Implementation |
|---|---|---|---|
| NFR-P-01 | API response time for standard CRUD operations | p95 ≤ 500ms under 50 concurrent users | Django query optimisation, select_related, prefetch_related; no N+1 queries |
| NFR-P-02 | Dashboard KPI load time | ≤ 2 seconds on first load; ≤ 200ms on cached load | Redis cache 60s per role; Celery pre-computes nightly snapshots |
| NFR-P-03 | Milk collection POST | ≤ 300ms including quality grade computation | Synchronous path; no external calls |
| NFR-P-04 | Invoice PDF generation | ≤ 3 seconds per invoice | WeasyPrint async via Celery; user receives download link |
| NFR-P-05 | Payroll calculation (100 employees) | ≤ 30 seconds end-to-end | Celery task; progress tracked via run_id polling |
| NFR-P-06 | Frontend initial load (LCP) | ≤ 2.5 seconds on 4G connection | React code-splitting by route; Gzip compression at Nginx |
| NFR-P-07 | Database query time for reporting | ≤ 5 seconds for 12-month reports | PostgreSQL partial indexes; materialised views for monthly summaries |

---

## NFR-2: Scalability

| ID | Requirement | Acceptance Criterion | Implementation |
|---|---|---|---|
| NFR-SC-01 | Horizontal scaling of API layer | System supports 3 Django instances behind Nginx without session conflicts | Stateless JWT auth; shared Redis for token blacklist and cache |
| NFR-SC-02 | Database capacity | Supports 10 years of operational data (est. 5M rows/year across all tables) | UUID PKs; table partitioning on milk_collections by year in Phase 2 |
| NFR-SC-03 | Concurrent users | System remains stable with 100 concurrent users | Load-tested with Locust; Gunicorn 4 workers (expandable to 8) |
| NFR-SC-04 | Cattle herd size | No performance degradation up to 500 active cattle | Indexed queries; pagination on all list endpoints |

---

## NFR-3: Availability & Reliability

| ID | Requirement | Acceptance Criterion | Implementation |
|---|---|---|---|
| NFR-AV-01 | System uptime | ≥ 99.5% monthly uptime (Phase 1 target) | Docker health checks; Nginx upstream retry; systemd auto-restart |
| NFR-AV-02 | Database backup | Daily automated backup; RPO ≤ 24 hours | pg_dump via Celery Beat at 02:00 AM; upload to S3 |
| NFR-AV-03 | Recovery time | RTO ≤ 4 hours from full backup restore | Documented runbook; backup verified monthly with test restore |
| NFR-AV-04 | Graceful degradation | Frontend shows cached data on API timeout | Axios timeout 10s; stale-while-revalidate pattern on dashboard |
| NFR-AV-05 | Offline data entry | Field workers can record milk entries without connectivity | IndexedDB local storage; sync on reconnect via /milk/collections/sync/ |

---

## NFR-4: Security

| ID | Requirement | Acceptance Criterion | Implementation |
|---|---|---|---|
| NFR-SEC-01 | Authentication strength | Passwords stored with Argon2id; min 8 chars, 1 uppercase, 1 number, 1 special | argon2-cffi; Django custom validator |
| NFR-SEC-02 | Session security | Access tokens not stored in localStorage; no XSS token theft | JWT in memory only; refresh in httpOnly cookie |
| NFR-SEC-03 | Account lockout | Account locked after 5 failed logins in 15 minutes | Redis counter + login_attempts table; Super Admin unlock |
| NFR-SEC-04 | Transport encryption | All traffic over TLS 1.3; no HTTP fallback | Nginx TLS config; HSTS header; Let's Encrypt cert |
| NFR-SEC-05 | Role enforcement | No endpoint accessible above user's role | DRF IsRoleAllowed permission tested for every endpoint |
| NFR-SEC-06 | SQL injection prevention | Zero SQL injection vulnerabilities | Django ORM parameterised queries; raw SQL peer-reviewed |
| NFR-SEC-07 | Audit trail | All data mutations logged with user, timestamp, old/new values | audit_log table; immutable DB trigger; logged in every service |
| NFR-SEC-08 | PII protection | No passwords, tokens, or Aadhaar numbers in log files | structlog filter strips sensitive keys before output |
| NFR-SEC-09 | Rate limiting | Auth endpoint limited to 10 requests/sec per IP | Nginx limit_req_zone on /api/v1/auth/ |
| NFR-SEC-10 | CORS restriction | Only frontend origin allowed cross-origin with credentials | django-cors-headers whitelist; credentials=True |

---

## NFR-5: Compliance

| ID | Requirement | Acceptance Criterion | Standard |
|---|---|---|---|
| NFR-C-01 | GST-compliant invoicing | Invoices include GSTIN, HSN 0402, CGST/SGST or IGST (mutually exclusive), tax amount breakdown | GST Act 2017 |
| NFR-C-02 | Payroll statutory deductions | PF = 12% of basic (employer + employee); ESI = employee 0.75% + employer 3.25% of gross | EPF Act 1952, ESI Act 1948 |
| NFR-C-03 | FSSAI audit trail | Milk collection records immutable post-creation; full audit log retained 5 years | FSSAI 2006 |
| NFR-C-04 | Data privacy | No PII in server logs; user data deletion request supported | DPDP Act 2023 |
| NFR-C-05 | Financial record retention | Journal entries and invoices retained for 8 years | Income Tax Act 1961, Sec 44AA |

---

## NFR-6: Maintainability & Code Quality

| ID | Requirement | Acceptance Criterion | Implementation |
|---|---|---|---|
| NFR-M-01 | Test coverage | ≥ 80% line coverage for Django apps; ≥ 70% for React components | pytest-django with coverage; jest for frontend |
| NFR-M-02 | Code style | Zero PEP-8 violations in Python; ESLint clean in React | flake8 in CI; ESLint + Prettier pre-commit hook |
| NFR-M-03 | Documentation | All API endpoints documented in API_Contracts.md; all models documented in DB_Schema.md | Solution Architect maintains |
| NFR-M-04 | Dependency management | All Python deps pinned in requirements.txt; Node deps in package-lock.json | pip-tools; npm ci in CI |
| NFR-M-05 | Migrations | All DB changes via Django migrations; no manual ALTER TABLE | Django migration policy; reviewed before merge |

---

## NFR-7: Usability

| ID | Requirement | Acceptance Criterion |
|---|---|---|
| NFR-U-01 | Responsive design | All screens usable on tablets (768px+) and desktop (1024px+) |
| NFR-U-02 | Load feedback | All async operations show loading spinner; errors show toast notification |
| NFR-U-03 | Form validation | Inline field-level errors on submit; no page reload for validation |
| NFR-U-04 | Session timeout warning | User warned 2 minutes before token expiry; option to extend |
| NFR-U-05 | Error messages | All error messages in plain English with actionable guidance |

---

*NFR_Document.md | Solution Architect Agent | DairyPro 360 | v1.0*
