#!/bin/bash

# Mass Geocoding with Persistence - Quick Execution Script
# This script runs the robust mass geocoding with guaranteed database persistence

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}🚀 MASS GEOCODING WITH PERSISTENCE${NC}"
echo -e "${BLUE}===========================================${NC}"

# Check if we're in the right directory
if [ ! -f "backend/scripts/mass-geocode-with-persistence.js" ]; then
    echo -e "${RED}❌ Error: mass-geocode-with-persistence.js not found${NC}"
    echo -e "${RED}   Please run this script from the project root directory${NC}"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p backend/logs

# Show configuration info
echo -e "${YELLOW}📊 CONFIGURATION:${NC}"
echo -e "   • Batch Size: 20 customers per batch"
echo -e "   • Save Interval: Every 10 successful geocodes"
echo -e "   • Max Retries: 3 attempts per database save"
echo -e "   • Checkpoint Interval: Every 50 customers"
echo -e "   • Logs Directory: backend/logs/"
echo ""

# Ask for confirmation
echo -e "${YELLOW}⚠️  This will process ALL pending customers for geocoding.${NC}"
echo -e "${YELLOW}   Are you sure you want to continue? (y/N)${NC}"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✅ Starting mass geocoding...${NC}"
    echo ""

    # Run the mass geocoding script
    node backend/scripts/mass-geocode-with-persistence.js

    exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🎉 Mass geocoding completed successfully!${NC}"
        echo ""
        echo -e "${BLUE}📁 Check these files for results:${NC}"
        echo -e "   • Logs: backend/logs/mass-geocoding-*.log"
        echo -e "   • Report: backend/logs/mass-geocoding-*-report.json"
        echo -e "   • Backup: backend/logs/geocoding-backup.json"
        echo ""
    else
        echo ""
        echo -e "${RED}❌ Mass geocoding failed with exit code: $exit_code${NC}"
        echo -e "${RED}   Check the log files for details.${NC}"
        echo ""
    fi

else
    echo -e "${YELLOW}❌ Operation cancelled by user.${NC}"
    exit 0
fi