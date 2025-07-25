#!/bin/bash

# YouTube Mate Development Startup Script

echo "🚀 Starting YouTube Mate Development Environment..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first:"
    echo "   brew services start mongodb/brew/mongodb-community"
    echo "   or"
    echo "   mongod --config /usr/local/etc/mongod.conf"
    exit 1
fi

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    fi
    return 0
}

# Check ports
check_port 3000
frontend_port_free=$?

check_port 5000
backend_port_free=$?

if [ $frontend_port_free -ne 0 ] || [ $backend_port_free -ne 0 ]; then
    echo "Please stop the services using these ports and try again."
    exit 1
fi

echo "✅ All ports are available"

# Start backend
echo "🔧 Starting Backend Server..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Start backend in background
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if backend started successfully
if ! curl -s http://localhost:5000/health > /dev/null; then
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo "✅ Backend started successfully at http://localhost:5000"

# Start frontend
echo "🎨 Starting Frontend..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend in background
npm run dev &
FRONTEND_PID=$!

echo "⏳ Waiting for frontend to start..."
sleep 5

echo "🎉 YouTube Mate is now running!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:5000"
echo "📚 API Docs: http://localhost:5000/api-docs (if available)"
echo ""
echo "Press Ctrl+C to stop both services"

# Function to cleanup
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for services
wait
