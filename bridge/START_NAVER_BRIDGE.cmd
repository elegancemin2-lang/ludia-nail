@echo off
setlocal
cd /d "%~dp0"
title LUDIA Naver Bridge

if not exist "config.local.json" (
  copy /Y "config.example.json" "config.local.json" >nul
  echo.
  echo [LUDIA] config.local.json created.
  echo [LUDIA] Put the same LUDIA_SYNC_TOKEN used in Vercel into syncToken.
  echo [LUDIA] Then save the file and run this START file again.
  start "" notepad "config.local.json"
  pause
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo [LUDIA] Node.js 20+ is required.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\playwright" (
  echo [LUDIA] Installing bridge packages...
  call npm install
  if errorlevel 1 goto :fail
)

echo [LUDIA] Checking Playwright Chromium...
call npx playwright install chromium
if errorlevel 1 goto :fail

echo.
echo [LUDIA] Starting Naver SmartPlace bridge...
echo Sign in only inside the Naver browser window that opens.
echo Do not type your Naver password into LUDIA.
echo.
call npm start
goto :eof

:fail
echo.
echo [LUDIA] Setup failed. Check the message above.
pause
exit /b 1
