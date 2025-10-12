#!/bin/bash

# Deploy script for new Vercel project: plomes-produtos-precos
# This script ensures a clean deployment without linking to old projects

set -e

echo "🚀 Starting deployment to NEW Vercel project..."

# Remove any existing .vercel directory
if [ -d ".vercel" ]; then
    echo "🗑️  Removing old .vercel directory..."
    rm -rf .vercel
fi

# Kill any running vercel processes
echo "🔪 Killing any running vercel processes..."
pkill -f vercel || true
sleep 2

# Deploy with explicit settings
echo "📦 Deploying to Vercel..."
echo ""
echo "⚠️  IMPORTANT: When prompted:"
echo "   1. Set up and deploy? → Y"
echo "   2. Which scope? → csorodrigo-2569s-projects"
echo "   3. Link to existing project? → N"
echo "   4. What's your project's name? → plomes-produtos-precos"
echo "   5. In which directory is your code located? → ./"
echo ""

# Run deployment
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo "🔗 Check your deployment at: https://vercel.com/csorodrigo-2569s-projects"
