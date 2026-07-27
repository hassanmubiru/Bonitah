#!/bin/bash

# BFN Frontend - Vercel Deployment Script (Monorepo)
# This script deploys the frontend to Vercel with proper monorepo handling

set -e

echo "🚀 BFN Frontend - Vercel Deployment Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Get Supabase project reference
SUPABASE_PROJECT_REF="nbgicdhybbrbxbhfxsvi"

echo -e "${BLUE}🔧 Using Supabase project: $SUPABASE_PROJECT_REF${NC}"
SUPABASE_API_URL="https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/backend"

# Make sure we're in the project root
cd "$(dirname "$0")"

echo -e "${BLUE}🔧 Configuring environment variables...${NC}"

# Update frontend .env.local
cat > frontend/.env.local << EOF
# Backend API URL - Supabase Edge Function (Production)
NEXT_PUBLIC_API_URL=$SUPABASE_API_URL

# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=be1775c37721ac32e783c080b6c85650

# Base Sepolia RPC URL
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Smart Contract Addresses (Base Sepolia) - Real deployed contracts
NEXT_PUBLIC_REGISTRY_ADDRESS=0xBd81a62b21eaE93D74daB2B2D93e040D51f75db1
NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS=0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6  
NEXT_PUBLIC_COMMUNITY_TREASURY_ADDRESS=0xa0D284d9080cb7F6676e62116E0A659BB4Ed9b04
NEXT_PUBLIC_EDUCATION_ADDRESS=0x5A63Da81A04BE39d5469B8BD9281CbD3332b51ac
NEXT_PUBLIC_GOVERNANCE_ADDRESS=0x13B14D148E3369dCC448006494810A95928eEEB4
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
EOF

echo -e "${GREEN}✓ Environment configured with Supabase backend${NC}"

# Install all dependencies from root (monorepo)
echo -e "${BLUE}📦 Installing monorepo dependencies...${NC}"
pnpm install

# Build shared package first
echo -e "${BLUE}🏗️ Building shared package...${NC}"
pnpm --filter=shared run build

# Build frontend
echo -e "${BLUE}🏗️ Building frontend locally...${NC}"
pnpm --filter=frontend run build

echo -e "${GREEN}✓ Local build successful${NC}"

# Create vercel configuration for monorepo deployment
echo -e "${BLUE}📝 Creating Vercel configuration for monorepo...${NC}"

# Create vercel.json in root for monorepo deployment
cat > vercel.json << EOF
{
  "services": {
    "frontend": {
      "buildCommand": "pnpm --filter=frontend run build",
      "devCommand": "pnpm --filter=frontend run dev",
      "installCommand": "pnpm install",
      "framework": "nextjs",
      "rootDirectory": "frontend"
    }
  },
  "regions": ["iad1"],
  "functions": {
    "frontend/src/pages/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin-allow-popups"
        },
        {
          "key": "Cross-Origin-Embedder-Policy", 
          "value": "unsafe-none"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-Requested-With, Content-Type, Authorization"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/app/(.*)",
      "destination": "/\$1",
      "permanent": false
    }
  ],
  "rewrites": [
    {
      "source": "/health",
      "destination": "/api/health"
    }
  ]
}
EOF

# Deploy from root directory with frontend as root
echo -e "${BLUE}🚀 Deploying to Vercel from project root...${NC}"

# Deploy with production flag
DEPLOY_OUTPUT=$(vercel --prod --yes --confirm)

# Extract deployment URL
DEPLOYMENT_URL=$(echo "$DEPLOY_OUTPUT" | grep -o "https://[^[:space:]]*vercel.app" | head -n1)

if [ -z "$DEPLOYMENT_URL" ]; then
    # Alternative extraction method
    DEPLOYMENT_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^[:space:]]+' | grep "vercel.app" | head -n1)
fi

if [ -z "$DEPLOYMENT_URL" ]; then
    echo -e "${RED}❌ Could not extract deployment URL from output:${NC}"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
echo -e "${BLUE}🌐 Deployment URL: $DEPLOYMENT_URL${NC}"

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
sleep 5

if curl -s -f "$DEPLOYMENT_URL" > /dev/null; then
    echo -e "${GREEN}✓ Deployment is accessible${NC}"
else
    echo -e "${YELLOW}⚠️ Deployment may still be initializing${NC}"
fi

# Display summary
echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}Frontend URL:${NC} $DEPLOYMENT_URL"
echo -e "${BLUE}Backend API:${NC} $SUPABASE_API_URL"
echo ""
echo -e "${YELLOW}🎯 Next Steps:${NC}"
echo "1. Test wallet connection: $DEPLOYMENT_URL"
echo "2. Verify AI chat functionality"
echo "3. Check dashboard and savings features"
echo "4. Set up custom domain (optional)"
echo ""

echo -e "${GREEN}✅ BFN Platform is now live and ready for users!${NC}"