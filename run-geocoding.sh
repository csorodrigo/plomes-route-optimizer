#!/bin/bash

# 🚀 MASS GEOCODING RUNNER
# Optimized script to geocode all 2,244 pending customers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 MASS GEOCODING RUNNER v2.0${NC}"
echo -e "${BLUE}================================${NC}"

# Change to project directory
cd "$(dirname "$0")"

# Load optimized configuration
if [ -f "geocoding-config.env" ]; then
    echo -e "${GREEN}✅ Loading optimized configuration...${NC}"
    source geocoding-config.env
else
    echo -e "${YELLOW}⚠️  Using default configuration${NC}"
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Function to show status
show_status() {
    echo -e "${BLUE}📊 Current Status:${NC}"
    node backend/scripts/geocoding-monitor.js status
}

# Function to start geocoding
start_geocoding() {
    echo -e "${GREEN}🎯 Starting optimized mass geocoding...${NC}"
    echo -e "${YELLOW}💡 Tip: You can press Ctrl+C to stop gracefully${NC}"
    echo ""

    node backend/scripts/mass-geocode-optimized.js
}

# Function to analyze errors
analyze_errors() {
    echo -e "${BLUE}🔍 Analyzing geocoding errors...${NC}"
    node backend/scripts/geocoding-monitor.js errors
}

# Function to test single customer
test_customer() {
    if [ -z "$1" ]; then
        echo -e "${RED}❌ Please provide a customer ID${NC}"
        echo -e "${YELLOW}Usage: $0 test <customer_id>${NC}"
        return 1
    fi

    echo -e "${BLUE}🧪 Testing customer: $1${NC}"
    node backend/scripts/geocoding-monitor.js test "$1"
}

# Function to reset failed customers
reset_failed() {
    echo -e "${YELLOW}🔄 Resetting failed customers to pending...${NC}"
    node backend/scripts/geocoding-monitor.js reset-failed
}

# Function to validate results
validate_results() {
    echo -e "${BLUE}🔍 Validating geocoding results...${NC}"
    node backend/scripts/validate-geocoding-improvements.js
}

# Function to show help
show_help() {
    echo -e "${BLUE}📖 USAGE:${NC}"
    echo ""
    echo -e "${GREEN}  $0 status${NC}          Show current geocoding statistics"
    echo -e "${GREEN}  $0 start${NC}           Start mass geocoding process"
    echo -e "${GREEN}  $0 errors${NC}          Analyze geocoding errors"
    echo -e "${GREEN}  $0 validate${NC}        Validate geocoding results and quality"
    echo -e "${GREEN}  $0 test <id>${NC}       Test geocoding for specific customer"
    echo -e "${GREEN}  $0 reset-failed${NC}    Reset failed customers to pending"
    echo -e "${GREEN}  $0 help${NC}            Show this help message"
    echo ""
    echo -e "${BLUE}🎯 OPTIMIZATIONS:${NC}"
    echo -e "   • Parallel processing: ${GEOCODING_CONCURRENCY:-8} concurrent requests"
    echo -e "   • Batch size: ${GEOCODING_BATCH_SIZE:-50} customers per batch"
    echo -e "   • Request delay: ${GEOCODING_DELAY_MS:-200}ms between requests"
    echo -e "   • Regional optimization: Ceará/Northeast priority"
    echo -e "   • Multiple provider fallback cascade"
    echo ""
    echo -e "${BLUE}📈 EXPECTED PERFORMANCE (2,244 customers):${NC}"
    echo -e "   • Estimated time: 15-37 minutes"
    echo -e "   • Expected success rate: 85-94%"
    echo -e "   • Automatic retry on failures"
    echo -e "   • Progress saved every 25 successful geocodes"
}

# Main command handling
case "${1:-status}" in
    "status")
        show_status
        ;;
    "start")
        show_status
        echo ""
        read -p "🚀 Start mass geocoding? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            start_geocoding
        else
            echo -e "${YELLOW}⏹️  Cancelled${NC}"
        fi
        ;;
    "errors")
        analyze_errors
        ;;
    "validate")
        validate_results
        ;;
    "test")
        test_customer "$2"
        ;;
    "reset-failed")
        echo -e "${YELLOW}⚠️  This will reset all failed customers to pending status.${NC}"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            reset_failed
        else
            echo -e "${YELLOW}⏹️  Cancelled${NC}"
        fi
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

echo -e "${BLUE}✨ Done!${NC}"