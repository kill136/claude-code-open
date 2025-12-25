#!/bin/bash

# Test runner script for Claude Code core modules
# Usage: ./tests/run-tests.sh [test-name]

set -e

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$TESTS_DIR")"

cd "$PROJECT_DIR"

# Check if tsx is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not available. Please install Node.js and npm."
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Claude Code Core Module Tests ===${NC}\n"

# Function to run a single test
run_test() {
    local test_file=$1
    local test_name=$(basename "$test_file" .test.ts)

    echo -e "${YELLOW}Running: ${test_name}${NC}"

    if npx tsx "$test_file" 2>&1; then
        echo -e "${GREEN}✓ ${test_name} passed${NC}\n"
        return 0
    else
        echo -e "${RED}✗ ${test_name} failed${NC}\n"
        return 1
    fi
}

# If specific test is provided, run only that
if [ $# -eq 1 ]; then
    test_file="$TESTS_DIR/core/$1.test.ts"
    if [ -f "$test_file" ]; then
        run_test "$test_file"
    else
        echo -e "${RED}Error: Test file not found: $test_file${NC}"
        exit 1
    fi
    exit $?
fi

# Run all core tests
passed=0
failed=0

for test_file in "$TESTS_DIR/core"/*.test.ts; do
    if run_test "$test_file"; then
        ((passed++))
    else
        ((failed++))
    fi
done

# Summary
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "Total: $((passed + failed))"
echo -e "${GREEN}Passed: $passed${NC}"
echo -e "${RED}Failed: $failed${NC}"

if [ $failed -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
fi
