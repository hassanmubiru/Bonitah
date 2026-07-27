#!/bin/bash

# BFN Backend - Supabase Testing Script
# This script tests all endpoints of the deployed Supabase Edge Function

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get API URL from environment or prompt
API_URL=""
if [ -f ".env" ]; then
    PROJECT_REF=$(grep "SUPABASE_PROJECT_REF" .env | cut -d '=' -f2 | tr -d '"' | tr -d ' ')
    if [ ! -z "$PROJECT_REF" ]; then
        API_URL="https://$PROJECT_REF.supabase.co/functions/v1/backend"
    fi
fi

if [ -z "$API_URL" ]; then
    echo "Enter your Supabase Edge Function URL:"
    echo "(Format: https://YOUR-PROJECT-REF.supabase.co/functions/v1/backend)"
    read -r API_URL
fi

echo -e "${BLUE}🧪 Testing BFN Backend at: $API_URL${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_TOTAL=0

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2" 
    local endpoint="$3"
    local expected_status="$4"
    local data="$5"
    
    ((TESTS_TOTAL++))
    echo -n "Testing $name... "
    
    local response
    local status_code
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$API_URL$endpoint")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$API_URL$endpoint")
    fi
    
    status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    response_body=$(echo "$response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $status_code)"
        ((TESTS_PASSED++))
        
        # Pretty print JSON response for important endpoints
        if [ "$name" = "Health Check" ] || [ "$name" = "AI Provider" ]; then
            echo "$response_body" | python3 -m json.tool 2>/dev/null || echo "$response_body"
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $status_code)"
        echo "Response: $response_body"
    fi
    echo ""
}

echo -e "${YELLOW}=== Core Endpoints ===${NC}"

# Health Check
test_endpoint "Health Check" "GET" "/health" "200"

# AI Provider
test_endpoint "AI Provider" "GET" "/ai/provider" "200"

echo -e "${YELLOW}=== Authentication Endpoints ===${NC}"

# Get Nonce
test_endpoint "Auth Nonce" "POST" "/auth/nonce" "200" '{"address":"0x742d35Cc6e6B7E7e0E8392F637f2faE5c0BC1234"}'

echo -e "${YELLOW}=== Blockchain Endpoints ===${NC}"

# Test contract read (USDC balance)
test_endpoint "Chain Read USDC Balance" "GET" "/chain/read?contract=0x036CbD53842c5426634e7929541eC2318f3dCF7e&function=balanceOf&args=[\"0x742d35Cc6e6B7E7e0E8392F637f2faE5c0BC1234\"]" "200"

# Test SavingsVault read
test_endpoint "Chain Read Savings Vault" "GET" "/chain/read?contract=0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6&function=lockedTotal" "200"

echo -e "${YELLOW}=== Analytics Endpoints ===${NC}"

# Portfolio Analytics
test_endpoint "Portfolio Analytics" "GET" "/analytics/portfolio?address=0x742d35Cc6e6B7E7e0E8392F637f2faE5c0BC1234" "200"

echo -e "${YELLOW}=== Transaction Endpoints ===${NC}"

# Transaction History
test_endpoint "Transaction History" "GET" "/transactions?address=0x742d35Cc6e6B7E7e0E8392F637f2faE5c0BC1234&limit=5" "200"

echo -e "${YELLOW}=== Education Endpoints ===${NC}"

# Education Courses
test_endpoint "Education Courses" "GET" "/education/courses" "200"

echo -e "${YELLOW}=== AI Chat Test ===${NC}"

# AI Chat (requires API keys to work fully)
test_endpoint "AI Chat" "POST" "/ai/chat" "200" '{"question":"What is DeFi?"}'

echo -e "${YELLOW}=== Error Handling Tests ===${NC}"

# Test 404 endpoint
test_endpoint "404 Not Found" "GET" "/nonexistent" "404"

# Test missing parameters
test_endpoint "Missing Parameters" "GET" "/chain/read" "400"

# Test invalid JSON
test_endpoint "Invalid JSON" "POST" "/auth/nonce" "500" '{"invalid": json}'

echo ""
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$((TESTS_TOTAL - TESTS_PASSED))${NC}"
echo -e "Total Tests: ${BLUE}$TESTS_TOTAL${NC}"

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}🎉 All tests passed! Backend is working correctly.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ Some tests failed. Check the output above for details.${NC}"
    exit 1
fi