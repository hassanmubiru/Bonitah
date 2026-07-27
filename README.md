# 🏦 Bonitah Financial Network (BFN)

**Democratizing financial education through blockchain technology and AI-powered guidance**

A decentralized platform combining real smart contracts, AI financial assistance, and educational resources to make financial literacy accessible globally.

---

## 🚀 **Quick Start**

```bash
# Clone and install
git clone <repo-url>
cd Bonitah
pnpm install

# Start development environment
pnpm dev        # Frontend: http://localhost:3000
pnpm start:dev  # Backend:  http://localhost:3002
```

## ⚡ **Key Features**

- 🔗 **Real Smart Contracts** - Base Sepolia integration with USDC
- 🤖 **AI Financial Assistant** - Ollama Cloud (Qwen 2.5 72B) + DeepSeek fallback  
- 💰 **DeFi Savings** - Smart contract-based savings vault
- 🎓 **Financial Education** - Interactive courses with on-chain certificates
- 🌍 **Global Access** - Wallet-based authentication, works anywhere

## 🏗️ **Architecture**

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Frontend  │───▶│   Backend    │───▶│ Smart Contracts │
│  (Next.js)  │    │  (NestJS)    │    │  (Base Sepolia) │
└─────────────┘    └──────────────┘    └─────────────────┘
       │                   │                      │
       │                   ▼                      │
       │            ┌──────────────┐              │
       │            │      AI      │              │
       └────────────│  (Ollama)    │──────────────┘
                    └──────────────┘
```

## 📁 **Project Structure**

```
Bonitah/
├── frontend/          # Next.js 16 + React 19 + RainbowKit
├── backend/           # NestJS + Prisma + Redis
├── contracts/         # Foundry smart contracts
├── shared/            # TypeScript shared types/utils
├── docs/              # All documentation (organized!)
│   ├── deployment/    # Deployment guides
│   ├── integration/   # Integration docs  
│   ├── performance/   # Performance optimization
│   └── testing/       # Test documentation
└── scripts/           # Deployment and utility scripts
```

## 🛠️ **Technology Stack**

### **Frontend**
- **Next.js 16** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **RainbowKit** - Wallet connection and Web3 UI
- **TailwindCSS** - Utility-first styling
- **Wagmi + Viem** - Type-safe Ethereum interactions

### **Backend**  
- **NestJS** - Scalable Node.js framework
- **Prisma** - Type-safe database ORM
- **Redis** - High-performance caching
- **JWT** - Secure authentication
- **AI Integration** - Multiple provider support

### **Blockchain**
- **Base Sepolia** - Layer 2 testnet
- **Foundry** - Smart contract development
- **Real USDC** - Circle's official stablecoin
- **Viem** - Type-safe contract interactions

### **AI & Education**
- **Ollama Cloud** - Qwen 2.5 72B model
- **DeepSeek** - Cost-effective fallback
- **Financial Guidance** - Contextual AI assistance
- **On-chain Certificates** - Verifiable achievements

## 🌟 **Current Status**

- ✅ **Smart Contracts**: Deployed on Base Sepolia with real USDC
- ✅ **Frontend**: Production-ready with wallet integration  
- ✅ **Backend**: Full API with authentication and AI
- ✅ **AI Integration**: Ollama Cloud + DeepSeek working
- ✅ **Performance**: Optimized (63% faster loading)
- ✅ **Documentation**: Comprehensive guides available

## 📚 **Documentation**

- **[Deployment Guide](docs/deployment/production-deployment-guide.md)** - Production deployment
- **[AI Integration](docs/integration/ollama-cloud-integration.md)** - Ollama Cloud setup
- **[Performance Optimization](docs/performance/performance-optimization.md)** - Speed improvements  
- **[Real Contracts Integration](docs/integration/REAL_CONTRACTS_INTEGRATION_COMPLETE.md)** - Blockchain setup

## 💡 **Development**

```bash
# Install dependencies
pnpm install

# Environment setup
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Configure your environment variables

# Database setup
cd backend && pnpm db:migrate && pnpm db:seed

# Start development
pnpm dev          # Frontend development server
pnpm start:dev    # Backend development server
```

## 🧪 **Testing**

```bash
# Frontend tests
cd frontend && pnpm test

# Backend tests  
cd backend && pnpm test

# Smart contract tests
cd contracts && forge test

# E2E tests
cd frontend && pnpm test:e2e
```

## 🚀 **Deployment**

```bash
# Build for production
pnpm build

# Deploy smart contracts (Base Sepolia)
cd contracts && ./scripts/deploy-base-sepolia.sh

# Deploy backend (Docker + Railway)
docker build -t bfn-backend ./backend
# See deployment docs for full guide

# Deploy frontend (Vercel)
vercel deploy
```

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🌍 **Mission**

Democratizing financial education by combining:
- **Blockchain transparency** for trust and verification
- **AI guidance** for personalized learning  
- **Real assets** for practical experience
- **Global accessibility** for universal impact

---

**Built with ❤️ for global financial literacy**