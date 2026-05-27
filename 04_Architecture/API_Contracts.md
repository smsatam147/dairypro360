# API_Contracts.md — DairyPro 360 REST API Contracts
**Solution Architect Agent (Agent 7) | SAD-DMS-2025-001 | Version 1.0**

---

## Global Conventions

### Base URL
```
Development:  http://localhost:8000/api/v1/
Production:   https://dairypro360.yourdomain.com/api/v1/
```

### Standard Response Envelope
```json
{
  "status": "success" | "error",
  "data": { ... } | [ ... ] | null,
  "message": "Human-readable message",
  "errors": { "field_name": ["error detail"] }
}
```

### Pagination (all list endpoints)
```
GET /api/v1/cattle/?page=1&page_size=25
```
```json
{
  "status": "success",
  "data": {
    "count": 150,
    "next": "/api/v1/cattle/?page=2&page_size=25",
    "previous": null,
    "results": [ ... ]
  }
}
```

### Authentication
```
Authorization: Bearer <access_token>
```
Access token TTL: **15 minutes**. Refresh token TTL: **7 days** (httpOnly cookie).

---

## 1. Authentication

### POST /api/v1/auth/login/
**Request:**
```json
{
  "email": "farmmanager@dairypro.com",
  "password": "SecurePass@123"
}
```
**Response 200 OK:**
```json
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "farmmanager@dairypro.com",
      "full_name": "Ramesh Patil",
      "role": "farm_manager"
    }
  },
  "message": "Login successful"
}
```
**Response 401 — Invalid credentials:**
```json
{ "status": "error", "message": "Invalid email or password.", "data": null, "errors": {} }
```
**Response 423 — Account locked:**
```json
{ "status": "error", "message": "Account locked. Contact Super Admin.", "data": null, "errors": {} }
```

---

### POST /api/v1/auth/refresh/
Reads `refresh_token` from httpOnly cookie. Returns new `access_token`.

**Response 200:**
```json
{ "status": "success", "data": { "access_token": "eyJ..." }, "message": "Token refreshed" }
```
**Response 401:** `{ "status": "error", "message": "Refresh token expired or invalid." }`

---

### POST /api/v1/auth/logout/
Blacklists the refresh token. Clears httpOnly cookie.

**Response 204 No Content**

---

## 2. Cattle

### GET /api/v1/cattle/
**Auth:** Bearer | **Role:** Farm Manager, Vet, Viewer+

**Query Params:** `?status=Active&breed=Holstein&page=1&page_size=25`

**Response 200:**
```json
{
  "status": "success",
  "data": {
    "count": 42,
    "results": [
      {
        "id": "uuid",
        "tag_number": "DM-001",
        "name": "Ganga",
        "breed": "Holstein",
        "status": "Lactating",
        "date_of_birth": "2021-03-15",
        "age_months": 38
      }
    ]
  }
}
```

---

### POST /api/v1/cattle/
**Auth:** Bearer | **Role:** Farm Manager

**Request:**
```json
{
  "tag_number": "DM-050",
  "name": "Kaveri",
  "breed": "Gir",
  "date_of_birth": "2022-06-10",
  "status": "Active",
  "purchase_date": "2024-01-15",
  "purchase_price": 45000.00
}
```
**Response 201 Created:**
```json
{ "status": "success", "data": { "id": "uuid", "tag_number": "DM-050", ... }, "message": "Cattle added successfully." }
```
**Response 409 Conflict:** `{ "status": "error", "message": "Tag number DM-050 already exists." }`

---

### GET /api/v1/cattle/{id}/
**Response 200:** Full cattle object including latest health record, vaccination due date.

### PUT /api/v1/cattle/{id}/
**Role:** Farm Manager. Returns updated object.

### DELETE /api/v1/cattle/{id}/
**Role:** Farm Manager
**Request:** `{ "reason": "Sold" | "Deceased" }`
Sets `is_active=False`, `deleted_at=now()`, records reason in audit_log.
**Response 204 No Content**
**Response 400:** `{ "errors": { "reason": ["Valid values: Sold, Deceased"] } }`

---

## 3. Milk Collection

### POST /api/v1/milk/collections/
**Auth:** Bearer | **Role:** Field Worker, Farm Manager

**Request:**
```json
{
  "cattle_id": "uuid",
  "collection_date": "2025-07-15",
  "shift": "Morning",
  "quantity_litres": 12.5,
  "fat_percentage": 4.2,
  "snf_percentage": 8.6,
  "temperature_celsius": 36.5
}
```
**Response 201:**
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "quality_grade": "A",
    "yield_alert": null
  },
  "message": "Milk collection recorded."
}
```
**Response 403 Forbidden:** `{ "message": "Cattle DM-001 is not in Active or Lactating status." }`
**Response 409 Conflict:** `{ "message": "Collection already recorded for DM-001 on 2025-07-15 (Morning shift)." }`

---

### GET /api/v1/milk/summary/daily/
**Query Params:** `?date=2025-07-15`

**Response 200:**
```json
{
  "status": "success",
  "data": {
    "date": "2025-07-15",
    "total_litres": 487.5,
    "morning_litres": 262.0,
    "evening_litres": 225.5,
    "cattle_count": 38,
    "avg_fat_pct": 4.1,
    "avg_snf_pct": 8.5,
    "grade_breakdown": { "A": 35, "B": 3, "C": 0, "Rejected": 0 }
  }
}
```

---

### POST /api/v1/milk/collections/sync/
**Role:** Field Worker. Batch offline sync.

**Request:**
```json
{
  "entries": [
    { "cattle_id": "uuid", "collection_date": "...", "shift": "Morning", "quantity_litres": 10.0, ... }
  ]
}
```
**Response 207 Multi-Status:**
```json
{
  "status": "partial",
  "data": {
    "accepted": 8,
    "rejected": 1,
    "conflicts": [
      { "entry_index": 3, "reason": "Duplicate entry for shift Morning on 2025-07-15" }
    ]
  }
}
```

---

## 4. Inventory

### GET /api/v1/inventory/items/
**Query Params:** `?category=Feed&low_stock=true`

### POST /api/v1/inventory/items/
```json
{
  "item_code": "FD-001",
  "name": "Bajra Feed",
  "category": "Feed",
  "unit": "kg",
  "reorder_level": 200,
  "unit_cost": 18.50
}
```

### POST /api/v1/inventory/transactions/
**Role:** Farm Manager
```json
{
  "item_id": "uuid",
  "txn_type": "Purchase",
  "quantity": 500,
  "unit_cost": 18.50,
  "reference_no": "PO-2025-0041"
}
```
**Response 201:** Returns updated `quantity_on_hand`.
**Response 422:** `{ "errors": { "quantity": ["Transaction would result in negative stock."] } }`

---

## 5. Sales & Invoicing

### POST /api/v1/sales/orders/
```json
{
  "customer_id": "uuid",
  "order_date": "2025-07-15",
  "lines": [
    { "item_id": "uuid", "quantity": 100, "unit_price": 52.00 }
  ]
}
```

### POST /api/v1/sales/invoices/
**Role:** Accountant
```json
{
  "order_id": "uuid",
  "due_date": "2025-07-30",
  "hsn_code": "0402",
  "is_interstate": false,
  "cgst_rate": 2.5,
  "sgst_rate": 2.5
}
```
**Response 201:**
```json
{
  "data": {
    "invoice_number": "INV-2025-0715-0001",
    "subtotal": 5200.00,
    "cgst_amount": 130.00,
    "sgst_amount": 130.00,
    "total_amount": 5460.00
  }
}
```

---

## 6. HR & Payroll

### POST /api/v1/hr/payroll-runs/
**Role:** Accountant
```json
{ "month": 7, "year": 2025 }
```
Triggers Celery task to compute payroll for all active employees. Returns task ID.

**Response 202 Accepted:**
```json
{ "status": "success", "data": { "run_id": "uuid", "task_id": "celery-uuid" }, "message": "Payroll calculation started." }
```

### GET /api/v1/hr/payroll-runs/{id}/
Returns full payroll run with all lines.

### POST /api/v1/hr/payroll-runs/{id}/approve/
**Role:** Accountant (or Super Admin). Changes status to Approved.

---

## 7. Finance

### POST /api/v1/finance/journal-entries/
**Role:** Accountant
```json
{
  "entry_date": "2025-07-15",
  "description": "Sales Invoice INV-2025-0715-0001 payment received",
  "reference_type": "Invoice",
  "reference_id": "uuid",
  "lines": [
    { "account_id": "uuid-cash-account", "debit": 5460.00, "credit": 0 },
    { "account_id": "uuid-accounts-receivable", "debit": 0, "credit": 5460.00 }
  ]
}
```
**Response 422 — Unbalanced entry:**
```json
{ "errors": { "lines": ["Journal entry is unbalanced: debit 5460.00 != credit 5200.00"] } }
```

---

## 8. Reports & Dashboard

### GET /api/v1/reports/dashboard/
**Cache:** 60 seconds per role.

**Response 200:**
```json
{
  "data": {
    "today_milk_litres": 487.5,
    "active_cattle": 42,
    "open_invoices": 3,
    "open_invoices_value": 45200.00,
    "low_stock_items": 2,
    "pending_vaccinations": 5,
    "monthly_revenue": 182500.00,
    "monthly_expenses": 97300.00
  }
}
```

### GET /api/v1/reports/audit-log/
**Role:** Super Admin only.
**Query Params:** `?user_id=&action=&resource_type=cattle&date_from=&date_to=`

---

## Error Code Reference

| HTTP Code | Meaning | When Used |
|---|---|---|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST |
| 202 | Accepted | Async task started |
| 204 | No Content | Successful DELETE, Logout |
| 207 | Multi-Status | Batch sync (partial success) |
| 400 | Bad Request | Invalid input not caught by serializer |
| 401 | Unauthorized | Missing or invalid JWT |
| 403 | Forbidden | Valid JWT but insufficient role |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate record |
| 422 | Unprocessable Entity | Validation error (serializer) |
| 423 | Locked | Account locked after 5 failed logins |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception (logged) |

---

*API_Contracts.md | Solution Architect Agent | DairyPro 360 | v1.0*
