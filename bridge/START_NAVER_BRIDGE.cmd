@echo off
setlocal
cd /d "%~dp0"
title LUDIA Naver Bridge

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)" >nul 2>nul
if not errorlevel 1 goto :packages
set "LUDIA_NODE_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "LUDIA_NODE_ARCH=arm64"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "LUDIA_NODE_ARCH=arm64"
if /I "%PROCESSOR_ARCHITECTURE%"=="x86" if "%PROCESSOR_ARCHITEW6432%"=="" (
  echo [LUDIA] A 64-bit Windows PC is required.
  goto :fail
)
set "LUDIA_NODE_DIR=%CD%\.runtime\node-v24.22.0-win-%LUDIA_NODE_ARCH%"
if exist "%LUDIA_NODE_DIR%\node.exe" goto :runtime
echo [LUDIA] Installing private Node.js runtime from nodejs.org...
echo No administrator access or system PATH change is needed.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $arch=$env:LUDIA_NODE_ARCH; $hash=if($arch -eq 'arm64'){'3a5c209a5bc59e65b3bc0fa13ed5e166a26bd3d55332847f498b76b037408d61'}else{'f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3'}; $dir=Join-Path (Get-Location) '.runtime'; New-Item -ItemType Directory -Force -Path $dir | Out-Null; $zip=Join-Path $dir ('download-'+[guid]::NewGuid().ToString()+'.zip'); try { Invoke-WebRequest -UseBasicParsing -Uri ('https://nodejs.org/dist/v24.22.0/node-v24.22.0-win-'+$arch+'.zip') -OutFile $zip; if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash){throw 'Runtime checksum mismatch'}; Expand-Archive -LiteralPath $zip -DestinationPath $dir -Force } finally { if(Test-Path -LiteralPath $zip){Remove-Item -LiteralPath $zip -Force} }"
if errorlevel 1 goto :fail
:runtime
set "PATH=%LUDIA_NODE_DIR%;%PATH%"
node -e "process.exit(process.versions.node === '24.22.0' ? 0 : 1)" >nul 2>nul
if errorlevel 1 goto :fail
:packages

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
