# ADR_Log.md — Architecture Decision Records
**Solution Architect Agent (Agent 7) | DairyPro 360 | Version 1.0**

---

Architecture Decision Records (ADRs) document every significant architectural choice, the alternatives considered, and the rationale. This log is immutable — once accepted, ADRs are never deleted; superseded ADRs are marked as such.

---

## ADR-001: Backend Framework — Django REST Framework over Node.js/Express

**Date:** 2025-07-15
**Status:** Accepted
**Deciders:** Solution Architect Agent, Project Manager

### Context
The Phase 1 backend was built in Node.js/Express. The updated pipeline specifies Python as the backend language. A framework must be selected.

### Decision
Use **Django 4.2 LTS + Django REST Framework (DRF) 3.14**.

### Alternatives Considered
| Option | Pros | Cons |
|---|---|---|
| Django + DRF | ORM, migrations, admin, serializers, ViewSets — batteries included. LTS support until April 2026. | Slightly more boilerplate than Flask for simple APIs. |
| FastAPI | Async, auto-generated OpenAPI docs, fast | No ORM, no admin, manual migrations, less mature ecosystem |
| Flask + SQLAlchemy | Flexible, lightweight | Every component chosen separately; more integration work |

### Rationale
Django's ORM, migration system, admin panel, and DRF's serializers + ViewSets reduce boilerplate significantly for a domain with 9+ models. LTS version ensures security patches through project lifetime.

### Consequences
- Developers must follow Django project structure (apps, models, views, serializers, urls)
- Django admin panel available for Super Admin out-of-the-box
- Must use Django ORM; raw SQL restricted to reporting queries only

---

## ADR-002: Database — PostgreSQL over MySQL/SQLite

**Date:** 2025-07-15
**Status:** Accepted

### Context
A relational database is required. Multiple options exist.

### Decision
Use **PostgreSQL 15**.

### Alternatives Considered
| Option | Pros | Cons |
|---|---|---|
| PostgreSQL | ACID, CHECK constraints, UUID support, JSONB, row-level security, pg_dump | Heavier than MySQL for tiny deployments |
| MySQL 8 | Widely hosted, familiar | Looser type checking; JSONB less mature; UUID type added late |
| SQLite | Zero config | Not suitable for concurrent multi-user production use |

### Rationale
- `CHECK (quantity_on_hand >= 0)` enforced at DB level (FR-I-04)
- `UNIQUE(cattle_id, date, shift)` prevents duplicate milk entries (FR-M-01)
- Immutable audit log trigger requires PostgreSQL-level trigger support
- JSONB for audit_log old_values/new_values stores arbitrary model state efficiently

### Consequences
- Docker Compose includes postgres:15-alpine service
- Production deployment requires PostgreSQL 15 host
- All money fields DECIMAL(14,2) — never FLOAT

---

## ADR-003: Authentication — JWT with httpOnly Refresh Cookie

**Date:** 2025-07-15
**Status:** Accepted

### Context
The system requires secure, stateless authentication with role information embedded in the token.

### Decision
Use **PyJWT** for JWT generation. Access token stored in memory (JavaScript variable). Refresh token stored in **httpOnly, Secure, SameSite=Strict cookie**.

### Alternatives Considered
| Option | Pros | Cons |
|---|---|---|
| JWT in localStorage | Simple | Vulnerable to XSS — any injected script can steal token |
| Session-based (Django sessions) | Simpler, no token management | Stateful — doesn't scale horizontally without sticky sessions |
| JWT in memory + httpOnly refresh | Secure against XSS; refresh token theft requires CSRF or physical access | Slightly more complex Axios interceptor |

### Rationale
OWASP recommends never storing JWTs in localStorage. httpOnly cookies cannot be read by JavaScript. Access tokens expire in 15 minutes, limiting damage if intercepted. Refresh token rotation means a used token is immediately blacklisted.

### Consequences
- Axios interceptor must handle 401 → silent refresh → retry original request
- Redis required for refresh token blacklist (logout invalidation)
- CSRF protection required on cookie endpoints (Django CSRF middleware)

---

## ADR-004: Password Hashing — Argon2id over bcrypt

**Date:** 2025-07-15
**Status:** Accepted

### Context
User passwords must be securely hashed. Multiple algorithms exist.

### Decision
Use **argon2-cffi** (Argon2id variant) via Django's `Argon2PasswordHasher`.

### Rationale
OWASP Password Storage Cheat Sheet (2024) recommends Argon2id as the first choice for new systems. It is memory-hard, making GPU-based brute-force attacks significantly more expensive than bcrypt. Django supports Argon2 natively when argon2-cffi is installed.

### Consequences
- `argon2-cffi` added to requirements.txt
- `PASSWORD_HASHERS = ['django.contrib.auth.hashers.Argon2PasswordHasher', ...]` in settings.py
- Existing bcrypt hashes (Phase 1) automatically re-hashed on next login

---

## ADR-005: Primary Keys — UUID v4 over Auto-increment Integer

**Date:** 2025-07-15
**Status:** Accepted

### Context
Every table needs a primary key strategy.

### Decision
All primary keys use **UUID v4** (`uuid_generate_v4()`).

### Alternatives Considered
| Option | Pros | Cons |
|---|---|---|
| Auto-increment integer (SERIAL) | Simple, small, fast index | Enumerable — attacker can guess IDs; reveals record count |
| UUID v4 | Non-enumerable; no information leak; merge-safe across environments | Larger index (16 bytes vs 4); slightly slower index scan |

### Rationale
The DPDP Act 2023 and general security hygiene require that resource IDs in API responses not be guessable. Auto-increment integers allow `/api/v1/cattle/42/` to reveal that there are at least 42 cattle records and allow iterating through all records by incrementing the ID.

### Consequences
- Django models use `models.UUIDField(primary_key=True, default=uuid.uuid4)`
- PostgreSQL `uuid-ossp` extension must be enabled: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
- Frontend code must handle UUID strings, not integers

---

## ADR-006: Task Queue — Celery over Django Q / Synchronous

**Date:** 2025-07-15
**Status:** Accepted

### Context
Payroll calculation, invoice PDF generation, email/SMS dispatch, and nightly report snapshots are long-running or time-deferred operations.

### Decision
Use **Celery 5.x with Redis as broker**.

### Rationale
- Payroll for 100 employees with attendance lookup can exceed 30 seconds — unacceptable for a synchronous HTTP response
- Invoice PDF generation via WeasyPrint takes 2-5 seconds — should not block the API response
- Celery Beat handles nightly cron tasks (daily digest email, reorder alerts, yield alert summary)
- Redis is already required for JWT blacklist, so using it as Celery broker adds no new infrastructure dependency

### Consequences
- `celery` and `redis` added to requirements.txt
- Docker Compose includes `celery` and `celery-beat` services
- API endpoints that trigger long tasks return 202 Accepted with a `task_id`; client polls for completion

---

## ADR-007: Frontend Styling — Tailwind CSS over Bootstrap / custom CSS

**Date:** 2025-07-15
**Status:** Accepted

### Decision
Use **Tailwind CSS 3.x** with utility classes only. No custom CSS files.

### Rationale
- Utility-first approach eliminates specificity conflicts and CSS bloat
- All responsive breakpoints handled via Tailwind's `sm:`, `md:`, `lg:` prefixes
- Tailwind's purge/tree-shake removes unused classes in production build — small bundle size
- Consistent design system without designing a design system from scratch
- React + Tailwind is the most requested stack in industry for 2024-2025 projects

### Consequences
- Developers must use Tailwind class names, not write CSS
- `tailwind.config.js` with `content` paths must be configured for tree-shaking
- No Bootstrap, no Material UI — only Tailwind

---

## ADR-008: Money Storage — DECIMAL(14,2) over FLOAT

**Date:** 2025-07-15
**Status:** Accepted

### Decision
All monetary values stored as `DECIMAL(14,2)` in PostgreSQL and `DecimalField(max_digits=14, decimal_places=2)` in Django models.

### Rationale
IEEE 754 floating-point arithmetic produces rounding errors: `0.1 + 0.2 = 0.30000000000000004`. In a payroll system, even 1 paisa error per employee per month compounds into material discrepancies and compliance failures. `DECIMAL` is exact. This is a non-negotiable requirement for any financial application.

### Consequences
- All `DecimalField` values serialised as strings in DRF responses to preserve precision through JSON
- Frontend must use `parseFloat()` only for display, never for arithmetic — use server-computed totals

---

## ADR-009: Deployment — Docker Compose (Phase 1)

**Date:** 2025-07-15
**Status:** Accepted

### Decision
Phase 1 deployment uses **Docker Compose** with 6 services: nginx, backend, db, redis, celery, celery-beat.

### Rationale
- Dev/prod parity: every developer runs the same environment
- Single `docker-compose up` starts the full stack
- Nginx handles TLS, static files, and proxying in one container
- Database migrations run automatically on container start
- Phase 2 can migrate to Kubernetes by splitting services — the Docker images are already containerised

### Consequences
- Production server needs Docker + Docker Compose installed
- `docker-compose.yml` and `docker-compose.prod.yml` (with env-file overrides) maintained in repo root
- No Kubernetes in Phase 1 — explicitly deferred

---

*ADR_Log.md | Solution Architect Agent | DairyPro 360 | v1.0*
