@echo off
setlocal
cd /d "%~dp0"
title LUDIA Naver Bridge

where node >nul 2>nul
if errorlevel 1 (
  echo [LUDIA] Node.js 20+ is required.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo [LUDIA] Update Node.js to version 20 or newer.
  pause
  exit /b 1
)

node -e "process.exit(require('./node_modules/playwright/package.json').version === require('./package.json').dependencies.playwright ? 0 : 1)" >nul 2>nul
if errorlevel 1 (
  echo [LUDIA] Installing pinned bridge packages...
  call npm ci --ignore-scripts
  if errorlevel 1 goto :fail
)

echo [LUDIA] Checking Playwright Chromium...
node node_modules\playwright\cli.js install chromium
if errorlevel 1 goto :fail

echo.
echo [LUDIA] Starting Naver SmartPlace bridge...
echo Sign in only inside the Naver browser window that opens.
echo Do not type your Naver password into LUDIA.
echo.
if /I "%~1"=="setup" goto :setup
if not exist "config.local.json" goto :setup
node config-check.js
if errorlevel 1 goto :setup
call npm start
if errorlevel 1 goto :fail
goto :eof

:setup
echo [LUDIA] Opening this PC's setup screen...
call npm run setup
if errorlevel 1 goto :fail
goto :eof

:fail
echo.
echo [LUDIA] Setup failed. Check the message above.
pause
exit /b 1
