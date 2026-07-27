# BFN Frontend - Vercel Deployment Guide

## 🚀 **Quick Deployment**

Deploy your BFN frontend to Vercel with one command:

```bash
./deploy-frontend-vercel.sh
```

This automated script will:

1. Configure environment variables
2. Install dependencies
3. Build the project
4. Deploy to Vercel production
5. Test the deployment

---

## 📋 **Prerequisites**

### 1. Vercel Account

- Sign up at [vercel.com](https://vercel.com)
- Install Vercel CLI: `npm install -g vercel`

### 2. Supabase Backend

- Complete Supabase backend deployment first
- Have your Supabase project reference ready

### 3. Project Setup

- Frontend code in `/frontend` directory
- Environment variables configured
- Dependencies installed

---

## 🔧 **Manual Deployment Steps**

If you prefer manual deployment:

### 1. Login to Vercel

```bash
vercel login
```

### 2. Configure Environment

```bash
cd frontend

# Update .env.local with your Supabase backend URL
NEXT_PUBLIC_API_URL=https://YOUR_PROJECT_REF.supabase.co/functions/v1/backend
```

### 3. Install Dependencies

```bash
pnpm install  # or npm install / yarn install
```

### 4. Build Project

```bash
pnpm run build
```

### 5. Deploy to Vercel

```bash
vercel --prod
```

---

## ⚙️ **Configuration Files**

### `vercel.json` - Deployment Configuration

```json
{
  "buildCommand": "pnpm run build",
  "framework": "nextjs",
  "regions": ["iad1", "sfo1", "fra1"],
  "headers": [...],
  "redirects": [...],
  "rewrites": [...]
}
```

### Environment Variables

Set these in Vercel dashboard or via CLI:

**Required:**

- `NEXT_PUBLIC_API_URL` - Supabase backend URL
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID
- `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` - Base Sepolia RPC endpoint

**Contract Addresses:**

- `NEXT_PUBLIC_REGISTRY_ADDRESS=0xBd81a62b21eaE93D74daB2B2D93e040D51f75db1`
- `NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS=0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6`
- `NEXT_PUBLIC_COMMUNITY_TREASURY_ADDRESS=0xa0D284d9080cb7F6676e62116E0A659BB4Ed9b04`
- `NEXT_PUBLIC_EDUCATION_ADDRESS=0x5A63Da81A04BE39d5469B8BD9281CbD3332b51ac`
- `NEXT_PUBLIC_GOVERNANCE_ADDRESS=0x13B14D148E3369dCC448006494810A95928eEEB4`
- `NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e`

---

## 🧪 **Testing Deployment**

### Automated Testing

```bash
./test-frontend-deployment.sh https://your-app.vercel.app
```

This tests:

- ✅ Page accessibility (/, /dashboard, /savings, etc.)
- ✅ Content rendering
- ✅ Security headers
- ✅ Performance metrics
- ✅ Backend API connection

### Manual Testing Checklist

- [ ] Home page loads correctly
- [ ] Wallet connection works
- [ ] Dashboard displays data
- [ ] AI chat functions
- [ ] Savings interface works
- [ ] Education content loads
- [ ] Profile management works
- [ ] All navigation links function

---

## 🔐 **Security Configuration**

### Security Headers

```javascript
// Configured in vercel.json
{
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
}
```

### Environment Security

- ✅ All secrets stored as environment variables
- ✅ No hardcoded API keys in code
- ✅ HTTPS enforced by default
- ✅ CSP headers configured

---

## ⚡ **Performance Optimizations**

### Build Optimizations

```javascript
// next.config.js
{
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/*"]
  },
  images: {
    formats: ['image/webp', 'image/avif']
  },
  compress: true
}
```

### Vercel Features

- ✅ **Edge Functions** for API routes
- ✅ **Image Optimization** with Next.js Image
- ✅ **Static Generation** for marketing pages
- ✅ **Global CDN** for fast worldwide access

### Performance Metrics

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

---

## 🌐 **Domain Configuration**

### Custom Domain Setup

1. **Purchase Domain** (recommended: .com, .app, .finance)
2. **Add to Vercel**:
   ```bash
   vercel domains add yourdomain.com
   ```
3. **Configure DNS**:
   - Add CNAME record: `www` → `cname.vercel-dns.com`
   - Add A record: `@` → `76.76.19.61`

### SSL Certificate

- ✅ Automatic SSL certificate provisioning
- ✅ HTTPS redirect enforced
- ✅ HSTS headers configured

---

## 📊 **Monitoring & Analytics**

### Vercel Analytics

```bash
# Enable in Vercel dashboard
- Real User Monitoring
- Core Web Vitals
- Conversion tracking
- A/B testing
```

### Error Tracking

```javascript
// Optional: Add Sentry integration
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
```

### Performance Monitoring

- **Vercel Speed Insights** - Real user metrics
- **Lighthouse CI** - Automated performance testing
- **Web Vitals** - Core performance indicators

---

## 🔄 **Continuous Deployment**

### Git Integration

```bash
# Connect to GitHub repository
vercel --confirm

# Automatic deployments on:
- Push to main branch → Production
- Pull requests → Preview deployments
- Branch pushes → Branch previews
```

### Deployment Hooks

```bash
# Deploy hook for external triggers
curl -X POST https://api.vercel.com/v1/integrations/deploy/your-hook-id
```

---

## 🐛 **Troubleshooting**

### Common Issues

#### **Build Failures**

```bash
# Check build logs
vercel logs your-deployment-url

# Common fixes:
- Update Node.js version in package.json
- Clear .next cache: rm -rf .next
- Check for TypeScript errors: pnpm typecheck
```

#### **Environment Variables Not Working**

```bash
# Verify variables are set
vercel env ls

# Add missing variables
vercel env add VARIABLE_NAME production
```

#### **API Connection Issues**

```bash
# Check CORS settings in backend
# Verify API URL is correct
# Test backend health endpoint
curl https://your-project.supabase.co/functions/v1/backend/health
```

#### **Performance Issues**

```bash
# Analyze bundle size
npm run analyze

# Check for unused dependencies
npx depcheck

# Optimize images and assets
```

### Debug Commands

```bash
# Local development
pnpm dev

# Local production build
pnpm build && pnpm start

# Check deployment status
vercel inspect your-deployment-url
```

---

## 💰 **Cost Optimization**

### Vercel Pricing

- **Hobby Plan**: Free (personal projects)
  - 100GB bandwidth/month
  - 1,000 build minutes/month
  - Basic analytics

- **Pro Plan**: $20/month (teams)
  - 1TB bandwidth/month
  - 6,000 build minutes/month
  - Advanced analytics
  - Password protection

### Cost-Saving Tips

1. **Optimize Bundle Size** - Remove unused dependencies
2. **Image Optimization** - Use Next.js Image component
3. **Static Generation** - Pre-generate pages when possible
4. **Edge Functions** - Minimize server-side operations

---

## 📈 **Scaling Considerations**

### Traffic Growth

- **Automatic Scaling** - Handles traffic spikes automatically
- **Global CDN** - Fast access worldwide
- **Edge Caching** - Reduced server load

### Performance at Scale

- **Static Asset Optimization** - Images, CSS, JS minification
- **Database Optimization** - Efficient API calls to Supabase
- **Caching Strategy** - Browser and CDN caching

---

## 🎯 **Production Checklist**

### Pre-Deploy

- [ ] All environment variables configured
- [ ] Build passes locally
- [ ] Tests pass
- [ ] Performance benchmarks met
- [ ] Security headers configured

### Post-Deploy

- [ ] All pages accessible
- [ ] Wallet connection works
- [ ] API integration functional
- [ ] Performance metrics acceptable
- [ ] Error monitoring configured

### Ongoing

- [ ] Monitor performance metrics
- [ ] Track Core Web Vitals
- [ ] Review security headers
- [ ] Update dependencies regularly

---

## 📞 **Support Resources**

### Documentation

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel CLI Reference](https://vercel.com/docs/cli)

### Community Support

- [Vercel Discord](https://discord.gg/vercel)
- [Next.js Discussions](https://github.com/vercel/next.js/discussions)

### Emergency Contacts

- **Vercel Status**: [status.vercel.com](https://status.vercel.com)
- **Support**: [vercel.com/support](https://vercel.com/support)

---

## 🎉 **Success Metrics**

Your deployment is successful when:

- ✅ **Accessibility**: All pages load < 2 seconds
- ✅ **Functionality**: Wallet connection and transactions work
- ✅ **Performance**: Core Web Vitals in green
- ✅ **Security**: All security headers present
- ✅ **Reliability**: 99.9%+ uptime
- ✅ **User Experience**: Smooth navigation and interactions

---

**🚀 Ready to deploy your BFN platform to production and serve users worldwide!**
