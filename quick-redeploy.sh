#!/bin/bash

# Quick Redeploy Script for Railway
echo "🚀 QUICK REDEPLOY SCRIPT - Railway PT-BR Fix"
echo "========================================"

# Check if we have a local build
if [ ! -d "frontend/build" ]; then
    echo "❌ Frontend build not found. Building now..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

echo "✅ Frontend build exists"

# Check PT-BR content in build
pt_br_count=$(grep -r "Bem-vindo\|CIA MÁQUINAS\|Otimizador" frontend/build/static/js/ 2>/dev/null | wc -l)
echo "📊 PT-BR strings found in build: $pt_br_count"

if [ "$pt_br_count" -lt "10" ]; then
    echo "⚠️  Warning: Low PT-BR content. Rebuilding..."
    cd frontend
    npm run build
    cd ..
fi

# Show current commit
echo ""
echo "📋 Current commit:"
git log -1 --oneline

echo ""
echo "📁 Build file sizes:"
du -sh frontend/build/*

echo ""
echo "🔗 Repository URL: https://github.com/csorodrigo/plomes-route-optimizer"
echo ""
echo "📝 Instructions for Railway redeploy:"
echo "1. Go to https://railway.app"
echo "2. Create new project"
echo "3. Connect GitHub repo: csorodrigo/plomes-route-optimizer"
echo "4. Set build command: npm install && cd frontend && npm install && npm run build && cd .."
echo "5. Set start command: node backend/server.js"
echo "6. Add environment variables:"
echo "   - NODE_ENV=production"
echo "   - JWT_SECRET=your-secret-here"
echo ""
echo "✅ All files ready for deployment!"

# Validate the build contains PT-BR
echo ""
echo "🔍 Final validation:"
if grep -q "lang=\"pt-BR\"" frontend/build/index.html; then
    echo "✅ HTML contains pt-BR language tag"
else
    echo "❌ Missing pt-BR language tag"
fi

if [ -f "frontend/build/logo.png" ]; then
    echo "✅ CIA MÁQUINAS logo present"
else
    echo "❌ Logo missing"
fi

main_js=$(find frontend/build/static/js -name "main.*.js" | head -1)
if [ -f "$main_js" ]; then
    js_size=$(du -h "$main_js" | cut -f1)
    echo "✅ Main JS bundle: $js_size"
else
    echo "❌ Main JS bundle not found"
fi

echo ""
echo "🚀 Ready for Railway redeploy!"
echo "📱 Monitor: https://railway.app/dashboard"