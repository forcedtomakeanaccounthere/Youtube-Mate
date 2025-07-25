@echo off
title YouTube Mate Development Environment

echo.
echo 🚀 Starting YouTube Mate Development Environment...
echo.

REM Check if MongoDB is running (Windows)
tasklist /fi "imagename eq mongod.exe" 2>NUL | find /i "mongod.exe" >NUL
if errorlevel 1 (
    echo ⚠️  MongoDB is not running. Please start MongoDB first:
    echo    Start MongoDB service or run: mongod
    pause
    exit /b 1
)

echo ✅ MongoDB is running

REM Check if ports are available
netstat -an | find "LISTENING" | find ":3000" >NUL
if not errorlevel 1 (
    echo ⚠️  Port 3000 is already in use
    pause
    exit /b 1
)

netstat -an | find "LISTENING" | find ":5000" >NUL
if not errorlevel 1 (
    echo ⚠️  Port 5000 is already in use
    pause
    exit /b 1
)

echo ✅ All ports are available

REM Start Backend
echo.
echo 🔧 Starting Backend Server...
cd backend

if not exist "node_modules" (
    echo 📦 Installing backend dependencies...
    call npm install
)

echo Starting backend...
start "Backend Server" cmd /k "npm run dev"

REM Wait for backend to start
echo ⏳ Waiting for backend to start...
timeout /t 5 /nobreak >NUL

REM Start Frontend
echo.
echo 🎨 Starting Frontend...
cd ..\frontend

if not exist "node_modules" (
    echo 📦 Installing frontend dependencies...
    call npm install
)

echo Starting frontend...
start "Frontend Server" cmd /k "npm run dev"

echo.
echo 🎉 YouTube Mate is now running!
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend:  http://localhost:5000
echo.
echo Both services are running in separate windows.
echo Close those windows to stop the services.
echo.
pause
