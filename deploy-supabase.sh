#!/bin/bash

# BFN Backend - Supabase Deployment Script
# This script deploys the complete backend to Supabase Edge Functions

set -e

echo "🚀 BFN Backend - Supabase Deployment Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Please install it first:${NC}"
    echo "npm install -g supabase"
    echo "# or"
    echo "brew install supabase/tap/supabase"
    exit 1
fi

echo -e "${BLUE}✓ Supabase CLI found${NC}"

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️ Not logged in to Supabase. Please login first:${NC}"
    echo "supabase login"
    exit 1
fi

echo -e "${BLUE}✓ Supabase authentication verified${NC}"

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo -e "${RED}❌ Not in project root or Supabase not initialized${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo -e "${BLUE}✓ Project structure verified${NC}"

# Get project reference from config or environment
PROJECT_REF=""
if [ -f ".env" ]; then
    PROJECT_REF=$(grep "SUPABASE_PROJECT_REF" .env | cut -d '=' -f2 | tr -d '"' | tr -d ' ')
fi

if [ -z "$PROJECT_REF" ]; then
    echo -e "${YELLOW}📋 Creating new Supabase project...${NC}"
    
    # Create new project
    echo "Enter project name (default: bfn-backend):"
    read -r PROJECT_NAME
    PROJECT_NAME=${PROJECT_NAME:-bfn-backend}
    
    echo "Enter region (default: us-east-1):"
    read -r REGION  
    REGION=${REGION:-us-east-1}
    
    echo -e "${BLUE}🏗️ Creating Supabase project: $PROJECT_NAME${NC}"
    
    # Create project and capture output
    CREATE_OUTPUT=$(supabase projects create "$PROJECT_NAME" --region "$REGION" 2>&1)
    PROJECT_REF=$(echo "$CREATE_OUTPUT" | grep -oE '[a-z]{20}' | head -n1)
    
    if [ -z "$PROJECT_REF" ]; then
        echo -e "${RED}❌ Failed to create project. Output:${NC}"
        echo "$CREATE_OUTPUT"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Project created with ref: $PROJECT_REF${NC}"
    
    # Save project ref to environment
    echo "SUPABASE_PROJECT_REF=$PROJECT_REF" >> .env
    echo "SUPABASE_URL=https://$PROJECT_REF.supabase.co" >> .env
    
else
    echo -e "${BLUE}✓ Using existing project: $PROJECT_REF${NC}"
fi

# Link to project
echo -e "${BLUE}🔗 Linking to Supabase project...${NC}"
supabase link --project-ref "$PROJECT_REF"

# Apply database migrations
echo -e "${BLUE}📊 Applying database migrations...${NC}"
supabase db push

# Deploy Edge Function
echo -e "${BLUE}⚡ Deploying Edge Function...${NC}"
supabase functions deploy backend --no-verify-jwt

# Set environment variables reminder
echo -e "${YELLOW}📋 IMPORTANT: Set these environment variables in your Supabase dashboard:${NC}"
echo -e "${BLUE}https://app.supabase.com/project/$PROJECT_REF/settings/functions${NC}"
echo ""
echo "Required environment variables:"
echo "BASE_SEPOLIA_RPC_URL=https://sepolia.base.org"
echo "CHAIN_ID=84532"
echo "JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long"
echo "OLLAMA_API_KEY=72979e69393a4fe8a7dad878cd33b1bb.5vOXRFCZj0UKXnuWt8QVfTQv"
echo "DEEPSEEK_API_KEY=sk-b4f30b64439b49d3b443181404b287ec"
echo ""

# Update frontend environment
FRONTEND_ENV_FILE="frontend/.env.local"
if [ -f "$FRONTEND_ENV_FILE" ]; then
    echo -e "${BLUE}🎯 Updating frontend configuration...${NC}"
    
    # Update or add NEXT_PUBLIC_API_URL
    API_URL="https://$PROJECT_REF.supabase.co/functions/v1/backend"
    
    if grep -q "NEXT_PUBLIC_API_URL" "$FRONTEND_ENV_FILE"; then
        # Update existing line
        sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=$API_URL|" "$FRONTEND_ENV_FILE"
    else
        # Add new line
        echo "NEXT_PUBLIC_API_URL=$API_URL" >> "$FRONTEND_ENV_FILE"
    fi
    
    echo -e "${GREEN}✓ Frontend configuration updated${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend .env.local not found. Please create it with:${NC}"
    echo "NEXT_PUBLIC_API_URL=https://$PROJECT_REF.supabase.co/functions/v1/backend"
fi

# Test deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
API_URL="https://$PROJECT_REF.supabase.co/functions/v1/backend"

# Test health endpoint
echo "Testing health endpoint..."
if curl -s -f "$API_URL/health" > /dev/null; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
fi

# Test AI provider endpoint
echo "Testing AI provider endpoint..."
if curl -s -f "$API_URL/ai/provider" > /dev/null; then
    echo -e "${GREEN}✓ AI provider endpoint responding${NC}"
else
    echo -e "${YELLOW}⚠️ AI provider endpoint not responding (may need env vars)${NC}"
fi

# Display deployment summary
echo ""
echo -e "${GREEN}🎉 Deployment Summary:${NC}"
echo -e "${BLUE}Project Ref:${NC} $PROJECT_REF"
echo -e "${BLUE}API URL:${NC} $API_URL"
echo -e "${BLUE}Dashboard:${NC} https://app.supabase.com/project/$PROJECT_REF"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Set environment variables in Supabase dashboard"
echo "2. Test all endpoints using the provided URLs"
echo "3. Deploy your frontend to Vercel"
echo "4. Update any hardcoded API URLs in your frontend"
echo ""
echo -e "${GREEN}✅ BFN Backend deployment completed successfully!${NC}"

# Optional: Open dashboard in browser
read -p "Open Supabase dashboard in browser? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "https://app.supabase.com/project/$PROJECT_REF"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "https://app.supabase.com/project/$PROJECT_REF"
    else
        echo "Please manually open: https://app.supabase.com/project/$PROJECT_REF"
    fi
fi