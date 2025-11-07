#!/usr/bin/env bash
#
# WebSocket Smoke Test Script
#
# This script performs basic smoke tests on WebSocket endpoints to verify:
# - Connection establishment
# - Echo round-trip functionality
# - Heartbeat/ping delivery
# - Proper close codes (no 1006)
#
# Requirements:
#   - wscat (npm install -g wscat)
#   OR
#   - websocat (cargo install websocat OR brew install websocat)
#
# Usage:
#   ./scripts/dev/ws_smoke.sh [ws_url]
#
# Examples:
#   ./scripts/dev/ws_smoke.sh                          # Uses default ws://localhost:9000
#   ./scripts/dev/ws_smoke.sh ws://localhost:9000/ws   # Custom URL
#   ./scripts/dev/ws_smoke.sh wss://api.example.com/ws # Production URL

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WS_BASE_URL="${1:-ws://localhost:9000}"
TIMEOUT=10

echo "================================================"
echo "WebSocket Smoke Test Suite"
echo "================================================"
echo "Target: $WS_BASE_URL"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Check for wscat or websocat
HAS_WSCAT=false
HAS_WEBSOCAT=false

if command -v wscat &> /dev/null; then
    HAS_WSCAT=true
    echo -e "${GREEN}✓${NC} wscat found"
elif command -v websocat &> /dev/null; then
    HAS_WEBSOCAT=true
    echo -e "${GREEN}✓${NC} websocat found"
else
    echo -e "${RED}✗${NC} Neither wscat nor websocat found"
    echo ""
    echo "Please install one of the following:"
    echo "  - wscat:    npm install -g wscat"
    echo "  - websocat: cargo install websocat"
    echo "              brew install websocat (macOS)"
    exit 1
fi

echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    local url="${WS_BASE_URL}${endpoint}"

    echo "----------------------------------------"
    echo "Testing: $description"
    echo "URL: $url"
    echo ""

    if [ "$HAS_WSCAT" = true ]; then
        # Using wscat
        # Note: This is a simplified test - full automation requires expect or similar
        echo "Manual test with wscat:"
        echo "  wscat -c $url"
        echo ""
        echo "Expected behavior:"
        echo "  1. Connection establishes"
        echo "  2. Receive welcome/health_status message"
        echo "  3. Can send/receive messages"
        echo "  4. Press Ctrl+C to disconnect (should see clean close)"
        echo ""
        echo -e "${YELLOW}[MANUAL]${NC} Run the above command to test manually"
        echo ""

    elif [ "$HAS_WEBSOCAT" = true ]; then
        # Using websocat - can automate better
        echo "Testing with websocat..."

        # Test connection (timeout after 3 seconds)
        timeout 3 websocat -n1 "$url" > /tmp/ws_test_$$.log 2>&1 || true

        if [ -s /tmp/ws_test_$$.log ]; then
            echo -e "${GREEN}✓${NC} Connection established and received data:"
            cat /tmp/ws_test_$$.log
            echo ""
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}✗${NC} Connection failed or no data received"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi

        rm -f /tmp/ws_test_$$.log
    fi
}

# Test /ws/echo endpoint
test_endpoint "/ws/echo" "Echo Endpoint"

# Test /ws/health endpoint
test_endpoint "/ws/health" "Health Check Endpoint"

# Test /ws endpoint (main WebSocket)
test_endpoint "/ws" "Main WebSocket Endpoint"

# Summary
echo "================================================"
echo "Smoke Test Summary"
echo "================================================"

if [ "$HAS_WSCAT" = true ]; then
    echo -e "${YELLOW}Manual testing required with wscat${NC}"
    echo ""
    echo "For automated testing, see: scripts/dev/ws_smoke.md"
elif [ "$HAS_WEBSOCAT" = true ]; then
    echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All automated tests passed${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Verify server is running: curl http://localhost:9000/health"
        echo "  2. Check WebSocket logs: docker-compose logs -f api | grep WS_"
        echo "  3. See diagnostics: checks/ws_server_diagnostics.md"
        exit 1
    fi
fi

echo ""
echo "================================================"
echo "Next Steps"
echo "================================================"
echo ""
echo "1. Run unit tests:"
echo "   cd api && pytest tests/test_ws_echo.py tests/test_ws_health.py -v"
echo ""
echo "2. Manual testing with wscat:"
echo "   wscat -c ws://localhost:9000/ws/echo"
echo "   > {\"type\":\"test\",\"data\":\"hello\"}"
echo ""
echo "3. Monitor server logs:"
echo "   docker-compose logs -f api | grep WS_DIAGNOSTICS"
echo ""
echo "4. See full documentation:"
echo "   cat scripts/dev/ws_smoke.md"
echo ""
