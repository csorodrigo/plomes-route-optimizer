#!/bin/bash

# PLOMES-ROTA-CEP Vercel Deployment Script
# This script automates the deployment process to Vercel

echo "🚀 Starting PLOMES-ROTA-CEP deployment to Vercel..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "vercel.json" ]; then
    echo -e "${RED}❌ Error: vercel.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd frontend && npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
    exit 1
fi

echo -e "${YELLOW}🏗️  Building frontend...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build frontend${NC}"
    exit 1
fi

cd ..

echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install backend dependencies${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All dependencies installed and frontend built successfully${NC}"

echo -e "${YELLOW}🔐 Please ensure you're logged into Vercel CLI...${NC}"
echo -e "${YELLOW}If not logged in, run: vercel login${NC}"

echo -e "${YELLOW}🚀 Deploying to Vercel production...${NC}"
vercel --prod

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo -e "${GREEN}🌐 Your application should now be live on Vercel${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next steps:${NC}"
    echo "1. Set up environment variables in Vercel dashboard:"
    echo "   - PLOOMES_API_KEY"
    echo "   - GOOGLE_MAPS_API_KEY"
    echo "   - JWT_SECRET"
    echo "   - SESSION_SECRET"
    echo ""
    echo "2. Test the deployment by visiting the provided URL"
    echo "3. Monitor logs in Vercel dashboard for any issues"
else
    echo -e "${RED}❌ Deployment failed. Please check the error messages above.${NC}"
    exit 1
fi