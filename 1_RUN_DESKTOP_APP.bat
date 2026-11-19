@echo off
title AdobeStock 4K 30fps Studio - Launching Desktop App
echo ========================================================
echo   AdobeStock 4K 30fps Studio (4K 30 FPS Gemini Loop Studio)
echo ========================================================
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed!
  echo Please install Node.js LTS from: https://nodejs.org/
  pause
  exit /b
)
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [IMPORTANT] A .env file was created. Please open .env and paste your GEMINI_API_KEY!
  notepad .env
)
if not exist "node_modules" (
  echo Installing dependencies... Please wait 1-2 minutes...
  call npm install
)
echo Starting Desktop App...
call npm start
