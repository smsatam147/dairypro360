@echo off
title DairyPro 360 — Backend Server
color 0A
echo.
echo  ██████╗  █████╗ ██╗██████╗ ██╗   ██╗██████╗ ██████╗  ██████╗
echo  ██╔══██╗██╔══██╗██║██╔══██╗╚██╗ ██╔╝██╔══██╗██╔══██╗██╔═══██╗
echo  ██║  ██║███████║██║██████╔╝ ╚████╔╝ ██████╔╝██████╔╝██║   ██║
echo  ██║  ██║██╔══██║██║██╔══██╗  ╚██╔╝  ██╔═══╝ ██╔══██╗██║   ██║
echo  ██████╔╝██║  ██║██║██║  ██║   ██║   ██║     ██║  ██║╚██████╔╝
echo  ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝  ╚═╝ ╚═════╝
echo.
echo  DairyPro 360 v1.2.0 -- Backend Setup ^& Launch
echo  ================================================
echo.

:: ── Navigate to backend folder ─────────────────────────────────────────────
cd /d "%~dp004_Code\backend"
echo [1/6] Working directory: %CD%
echo.

:: ── Check Python ───────────────────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.11+ from https://python.org
    echo         Make sure to tick "Add Python to PATH" during installation.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [OK] Found %%i
echo.

:: ── Create virtual environment (first run only) ─────────────────────────────
if not exist "venv\" (
    echo [2/6] Creating virtual environment...
    python -m venv venv
    echo [OK] Virtual environment created.
) else (
    echo [2/6] Virtual environment already exists. Skipping.
)
echo.

:: ── Activate virtual environment ────────────────────────────────────────────
echo [3/6] Activating virtual environment...
call venv\Scripts\activate.bat
echo [OK] Virtual environment active.
echo.

:: ── Install dependencies ────────────────────────────────────────────────────
echo [4/6] Installing Python packages (first run takes 1-2 minutes)...
pip install -r requirements.txt -q --only-binary :all: --prefer-binary
if errorlevel 1 (
    echo [WARN] First attempt failed. Retrying without binary-only constraint...
    pip install -r requirements.txt -q --prefer-binary
    if errorlevel 1 (
        echo [ERROR] Package installation failed. Check your internet connection.
        echo         Also make sure you have a working internet connection.
        echo         If the issue persists, try: pip install -r requirements.txt --verbose
        pause
        exit /b 1
    )
)
echo [OK] All packages installed.
echo.

:: ── Create logs directory ────────────────────────────────────────────────────
if not exist "logs\" mkdir logs

:: ── Generate migrations (first run only) ─────────────────────────────────────
echo [5/6] Generating and running database migrations...
python manage.py makemigrations core milk cattle inventory sales finance hr reports
python manage.py migrate
if errorlevel 1 (
    echo [ERROR] Migration failed. Check the error above.
    pause
    exit /b 1
)
echo [OK] Database ready.
echo.

:: ── Create superuser (first run only) ───────────────────────────────────────
echo Checking if admin user exists...
python manage.py shell < seed_users.py
echo.

:: ── Create logs directory ────────────────────────────────────────────────────
if not exist "logs\" mkdir logs

:: ── Start Django dev server ─────────────────────────────────────────────────
echo [6/6] Starting DairyPro 360 API server...
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║  Backend API running at: http://localhost:8000/api/  ║
echo  ║  Admin panel:            http://localhost:8000/admin ║
echo  ║                                                      ║
echo  ║  Login:  admin@dairypro.com  /  Admin@123           ║
echo  ║                                                      ║
echo  ║  Press CTRL+C to stop the server                    ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
echo  Open a second terminal and run start_frontend.bat
echo  Then open http://localhost:3000 in your browser.
echo.

python manage.py runserver 0.0.0.0:8000
pause
