@echo off
title DairyPro 360 — Frontend
color 0B
echo.
echo  DairyPro 360 — Starting Frontend...
echo.
cd /d "%~dp004_Code\frontend"
if not exist "node_modules\" (
    echo Installing packages for the first time...
    npm install
)
echo.
echo  Open browser at: http://localhost:3000
echo  Press CTRL+C to stop
echo.
npm start
pause
