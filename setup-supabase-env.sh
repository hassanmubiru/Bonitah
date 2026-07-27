#!/bin/bash

# BFN Backend - Supabase Environment Setup Script
# This script sets up all required environment variables in Supabase

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 BFN Backend - Supabase Environment Setup${NC}"

# Get project reference
PROJECT_REF=""
if [ -f ".env" ]; then
    PROJECT_REF=$(grep "SUPABASE_PROJECT_REF" .env | cut -d '=' -f2 | tr -d '"' | tr -d ' ')
fi

if [ -z "$PROJECT_REF" ]; then
    echo "Enter your Supabase project reference:"
    read -r PROJECT_REF
fi

echo -e "${BLUE}Project Reference: $PROJECT_REF${NC}"

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Setting up environment variables...${NC}"

# Set environment variables using Supabase CLI
supabase secrets set --project-ref "$PROJECT_REF" \
  BASE_SEPOLIA_RPC_URL="https://sepolia.base.org" \
  CHAIN_ID="84532" \
  JWT_SECRET="bfn-super-secure-jwt-secret-for-production-use-minimum-32-characters" \
  OLLAMA_API_KEY="72979e69393a4fe8a7dad878cd33b1bb.5vOXRFCZj0UKXnuWt8QVfTQv" \
  DEEPSEEK_API_KEY="sk-b4f30b64439b49d3b443181404b287ec" \
  OPENAI_API_KEY="" \
  NODE_ENV="production" \
  LOG_LEVEL="info"

echo -e "${GREEN}✓ Environment variables set successfully${NC}"

# Restart Edge Functions to apply new environment
echo -e "${BLUE}🔄 Restarting Edge Functions...${NC}"
supabase functions deploy backend --project-ref "$PROJECT_REF" --no-verify-jwt

echo -e "${GREEN}✅ Environment setup completed!${NC}"
echo ""
echo -e "${BLUE}You can verify the setup by running:${NC}"
echo "./test-supabase-backend.sh"