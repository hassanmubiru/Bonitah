# Bonitah Financial Network - Deployment Checklist

This checklist ensures all deployment steps are completed correctly and nothing is missed during the deployment process.

## Pre-Deployment Checklist

### Environment Setup

- [ ] Node.js >= 20.0.0 installed
- [ ] pnpm >= 9.0.0 installed
- [ ] Docker >= 24.0.0 installed
- [ ] Docker Compose >= 2.0.0 installed
- [ ] Git configured and repository cloned
- [ ] All dependencies installed (`pnpm install`)
- [ ] Shared package built successfully (`pnpm build`)

### Accounts and Keys

- [ ] Base Sepolia deployment wallet created with sufficient ETH (>= 0.1 ETH)
- [ ] OpenAI API key obtained with sufficient credits
- [ ] Pinata IPFS account created with JWT token
- [ ] Certificate issuer wallet created (separate from deployment wallet)
- [ ] All private keys stored securely (never in version control)

### Configuration Files

- [ ] `backend/.env` created from template with all values filled
- [ ] `frontend/.env.local` created (if needed)
- [ ] `contracts/.env` created with deployment wallet private key
- [ ] `docker/.env` created from template for Docker deployment
- [ ] All JWT secrets are >= 32 characters and cryptographically secure
- [ ] Database passwords are strong and unique

### Security Review

- [ ] All `.env` files added to `.gitignore`
- [ ] Secret scan passes (`pnpm secret-scan`)
- [ ] No hardcoded secrets in source code
- [ ] All environment variables use secure values
- [ ] Database credentials are not default values

## Smart Contract Deployment Checklist

### Pre-Deployment Tests

- [ ] All contract tests pass (`cd contracts && forge test`)
- [ ] Property-based tests pass with >= 100 iterations
- [ ] Coverage meets >= 90% line/branch requirements
- [ ] No compilation warnings or errors

### Mock Token Deployment (Test Environment)

- [ ] Mock ERC20 deployed successfully
- [ ] Token address recorded for contract deployment
- [ ] Test tokens minted to deployment wallet

### Main Contract Deployment

- [ ] Registry contract deployed and initialized
- [ ] SavingsVault contract deployed and initialized
- [ ] CommunityTreasury contract deployed and initialized
- [ ] Education contract deployed and initialized
- [ ] Governance contract deployed and initialized
- [ ] All contracts deployed behind UUPS proxies
- [ ] All contracts verified on BaseScan

### Contract Configuration

- [ ] REPUTATION_ROLE granted to Education contract on Registry
- [ ] VERIFIER_ROLE granted to appropriate verification account
- [ ] ISSUER_ROLE granted to certificate issuer account
- [ ] All role assignments verified
- [ ] Contract addresses updated in shared package (`shared/src/addresses.ts`)
- [ ] Shared package rebuilt with new addresses

### Contract Verification

- [ ] All contracts accessible at deployed addresses
- [ ] Basic contract functions working (register, deposit test)
- [ ] Cross-contract permissions configured correctly
- [ ] Event emission working for all state changes
- [ ] Proxy upgrade functionality verified

## Service Deployment Checklist

### Database Setup

- [ ] PostgreSQL container/instance running
- [ ] Database connectivity verified
- [ ] User permissions configured correctly
- [ ] Redis container/instance running
- [ ] Redis connectivity verified

### Backend Deployment

- [ ] Backend built successfully
- [ ] Prisma client generated
- [ ] Database migrations run successfully
- [ ] Environment variables loaded correctly
- [ ] Health endpoint responding (`/health`)
- [ ] Database connections working
- [ ] Redis connections working
- [ ] RPC connectivity to Base Sepolia verified

### Frontend Deployment

- [ ] Frontend built successfully
- [ ] Static assets generated
- [ ] Environment variables configured
- [ ] Application starts without errors
- [ ] Health check passing

### Full Stack Integration

- [ ] All services running via Docker Compose
- [ ] Inter-service communication working
- [ ] Health checks passing for all services
- [ ] Service discovery working correctly
- [ ] Log aggregation configured

## Post-Deployment Verification Checklist

### Contract Functionality

- [ ] User registration works via frontend
- [ ] Wallet connection successful (Base Sepolia)
- [ ] Test deposit transaction successful
- [ ] Test withdrawal transaction successful
- [ ] Savings goal creation works
- [ ] Community circle creation works
- [ ] Basic governance proposal works

### Backend Services

- [ ] Event indexer running and caching events
- [ ] Read-through cache working with 30s staleness
- [ ] SIWE authentication working
- [ ] JWT tokens issued and validated correctly
- [ ] Transaction history endpoint working
- [ ] Analytics endpoints returning provenanced data

### AI Assistant

- [ ] OpenAI API connectivity verified
- [ ] Chat functionality working
- [ ] On-chain figure reads working
- [ ] Response time <= 30 seconds
- [ ] Question length validation (2000 chars)
- [ ] Conversation history persisted

### IPFS Integration

- [ ] Pinata connectivity verified
- [ ] Document upload working (<=10 files, <=10MB each)
- [ ] PII validation working
- [ ] CID returned on successful uploads
- [ ] Error handling for failed uploads

### Education Platform

- [ ] Course content loading correctly
- [ ] Lesson completion tracking working
- [ ] Learning streak calculation correct
- [ ] Certificate issuance working (IPFS + on-chain)
- [ ] Reputation score updates working

## Production Configuration Checklist

### SSL/TLS Setup

- [ ] SSL certificates obtained and configured
- [ ] HTTPS redirection working
- [ ] Security headers configured
- [ ] HSTS enabled
- [ ] Certificate auto-renewal configured

### Performance Optimization

- [ ] Gzip compression enabled
- [ ] Static asset caching configured
- [ ] Database connection pooling optimized
- [ ] Redis memory limits set
- [ ] Rate limiting configured

### Monitoring and Logging

- [ ] Structured logging configured
- [ ] Log rotation setup
- [ ] Application performance monitoring configured
- [ ] Uptime monitoring setup
- [ ] Database performance monitoring
- [ ] Blockchain event monitoring

### Security Hardening

- [ ] Firewall rules configured
- [ ] Database access restricted
- [ ] Redis access secured
- [ ] Container security scanning passed
- [ ] Dependency vulnerability scan passed
- [ ] CORS origins properly configured

### Backup and Recovery

- [ ] Database backup strategy implemented
- [ ] Recovery procedures tested
- [ ] Configuration backup created
- [ ] Disaster recovery plan documented
- [ ] RTO/RPO requirements defined

## Go-Live Checklist

### Final Verification

- [ ] End-to-end user journey tested
- [ ] All major features functional
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Load testing passed (if applicable)

### Documentation

- [ ] Deployment guide updated
- [ ] API documentation current
- [ ] Contract documentation current
- [ ] Runbook created for operations team
- [ ] Troubleshooting guide updated

### Communication

- [ ] Stakeholders notified of deployment
- [ ] User communication prepared (if public)
- [ ] Support team trained on new features
- [ ] Rollback plan communicated

### Monitoring Setup

- [ ] All monitoring dashboards configured
- [ ] Alert thresholds set
- [ ] On-call procedures established
- [ ] Incident response plan updated
- [ ] Success metrics baseline established

## Post-Go-Live Tasks

### First 24 Hours

- [ ] Monitor all critical metrics
- [ ] Verify event indexing performance
- [ ] Check database performance
- [ ] Monitor error rates
- [ ] Verify backup completion

### First Week

- [ ] Review performance metrics
- [ ] Analyze user adoption (if applicable)
- [ ] Monitor gas usage patterns
- [ ] Review security logs
- [ ] Optimize based on real usage

### Ongoing Maintenance

- [ ] Regular security updates scheduled
- [ ] Performance monitoring reviewed weekly
- [ ] Database maintenance scheduled
- [ ] Backup verification scheduled
- [ ] Dependency updates planned

## Emergency Procedures

### Contract Issues

- [ ] Contract pause procedures documented
- [ ] Upgrade procedures tested
- [ ] Emergency contact list current

### Service Issues

- [ ] Service rollback procedures documented
- [ ] Database recovery procedures tested
- [ ] Communication templates prepared

### Security Incidents

- [ ] Incident response team identified
- [ ] Communication channels established
- [ ] Forensic procedures documented

---

**Note**: This checklist should be customized based on your specific deployment environment and requirements. Check off each item as it's completed and verify all items are complete before proceeding to the next phase.
