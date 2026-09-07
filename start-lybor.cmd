@echo off
REM ---------------------------------------------------------------------------
REM  Double-click this file to run LYBOR on this machine.
REM
REM  It installs dependencies and sets up the database only if they are
REM  missing, then starts the server and opens the browser. Leave the window
REM  open while you use the app; closing it stops the server.
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

title LYBOR

echo.
echo   Starting LYBOR...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not installed, or is not on your PATH.
  echo.
  echo   Install the LTS version from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo   [1/3] Installing dependencies. This takes a minute the first time...
  call npm install
  if errorlevel 1 goto failed
) else (
  echo   [1/3] Dependencies already installed.
)

if not exist "dev.db" (
  echo   [2/3] Setting up the database and demo data...
  call npm run setup
  if errorlevel 1 goto failed
) else (
  echo   [2/3] Database already set up.
)

echo   [3/3] Starting the server on http://localhost:3000
echo.
echo   ---------------------------------------------------------------
echo     Open:  http://localhost:3000
echo.
echo     Sign in with any of these. Password for all: lybor123
echo       Worker     9800000001
echo       Employer   9800000010
echo       Admin      9800000099
echo.
echo     Keep this window open. Press Ctrl+C to stop the server.
echo   ---------------------------------------------------------------
echo.

REM Give the dev server a moment to bind before the browser races it.
REM `ping -n` rather than `timeout`, because a Git Bash or MSYS install on the
REM PATH shadows Windows' timeout.exe with the GNU one, which takes different
REM arguments and prints an error instead of waiting.
start "" /b cmd /c "ping -n 7 127.0.0.1 >nul && start """" http://localhost:3000"

call npm run dev

goto :eof

:failed
echo.
echo   Setup failed. The error above says why.
echo.
pause
exit /b 1
