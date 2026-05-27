# DairyPro 360 — Local Setup Guide

**Version:** v1.2.0 | **No Docker needed for local dev**

---

## Quick Start (Two Double-Clicks)

**Requirements:** Python 3.11+ and Node.js 18+ installed on your computer.

1. Double-click `start_backend.bat` — installs packages, runs migrations, starts API on port 8000
2. Double-click `start_frontend.bat` (in a second window) — installs npm packages, starts React on port 3000
3. Open **http://localhost:3000** in your browser
4. Login: `admin@dairypro.com` / `Admin@123`

First run takes 2–3 minutes (installing packages). Subsequent runs start in ~5 seconds.

---

## What the Scripts Do

### `start_backend.bat`
1. Navigates to `04_Code/backend`
2. Creates Python virtual environment (`venv/`)
3. Installs packages from `requirements.txt`
4. Runs `makemigrations` + `migrate` (creates SQLite database)
5. Creates demo users (admin + 5 role-based users)
6. Starts Django dev server at `http://localhost:8000`

### `start_frontend.bat`
1. Navigates to `04_Code/frontend`
2. Runs `npm install` (installs React, Tailwind, Chart.js, etc.)
3. Starts React dev server at `http://localhost:3000`
4. API calls proxy automatically to `http://localhost:8000`

---

## Demo Credentials

| Role | Email | Password | Can Access |
|------|-------|----------|-----------|
| Super Admin | admin@dairypro.com | Admin@123 | Everything |
| Farm Manager | manager@dairypro.com | Manager@123 | Milk, Cattle, Inventory |
| Accountant | accountant@dairypro.com | Account@123 | Sales, Payroll, Reports |
| Field Worker | worker@dairypro.com | Worker@123 | Milk Collection only |
| Vet | vet@dairypro.com | Vet@123 | Cattle Health only |
| Viewer | viewer@dairypro.com | Viewer@123 | Dashboard read-only |

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.11+ | https://python.org — tick "Add Python to PATH" |
| Node.js | 18+ | https://nodejs.org — LTS version |

Verify in Command Prompt:
```
python --version    # Should show 3.11 or higher
node --version      # Should show v18 or higher
```

---

## Feature Demos

### Demo 1 — Role-Based Access
- Log in as `worker@dairypro.com` then try visiting `/reports` in the URL bar
- You'll see `🚫 Access Denied — Your role (field_worker) does not have access`

### Demo 2 — Offline Milk Entry
- Log in as `worker@dairypro.com`
- Open DevTools (F12) → Network → Offline
- Submit a milk entry — saved locally in IndexedDB
- Go back Online → press Sync button → watch 207 partial handling

### Demo 3 — Account Lockout
- Log out, then enter `admin@dairypro.com` with wrong password 5 times
- 6th attempt returns account locked message

### Demo 4 — GST Validation
- Log in as `accountant@dairypro.com` → Sales → New Invoice
- Try entering both `igst_amount` and `cgst_amount` → validation error

### Demo 5 — Double-Entry Finance
- Finance → Journal Entry → enter unbalanced debits/credits → validation error

---

## Common Issues

| Issue | Fix |
|-------|-----|
| `python not found` | Reinstall Python, tick "Add to PATH" |
| `node not found` | Install Node.js from nodejs.org |
| Port 8000 in use | Change `runserver 0.0.0.0:8000` to `8001` in the bat file |
| Port 3000 in use | Set `PORT=3001` before `npm start` in the frontend bat |
| Login fails | The backend bat creates users on first run — check it ran successfully |
| `Module not found` | Delete `venv/` folder and re-run the backend bat |

---

## Project Structure

```
Dairy management software_1/
├── start_backend.bat       ← Double-click to run backend
├── start_frontend.bat      ← Double-click to run frontend
├── SETUP_GUIDE.md          ← This file
├── 01_BRD/                 ← Business Requirements Document
├── 02_ProjectPlan/         ← Project Plan & Timeline
├── 03_FRD/                 ← Functional Requirements Document
├── 04_Architecture/        ← SAD, DB Schema, API Contracts, ADRs
├── 04_Code/
│   ├── backend/            ← Django 4.2 + DRF (SQLite for dev)
│   │   ├── .env            ← Dev environment config (SQLite mode)
│   │   ├── manage.py
│   │   └── dairypro/       ← 9 Django apps
│   └── frontend/           ← React 18 + Tailwind CSS
│       ├── package.json
│       └── src/            ← 8 pages + components + auth context
└── 05_TestReports/         ← TestPlan, BugReport, Final Build Summary
```

---

*DairyPro 360 v1.2.0 — Django + React — No Docker required for local dev ✅*
