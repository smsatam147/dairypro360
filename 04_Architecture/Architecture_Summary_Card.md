# Architecture Summary Card — DairyPro 360
**Solution Architect Agent (Agent 7) | One-Page Quick Reference | v1.0**

---

```
┌─────────────────────────────────────────────────────────────────┐
│              DairyPro 360 — Architecture at a Glance            │
│                  Solution Architect Agent | v1.0                │
└─────────────────────────────────────────────────────────────────┘
```

## Stack

| Layer | Choice | Version |
|---|---|---|
| Frontend | React + Tailwind CSS | 18.x / 3.x |
| Backend | Django + DRF | 4.2 LTS / 3.14 |
| Database | PostgreSQL | 15.x |
| Cache / Queue Broker | Redis | 7.x |
| Task Queue | Celery | 5.x |
| Auth | JWT (PyJWT) + Argon2id | 2.x / 21.x |
| Proxy | Nginx | 1.24 |
| Containers | Docker Compose | 24.x |

---

## Architecture Pattern
**Layered Monolith** — React SPA → Nginx → Django DRF → PostgreSQL + Redis

---

## Django Apps (9)

```
dairypro/
├── core/       User, Role, AuditLog, LoginAttempt
├── cattle/     Cattle, HealthRecord, Vaccination, BreedingRecord
├── milk/       MilkCollection, QualityRecord, YieldAlert
├── inventory/  InventoryItem, StockTransaction
├── sales/      Customer, SalesOrder, Invoice, Delivery
├── hr/         Employee, AttendanceRecord, PayrollRun, PayrollLine
├── finance/    Account (CoA), JournalEntry, JournalLine
├── accounts/   PasswordResetToken, LoginAttempt helpers
└── reports/    DashboardKPI, ReportSnapshot
```

---

## RBAC (6 Roles)

| Role | Key Access |
|---|---|
| Super Admin | Everything + User management + Audit Log |
| Farm Manager | Cattle + Milk + Inventory + Reports |
| Accountant | Finance + Invoices + Payroll + Reports |
| Field Worker | Milk entry (own sessions only) |
| Vet | Cattle health + Vaccinations |
| Viewer | Dashboard read-only |

---

## Key Constraints (non-negotiable)

| Constraint | Enforcement |
|---|---|
| No negative stock | `CHECK (quantity_on_hand >= 0)` at PostgreSQL level |
| No duplicate milk entry | `UNIQUE (cattle_id, date, shift)` index |
| No milk from inactive cattle | Application 403 + FK status check |
| Double-entry balance | Service layer validates debit == credit before DB commit |
| Immutable audit log | PostgreSQL BEFORE UPDATE/DELETE trigger raises exception |
| Tax exclusivity (GST) | `CHECK NOT (igst > 0 AND (cgst > 0 OR sgst > 0))` |
| Payroll non-negative | `CHECK (net_pay >= 0)` on payroll_lines |

---

## Auth Flow (Quick)

```
Login → access_token (memory, 15min) + refresh_token (httpOnly cookie, 7d)
         ↓ 401 received
    Silent POST /auth/refresh/ → new access_token
         ↓ Logout
    Redis blacklist refresh_token
```

---

## Async Operations (Celery)

| Task | Trigger | Timing |
|---|---|---|
| Payroll calculation | POST /hr/payroll-runs/ | On demand (202 Accepted) |
| Invoice PDF | POST /sales/invoices/ | On demand, 2-5s |
| Yield alert emails | Milk collection saved | Near-real-time |
| Reorder alerts | Stock transaction saved | Near-real-time |
| Nightly digest email | Celery Beat cron | 07:00 AM daily |
| DB backup to S3 | Celery Beat cron | 02:00 AM daily |

---

## Offline Sync

Field Worker milk entries → **IndexedDB** (offline) → POST /milk/collections/sync/ (online) → 207 Multi-Status with conflict detail

---

## Compliance Checklist

- [x] FSSAI — immutable collection log, 5-year retention
- [x] GST — HSN 0402, CGST/SGST/IGST exclusive, invoice number format INV-YYYY-MMDD-NNNN
- [x] PF/ESI — 12%/12% PF, 0.75%/3.25% ESI, statutory enforcement
- [x] DPDP 2023 — no PII in logs, UUID IDs, data deletion endpoint
- [x] Income Tax — 8-year financial record retention, double-entry books

---

## Key Numbers

| Metric | Target |
|---|---|
| API p95 response time | ≤ 500ms |
| Dashboard load (cached) | ≤ 200ms |
| System uptime | ≥ 99.5% |
| Test coverage (backend) | ≥ 80% |
| Concurrent users supported | 100 |
| Max cattle without degradation | 500 |

---

## Files Produced by Agent 7

| File | Purpose |
|---|---|
| `04_Architecture/SAD_v1.docx` | Full System Architecture Document |
| `04_Architecture/DB_Schema.md` | All PostgreSQL table definitions |
| `04_Architecture/API_Contracts.md` | All endpoint request/response specs |
| `04_Architecture/NFR_Document.md` | Measurable non-functional requirements |
| `04_Architecture/ADR_Log.md` | 9 architecture decision records |
| `04_Architecture/Architecture_Summary_Card.md` | This file |

---

*Architecture Summary Card | Solution Architect Agent | DairyPro 360 | v1.0*
