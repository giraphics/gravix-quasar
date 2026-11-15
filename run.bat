@echo off
rem Run gravix-quasar in development.
rem
rem   run.bat [spa|electron]
rem
rem   spa        the browser app at http://localhost:9000 (default)
rem   electron   the desktop window
rem
rem The Traffic card connects to the simulator when you press Connect.
rem Start it first with ..\gravix-sim-backend\run-sim-server.bat
rem   or add ?sim=ws://127.0.0.1:8081 to the address to connect on load.
setlocal EnableExtensions
cd /d "%~dp0"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=spa"
if /i "%MODE%"=="-h" goto usage
if /i "%MODE%"=="--help" goto usage
if /i not "%MODE%"=="spa" if /i not "%MODE%"=="electron" (
  echo [error] unknown mode: %MODE%
  goto usage_fail
)

where node >nul 2>nul
if errorlevel 1 (
  echo [error] Node.js is not installed or not on PATH. Install Node 22.12 or newer from https://nodejs.org
  goto fail
)

if not exist node_modules (
  echo.
  echo ==^> npm install
  call npm install
  if errorlevel 1 (echo [error] npm install failed. & goto fail)
)

echo.
if /i "%MODE%"=="electron" (
  echo ==^> quasar dev -m electron
  call npx quasar dev -m electron
) else (
  echo ==^> quasar dev: open http://localhost:9000 in Chrome or Edge
  echo     WebGL2 only: http://localhost:9000/#/?backend=webgl
  echo     ^(Ctrl+C to stop^)
  call npx quasar dev
)
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" echo [error] quasar exited with code %CODE%.
echo.
pause
exit /b %CODE%

:usage
echo Usage: run.bat [spa^|electron]
exit /b 0

:usage_fail
echo Usage: run.bat [spa^|electron]
exit /b 1

:fail
echo.
pause
exit /b 1
