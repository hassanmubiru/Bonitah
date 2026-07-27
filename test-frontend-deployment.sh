#!/bin/bash

# BFN Frontend - Deployment Testing Script
# This script tests the deployed frontend on Vercel

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 BFN Frontend Deployment Testing${NC}"

# Get deployment URL
DEPLOYMENT_URL=""
if [ -n "$1" ]; then
    DEPLOYMENT_URL="$1"
else
    echo "Enter your Vercel deployment URL:"
    echo "(Format: https://your-app.vercel.app)"
    read -r DEPLOYMENT_URL
fi

# Remove trailing slash
DEPLOYMENT_URL=${DEPLOYMENT_URL%/}

echo -e "${BLUE}Testing deployment at: $DEPLOYMENT_URL${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_TOTAL=0

# Function to test endpoint
test_page() {
    local name="$1"
    local path="$2"
    local expected_status="$3"
    
    ((TESTS_TOTAL++))
    echo -n "Testing $name... "
    
    local response
    local status_code
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$DEPLOYMENT_URL$path")
    status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $status_code)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $status_code)"
    fi
}

# Function to test page content
test_page_content() {
    local name="$1"
    local path="$2"
    local search_text="$3"
    
    ((TESTS_TOTAL++))
    echo -n "Testing $name content... "
    
    local response
    response=$(curl -s "$DEPLOYMENT_URL$path")
    
    if echo "$response" | grep -q "$search_text"; then
        echo -e "${GREEN}✓ PASSED${NC} (Content found)"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Content not found)"
    fi
}

echo -e "${YELLOW}=== Basic Page Tests ===${NC}"

# Test main pages
test_page "Home Page" "/" "200"
test_page "Dashboard" "/dashboard" "200"
test_page "Savings" "/savings" "200"
test_page "AI Chat" "/ai" "200"
test_page "Education" "/education" "200"
test_page "Profile" "/profile" "200"

echo ""
echo -e "${YELLOW}=== Content Tests ===${NC}"

# Test page content
test_page_content "Home Page Title" "/" "Bonitah Financial Network"
test_page_content "Dashboard Content" "/dashboard" "dashboard"
test_page_content "Savings Content" "/savings" "savings"

echo ""
echo -e "${YELLOW}=== Technical Tests ===${NC}"

# Test technical aspects
test_page "Favicon" "/favicon.ico" "200"
test_page "Robots.txt" "/robots.txt" "200"

echo ""
echo -e "${YELLOW}=== Security Headers Test ===${NC}"

# Test security headers
echo -n "Testing security headers... "
HEADERS_RESPONSE=$(curl -s -I "$DEPLOYMENT_URL")

SECURITY_PASSED=0
SECURITY_TOTAL=4

if echo "$HEADERS_RESPONSE" | grep -q "x-frame-options"; then
    ((SECURITY_PASSED++))
fi

if echo "$HEADERS_RESPONSE" | grep -q "x-content-type-options"; then
    ((SECURITY_PASSED++))
fi

if echo "$HEADERS_RESPONSE" | grep -q "referrer-policy"; then
    ((SECURITY_PASSED++))
fi

if echo "$HEADERS_RESPONSE" | grep -q "cross-origin"; then
    ((SECURITY_PASSED++))
fi

if [ $SECURITY_PASSED -eq $SECURITY_TOTAL ]; then
    echo -e "${GREEN}✓ PASSED${NC} ($SECURITY_PASSED/$SECURITY_TOTAL headers)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ PARTIAL${NC} ($SECURITY_PASSED/$SECURITY_TOTAL headers)"
fi

((TESTS_TOTAL++))

echo ""
echo -e "${YELLOW}=== Performance Test ===${NC}"

# Test page load time
echo -n "Testing page load time... "
LOAD_START=$(date +%s%3N)
curl -s "$DEPLOYMENT_URL" > /dev/null
LOAD_END=$(date +%s%3N)
LOAD_TIME=$((LOAD_END - LOAD_START))

if [ $LOAD_TIME -lt 3000 ]; then
    echo -e "${GREEN}✓ FAST${NC} (${LOAD_TIME}ms)"
    ((TESTS_PASSED++))
elif [ $LOAD_TIME -lt 5000 ]; then
    echo -e "${YELLOW}⚠ ACCEPTABLE${NC} (${LOAD_TIME}ms)"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ SLOW${NC} (${LOAD_TIME}ms)"
fi

((TESTS_TOTAL++))

echo ""
echo -e "${YELLOW}=== API Connection Test ===${NC}"

# Test if frontend can connect to backend
echo -n "Testing backend API connection... "

# Try to get the API URL from the page source
API_URL=$(curl -s "$DEPLOYMENT_URL" | grep -o 'https://[^"]*supabase.co/functions/v1/backend' | head -n1)

if [ -n "$API_URL" ]; then
    if curl -s -f "$API_URL/health" > /dev/null; then
        echo -e "${GREEN}✓ CONNECTED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ BACKEND UNREACHABLE${NC}"
    fi
else
    echo -e "${YELLOW}⚠ API URL NOT FOUND${NC}"
fi

((TESTS_TOTAL++))

echo ""
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$((TESTS_TOTAL - TESTS_PASSED))${NC}"
echo -e "Total Tests: ${BLUE}$TESTS_TOTAL${NC}"

# Calculate success rate
SUCCESS_RATE=$((TESTS_PASSED * 100 / TESTS_TOTAL))

if [ $SUCCESS_RATE -eq 100 ]; then
    echo -e "${GREEN}🎉 Perfect Score! Deployment is working excellently.${NC}"
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${GREEN}✅ Great! Deployment is working well with minor issues.${NC}"
elif [ $SUCCESS_RATE -ge 60 ]; then
    echo -e "${YELLOW}⚠️ Good but needs attention. Some issues detected.${NC}"
else
    echo -e "${RED}❌ Needs work. Several issues detected.${NC}"
fi

echo ""
echo -e "${BLUE}=== Next Steps ===${NC}"

if [ $SUCCESS_RATE -ge 80 ]; then
    echo "1. ✅ Your frontend is deployed and working well!"
    echo "2. 🎯 Test wallet connection and authentication"
    echo "3. 🔍 Verify all features work in production"
    echo "4. 📊 Set up monitoring and analytics"
    echo "5. 🌐 Consider setting up a custom domain"
else
    echo "1. 🔧 Address the failed tests above"
    echo "2. 📋 Check Vercel deployment logs for errors"
    echo "3. 🔄 Redeploy after fixing issues"
    echo "4. 🧪 Run this test script again"
fi

echo ""
echo -e "${BLUE}🌐 Your BFN Platform:${NC} $DEPLOYMENT_URL"

exit $((TESTS_TOTAL - TESTS_PASSED))