@echo off
title Building Windows Portable .EXE - AdobeStock 4K 30fps Studio
echo ========================================================
echo   Building Standalone Windows .EXE (AdobeStock 4K 30fps Studio.exe)
echo ========================================================
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is required to compile the .exe locally!
  echo Download Node.js LTS from: https://nodejs.org/
  echo (OR upload this folder to GitHub to auto-build the .exe in the cloud!)
  pause
  exit /b
)
echo [1/2] Installing Electron, Gemini SDK, and MP4 Encoder...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed. Check your internet connection.
  pause
  exit /b
)
echo.
echo [2/2] Compiling Windows Portable .EXE...
call npm run build-exe
if %errorlevel% neq 0 (
  echo [ERROR] Build failed!
  pause
  exit /b
)
echo.
echo ========================================================
echo   SUCCESS! Your Windows .EXE is ready inside the "dist" folder!
echo   Remember to place your .env file next to the .exe file.
echo ========================================================
explorer dist
pause
