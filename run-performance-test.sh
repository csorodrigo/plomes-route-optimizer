#!/bin/bash

# Performance Test Runner for Mass Geocoding Operations
echo "🚀 Starting Performance Test for Mass Geocoding Operations"
echo "=========================================================="

# Check if we're in the right directory
if [ ! -f "backend/scripts/performance-test.js" ]; then
    echo "❌ Error: Performance test script not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Set environment variables
export NODE_ENV=test
export PERFORMANCE_TEST=true

# Enable garbage collection exposure for memory management
export NODE_OPTIONS="--expose-gc --max-old-space-size=2048"

echo "🔧 Environment configured for performance testing"
echo "🔧 Memory limit: 2GB"
echo "🔧 Garbage collection: Enabled"
echo ""

# Run the performance test
echo "⚡ Running performance tests..."
node backend/scripts/performance-test.js

echo ""
echo "✅ Performance testing completed!"
echo ""
echo "📊 Key Performance Targets for Mass Geocoding:"
echo "  - Target: Process 2,000+ customers efficiently"
echo "  - Memory usage should stay under 1GB"
echo "  - Database queries should average <500ms"
echo "  - Batch operations should achieve 50+ records/sec"
echo ""
echo "🔧 If performance issues are detected:"
echo "  1. Reduce batch sizes"
echo "  2. Increase processing delays"
echo "  3. Monitor memory usage during operations"
echo "  4. Consider processing in smaller chunks"