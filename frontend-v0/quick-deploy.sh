#!/bin/bash
set -e

echo "🚀 Quick Deploy Script"
echo "====================="

cd "/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP"

# Remove any lock files
rm -f .git/index.lock .git/HEAD.lock

echo "📝 Adding files..."
git add -A frontend-v0/

echo "💾 Committing..."
git commit -m "🚀 DEPLOY: Fix login redirect to /dashboard/cliente

Changes:
- src/app/login/page.tsx: Use window.location.href for immediate redirect
- src/components/AuthGuard.tsx: Redirect to /dashboard/cliente
- src/middleware.ts: Root path redirects to /dashboard/cliente
- .npmrc: Add legacy-peer-deps=true

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>" || echo "Nothing to commit or commit failed"

echo "🚢 Pushing to GitHub..."
git push origin main

echo "✅ Done! Vercel should auto-deploy from GitHub webhook."
echo "📊 Check deployment status at: https://vercel.com/csorodrigo-2569s-projects/frontend-v0"
