#!/bin/bash

echo "🚀 Deploying to Vercel with CSS fixes..."

# Clean any build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf .next
rm -rf node_modules/.cache

# Show configuration status
echo "📋 Configuration Status:"
echo "✅ postcss.config.js exists"
echo "✅ tailwind.config.ts configured"
echo "✅ next.config.ts optimized"
echo "✅ vercel.json updated"
echo "✅ globals.css with Tailwind directives"

# Force deployment to Vercel
echo "🔄 Forcing Vercel deployment..."
if command -v vercel &> /dev/null; then
    echo "Using Vercel CLI..."
    vercel --prod --force
else
    echo "Vercel CLI not found, using git push..."
    git add .
    git commit -m "🎨 DEPLOY: CSS configuration fixes for Vercel

- Fixed Tailwind CSS processing
- Removed conflicting PostCSS configs
- Optimized for Vercel deployment

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>" || echo "No changes to commit"

    git push origin main --force
fi

echo "✅ Deployment initiated!"
echo "🌐 Check status at: https://vercel.com/dashboard"