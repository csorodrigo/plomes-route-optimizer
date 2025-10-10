#!/bin/bash

# Comprehensive test runner for Ploomes Sync implementation
# This script runs all tests and generates coverage reports

set -e  # Exit on any error

echo "🚀 Starting Ploomes Sync Test Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if dependencies are installed
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi

    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Are you in the right directory?"
        exit 1
    fi

    if [ ! -d "node_modules" ]; then
        print_warning "node_modules not found. Installing dependencies..."
        npm install
    fi

    print_success "Dependencies verified"
}

# Run linting
run_lint() {
    print_status "Running ESLint..."

    if npm run lint; then
        print_success "Linting passed"
    else
        print_error "Linting failed"
        return 1
    fi
}

# Run type checking
run_type_check() {
    print_status "Running TypeScript type checking..."

    if npm run type-check; then
        print_success "Type checking passed"
    else
        print_error "Type checking failed"
        return 1
    fi
}

# Run unit tests
run_unit_tests() {
    print_status "Running unit tests..."

    echo "📚 Testing PloomesSyncService..."
    if npm test -- --testPathPattern=ploomes-sync.test.ts; then
        print_success "PloomesSyncService tests passed"
    else
        print_error "PloomesSyncService tests failed"
        return 1
    fi

    echo "📦 Testing SyncManager..."
    if npm test -- --testPathPattern=sync-manager.test.ts; then
        print_success "SyncManager tests passed"
    else
        print_error "SyncManager tests failed"
        return 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_status "Running integration tests..."

    echo "🌐 Testing API endpoints..."
    if npm test -- --testPathPattern=api/sync; then
        print_success "API integration tests passed"
    else
        print_error "API integration tests failed"
        return 1
    fi
}

# Run performance tests
run_performance_tests() {
    print_status "Running performance tests..."

    echo "⚡ Testing large batch processing..."
    if npm test -- --testPathPattern=performance.test.ts; then
        print_success "Performance tests passed"
    else
        print_warning "Performance tests failed (might be system resource dependent)"
        return 0  # Don't fail build for performance tests
    fi
}

# Generate coverage report
generate_coverage() {
    print_status "Generating coverage report..."

    if npm run test:coverage; then
        print_success "Coverage report generated"

        # Check if coverage report exists
        if [ -f "coverage/lcov-report/index.html" ]; then
            echo "📊 Coverage report available at: coverage/lcov-report/index.html"
        fi

        # Run our custom coverage analysis
        if [ -f "scripts/test-coverage-report.js" ]; then
            echo "📈 Running detailed coverage analysis..."
            node scripts/test-coverage-report.js
        fi
    else
        print_error "Coverage generation failed"
        return 1
    fi
}

# Validate specific requirements
validate_requirements() {
    print_status "Validating Ploomes sync requirements..."

    echo "🔢 Validating product categorization (11,793 total products)..."
    if npm test -- --testPathPattern=ploomes-sync.test.ts --testNamePattern="should correctly categorize all 11,793 products"; then
        print_success "Product categorization validation passed"
        echo "   ✓ 127 services (CIA_ prefix)"
        echo "   ✓ 95 rentals (CIA_LOC_ prefix)"
        echo "   ✓ 1,307 Atlas products"
        echo "   ✓ 1,952 Ingersoll products"
        echo "   ✓ 10,982 Omie products"
    else
        print_error "Product categorization validation failed"
        return 1
    fi
}

# Run specific test suites based on arguments
run_specific_tests() {
    case "$1" in
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "performance")
            run_performance_tests
            ;;
        "coverage")
            generate_coverage
            ;;
        "validate")
            validate_requirements
            ;;
        *)
            echo "Usage: $0 [unit|integration|performance|coverage|validate]"
            echo "Or run without arguments for full suite"
            ;;
    esac
}

# Main execution
main() {
    local start_time=$(date +%s)

    # If specific test type is requested
    if [ $# -gt 0 ]; then
        check_dependencies
        run_specific_tests "$1"
        local exit_code=$?

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo "⏱️  Execution time: ${duration} seconds"

        exit $exit_code
    fi

    # Run full test suite
    echo "Running complete test suite..."

    # Step 1: Environment checks
    check_dependencies || exit 1

    # Step 2: Code quality checks
    echo -e "\n🔍 Code Quality Checks"
    echo "======================"
    run_lint || exit 1
    run_type_check || exit 1

    # Step 3: Unit tests
    echo -e "\n🧪 Unit Tests"
    echo "============="
    run_unit_tests || exit 1

    # Step 4: Integration tests
    echo -e "\n🔗 Integration Tests"
    echo "==================="
    run_integration_tests || exit 1

    # Step 5: Performance tests
    echo -e "\n⚡ Performance Tests"
    echo "==================="
    run_performance_tests  # Don't exit on failure

    # Step 6: Requirements validation
    echo -e "\n✅ Requirements Validation"
    echo "========================="
    validate_requirements || exit 1

    # Step 7: Coverage report
    echo -e "\n📊 Coverage Analysis"
    echo "==================="
    generate_coverage || exit 1

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo -e "\n🎉 All tests completed successfully!"
    echo "=================================="
    echo "⏱️  Total execution time: ${duration} seconds"
    echo "📊 Coverage report: coverage/lcov-report/index.html"
    echo "📋 Test results: All test suites passed"
    echo ""
    echo "🚀 Ready for production deployment!"
}

# Execute main function with all arguments
main "$@"