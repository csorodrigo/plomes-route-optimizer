#!/bin/bash

# Script para corrigir automaticamente problemas do backend
# Usado sempre que der erro ERR_CONNECTION_REFUSED

echo "🔧 Fixing backend connection issues..."

# 1. Kill any existing processes on port 3001
echo "⚰️  Killing existing processes on port 3001..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No processes found on port 3001"

# 2. Wait a moment
sleep 2

# 3. Start backend fresh
echo "🚀 Starting backend on port 3001..."
cd "$(dirname "$0")"
PORT=3001 node backend/server.js &

# 4. Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# 5. Check if backend is responding
echo "🏥 Checking backend health..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Backend is now running and healthy!"
    echo "🌐 Frontend should now be able to connect"
    echo "📱 Try logging in again at http://localhost:3000"
else
    echo "❌ Backend health check failed"
    echo "🔍 Check the logs above for errors"
fi

echo "📋 Backend fix complete!"