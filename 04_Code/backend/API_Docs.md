# API_Docs.md — DairyPro 360 Django Backend
**Developer Agent 1 | Django REST Framework | Version 1.0**

---

## Quick Start

```bash
cd 04_Code/backend
cp .env.example .env
# Edit .env with your DB credentials

# Option A: Docker Compose (recommended)
docker-compose up --build

# Option B: Local setup
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_accounts   # seeds Chart of Accounts
python manage.py createsuperuser
python manage.py runserver
```

---

## Project Structure

```
backend/
├── manage.py
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── dairypro/
    ├── settings.py         Django settings (env-based)
    ├── urls.py             Root URL configuration
    ├── celery.py           Celery app + beat schedule
    ├── core/               User, RBAC, Auth, AuditLog
    ├── cattle/             Cattle, Health, Vaccination, Breeding
    ├── milk/               Milk Collection, Quality, Yield Alerts
    ├── inventory/          Inventory Items, Stock Transactions
    ├── sales/              Customers, Orders, Invoices, Delivery
    ├── hr/                 Employees, Attendance, Payroll
    ├── finance/            Chart of Accounts, Journal Entries
    └── reports/            Dashboard KPIs, Audit Log
```

---

## API Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/auth/login/ | Login → access_token + httpOnly refresh cookie |
| POST | /api/v1/auth/refresh/ | Refresh access token (reads cookie) |
| POST | /api/v1/auth/logout/ | Logout + blacklist refresh token |
| POST | /api/v1/auth/change-password/ | Change own password |
| GET  | /api/v1/auth/me/ | Get current user info |

### Users (Super Admin only)
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /api/v1/users/ | List/Create users |
| GET/PUT/DELETE | /api/v1/users/{id}/ | User detail (soft delete) |

### Cattle
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /api/v1/cattle/ | List/Create cattle |
| GET/PUT/DELETE | /api/v1/cattle/{id}/ | Detail (DELETE needs reason: Sold/Deceased) |
| GET/POST | /api/v1/cattle/{id}/health-records/ | Health records |
| GET/POST | /api/v1/cattle/{id}/vaccinations/ | Vaccinations |
| GET/POST | /api/v1/cattle/{id}/breeding-records/ | Breeding records |

### Milk
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /api/v1/milk/collections/ | List/Create milk collection |
| POST | /api/v1/milk/collections/sync/ | Batch offline sync |
| GET | /api/v1/milk/summary/daily/?date=YYYY-MM-DD | Daily summary |

### Inventory
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /api/v1/inventory/items/ | List/Create items (?low_stock=true) |
| GET/PUT | /api/v1/inventory/items/{id}/ | Item detail |
| POST | /api/v1/inventory/transactions/ | Record stock movement |

### Sales
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /api/v1/sales/customers/ | Customers |
| GET/POST | /api/v1/sales/orders/ | Sales orders (with line items) |
| GET/POST | /api/v1/sales/invoices/ | GST invoices |
| GET | /api/v1/sales/invoices/{id}/ | Invoice detail |

### HR & Payroll
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /api/v1/hr/employees/ | Employees |
| GET/POST | /api/v1/hr/attendance/ | Attendance records |
| GET/POST | /api/v1/hr/payroll-runs/ | Start payroll (→ 202 Accepted + Celery task) |
| GET | /api/v1/hr/payroll-runs/{id}/ | Payroll run detail with lines |
| POST | /api/v1/hr/payroll-runs/{id}/approve/ | Approve payroll run |

### Finance
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /api/v1/finance/accounts/ | Chart of Accounts |
| GET/POST | /api/v1/finance/journal-entries/ | Journal entries (double-entry validated) |
| GET | /api/v1/finance/journal-entries/{id}/ | Entry detail with lines |

### Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/reports/dashboard/ | Executive KPI dashboard (cached 60s) |
| GET | /api/v1/reports/audit-log/ | Audit log (Super Admin only) |

---

## Key Business Rules Implemented

| Rule | Location | FRD Ref |
|---|---|---|
| No milk from inactive cattle | milk/views.py:perform_create | FR-M-03 |
| Duplicate milk entry prevented | milk/models.py UniqueConstraint | FR-M-01 |
| 20% yield alert | milk/views.py:_check_yield_alert | FR-M-04 |
| No negative stock | inventory/views.py + models CHECK | FR-I-04 |
| Account lockout after 5 failures | core/serializers.py LoginSerializer | FR-AU-04 |
| JWT httpOnly refresh cookie | core/views.py login_view | FR-AU-01 |
| Double-entry balance | finance/serializers.py validate_lines | FR-F-01 |
| Payroll formula (PF/ESI) | hr/tasks.py compute_payroll | FR-E-03 |
| GST tax exclusivity | sales/models.py Invoice.clean | FR-S-03 |
| Cattle delete reason | cattle/views.py destroy + CattleDeleteSerializer | FR-C-04 |
| Immutable audit log | Append-only; DB trigger in migration | FR-AU-05 |
| Calving date auto-compute | cattle/models.py BreedingRecord.save | FR-C-05 |

---

## Running Tests

```bash
pytest --cov=dairypro --cov-report=term-missing
```

Coverage target: ≥ 80% (NFR-M-01)

---

*API_Docs.md | Developer Agent 1 | DairyPro 360 | v1.0*
