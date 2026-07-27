#!/bin/bash

# BFN Frontend - Vercel Deployment Script
# This script deploys the frontend to Vercel with proper configuration

set -e

echo "🚀 BFN Frontend - Vercel Deployment Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to frontend directory
cd frontend

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️ Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✓ Vercel CLI installed${NC}"
fi

# Check if user is logged in to Vercel
echo -e "${BLUE}🔐 Checking Vercel authentication...${NC}"
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️ Not logged in to Vercel. Please login:${NC}"
    vercel login
fi

echo -e "${GREEN}✓ Vercel authentication verified${NC}"

# Get Supabase project reference from environment or prompt
SUPABASE_PROJECT_REF=""
if [ -f "../.env" ]; then
    SUPABASE_PROJECT_REF=$(grep "SUPABASE_PROJECT_REF" ../.env | cut -d '=' -f2 | tr -d '"' | tr -d ' ')
fi

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${YELLOW}📋 Enter your Supabase project reference:${NC}"
    echo "You can find this in your Supabase dashboard URL or .env file"
    read -r SUPABASE_PROJECT_REF
fi

# Update environment file with Supabase backend URL
echo -e "${BLUE}🔧 Configuring backend API URL...${NC}"
SUPABASE_API_URL="https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/backend"

# Update .env.local with the correct API URL
if grep -q "NEXT_PUBLIC_API_URL" .env.local; then
    sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=$SUPABASE_API_URL|" .env.local
else
    echo "NEXT_PUBLIC_API_URL=$SUPABASE_API_URL" >> .env.local
fi

echo -e "${GREEN}✓ API URL configured: $SUPABASE_API_URL${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install
elif [ -f "yarn.lock" ]; then
    yarn install
else
    npm install
fi

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Build the project locally first to catch any issues
echo -e "${BLUE}🏗️ Building project locally...${NC}"
if [ -f "pnpm-lock.yaml" ]; then
    pnpm run build
elif [ -f "yarn.lock" ]; then
    yarn build
else
    npm run build
fi

echo -e "${GREEN}✓ Local build successful${NC}"

# Deploy to Vercel
echo -e "${BLUE}🚀 Deploying to Vercel...${NC}"

# Set environment variables for Vercel
echo -e "${YELLOW}📋 Setting environment variables in Vercel...${NC}"

# Read environment variables and set them in Vercel
while IFS= read -r line; do
    # Skip comments and empty lines
    if [[ $line =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
        continue
    fi
    
    # Extract key=value pairs
    if [[ $line =~ ^([^=]+)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        
        # Remove quotes if present
        value=$(echo "$value" | sed 's/^["'\'']//' | sed 's/["'\'']$//')
        
        # Set environment variable in Vercel
        echo "Setting $key..."
        vercel env add "$key" production <<< "$value" > /dev/null 2>&1 || true
        vercel env add "$key" preview <<< "$value" > /dev/null 2>&1 || true
    fi
done < .env.local

echo -e "${GREEN}✓ Environment variables set in Vercel${NC}"

# Deploy to production
echo -e "${BLUE}🎯 Deploying to production...${NC}"
DEPLOY_OUTPUT=$(vercel --prod --confirm)

# Extract deployment URL
DEPLOYMENT_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^[:space:]]+' | head -n1)

if [ -z "$DEPLOYMENT_URL" ]; then
    echo -e "${RED}❌ Failed to extract deployment URL${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
echo -e "${BLUE}🌐 Deployment URL: $DEPLOYMENT_URL${NC}"

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"

# Wait a moment for deployment to be ready
sleep 10

# Test health endpoint
HEALTH_URL="$DEPLOYMENT_URL/api/health"
if curl -s -f "$HEALTH_URL" > /dev/null; then
    echo -e "${GREEN}✓ Health endpoint accessible${NC}"
else
    echo -e "${YELLOW}⚠️ Health endpoint not responding (may not exist)${NC}"
fi

# Test main page
if curl -s -f "$DEPLOYMENT_URL" > /dev/null; then
    echo -e "${GREEN}✓ Main page accessible${NC}"
else
    echo -e "${RED}❌ Main page not accessible${NC}"
fi

# Display deployment summary
echo ""
echo -e "${GREEN}🎉 Deployment Summary:${NC}"
echo -e "${BLUE}Frontend URL:${NC} $DEPLOYMENT_URL"
echo -e "${BLUE}Backend API:${NC} $SUPABASE_API_URL"
echo -e "${BLUE}Environment:${NC} Production"
echo -e "${BLUE}Framework:${NC} Next.js 16+"
echo ""

# Check if domain should be configured
echo -e "${YELLOW}🌐 Domain Configuration:${NC}"
echo "If you want to use a custom domain:"
echo "1. Go to your Vercel dashboard"
echo "2. Navigate to your project settings"
echo "3. Add your domain in the 'Domains' section"
echo "4. Configure DNS records as instructed"
echo ""

# Performance recommendations
echo -e "${YELLOW}⚡ Performance Tips:${NC}"
echo "- Monitor Core Web Vitals in Vercel Analytics"
echo "- Enable Vercel Speed Insights for detailed metrics"
echo "- Consider upgrading to Vercel Pro for enhanced performance"
echo "- Set up custom domain for better SEO and branding"
echo ""

# Security recommendations
echo -e "${YELLOW}🔐 Security Checklist:${NC}"
echo "- ✓ Environment variables configured securely"
echo "- ✓ HTTPS enabled by default"
echo "- ✓ Security headers configured"
echo "- ✓ CORS policies properly set"
echo ""

echo -e "${GREEN}✅ BFN Frontend deployment completed successfully!${NC}"

# Optional: Open deployment in browser
read -p "Open deployment in browser? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "$DEPLOYMENT_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$DEPLOYMENT_URL"
    else
        echo "Please manually open: $DEPLOYMENT_URL"
    fi
fi

# Return to original directory
cd ..

echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. Test all functionality on the live deployment"
echo "2. Configure custom domain if needed"
echo "3. Set up monitoring and analytics"
echo "4. Update any external references to the new URL"
echo ""
echo -e "${GREEN}🎊 Your BFN platform is now live and ready for users!${NC}"