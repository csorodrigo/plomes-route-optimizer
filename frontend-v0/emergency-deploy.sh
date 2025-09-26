#!/bin/bash
# EMERGENCY DEPLOYMENT SCRIPT - Fix production login issues

echo "🚨 EMERGENCY: Deploying fixed version to resolve production login issues..."

# Ensure we're in the correct directory
cd /Users/rodrigooliveira/Documents/workspace\ 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Deploy to Vercel
echo "📦 Deploying to Vercel..."
vercel --prod --confirm

echo "✅ Deployment initiated. Check Vercel dashboard for status."
echo "🔗 New deployment should be available shortly without authentication issues."