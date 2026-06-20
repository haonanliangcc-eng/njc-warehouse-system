@echo off
setlocal

cd /d "%~dp0"
title Warehouse Ops System Launcher

echo.
echo ================================
echo   Warehouse Ops System
echo ================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js first:
  echo https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please reinstall Node.js.
  pause
  exit /b 1
)

if not exist package.json (
  echo package.json was not found in this folder.
  echo Please put this file inside the project folder.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies. This may take several minutes the first time...
  npm install --cache ".npm-cache"
  if errorlevel 1 (
    echo.
    echo Install failed. See the message above.
    pause
    exit /b 1
  )
)

echo.
if not exist ".next\BUILD_ID" (
  echo Building the web app. This may take 1-2 minutes...
  npm run build
  if errorlevel 1 (
    echo.
    echo Build failed. See the message above.
    pause
    exit /b 1
  )
)

echo Starting the system at http://0.0.0.0:3001
echo A server window will stay open. Keep it open while using the web page.
echo.

start "Warehouse Ops Server" cmd /k "cd /d ""%~dp0"" && npm run start -- -H 0.0.0.0 -p 3001"

timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:3001"

exit /b 0
