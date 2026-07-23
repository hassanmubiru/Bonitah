#!/bin/bash

# Bonitah Financial Network Deployment Script
# Automates the deployment process for BFN contracts and services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_error "Node.js version must be >= 20, found v$NODE_VERSION"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Setup workspace
setup_workspace() {
    log_info "Setting up workspace..."
    
    # Install dependencies
    pnpm install
    
    # Build shared package
    cd shared
    pnpm build
    cd ..
    
    # Run linting and type checking
    pnpm lint
    pnpm typecheck
    
    log_success "Workspace setup complete"
}

# Deploy contracts
deploy_contracts() {
    log_info "Deploying smart contracts to Base Sepolia..."
    
    cd contracts
    
    # Check if environment is configured
    if [ ! -f .env ]; then
        log_error "contracts/.env file not found. Please create it with your deployment configuration."
        exit 1
    fi
    
    # Source the environment
    source .env
    
    # Check for required environment variables
    if [ -z "$PRIVATE_KEY" ] || [ -z "$BASE_SEPOLIA_RPC_URL" ]; then
        log_error "Required environment variables not set in contracts/.env"
        exit 1
    fi
    
    # Run tests first
    log_info "Running contract tests..."
    forge test
    
    # Deploy contracts
    log_info "Deploying contracts..."
    forge script script/Deploy.s.sol:Deploy \
        --rpc-url "$BASE_SEPOLIA_RPC_URL" \
        --private-key "$PRIVATE_KEY" \
        --broadcast \
        --verify || {
        log_error "Contract deployment failed"
        exit 1
    }
    
    cd ..
    log_success "Smart contracts deployed successfully"
}

# Update addresses
update_addresses() {
    log_info "Updating contract addresses in shared package..."
    
    # This would typically parse the deployment output
    # For now, we'll remind the user to do it manually
    log_warning "Please update contract addresses in shared/src/addresses.ts"
    log_warning "Then run: cd shared && pnpm build"
    
    read -p "Press Enter after updating addresses..."
}

# Deploy services
deploy_services() {
    log_info "Deploying services with Docker Compose..."
    
    cd docker
    
    # Check if environment is configured
    if [ ! -f .env ]; then
        log_warning "docker/.env file not found. Using defaults from .env.example"
        cp .env.example .env
        log_warning "Please update docker/.env with your production values"
        read -p "Press Enter to continue with current values..."
    fi
    
    # Build and start services
    docker compose build
    docker compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    if docker compose ps | grep -q "unhealthy"; then
        log_error "Some services are unhealthy"
        docker compose ps
        exit 1
    fi
    
    cd ..
    log_success "Services deployed successfully"
}

# Run verification tests
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check backend health
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    # Check frontend
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    log_success "Deployment verification complete"
}

# Main deployment function
main() {
    log_info "Starting Bonitah Financial Network deployment..."
    
    # Parse command line arguments
    DEPLOY_CONTRACTS=true
    DEPLOY_SERVICES=true
    SKIP_TESTS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --contracts-only)
                DEPLOY_SERVICES=false
                shift
                ;;
            --services-only)
                DEPLOY_CONTRACTS=false
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --contracts-only    Deploy only smart contracts"
                echo "  --services-only     Deploy only services"
                echo "  --skip-tests        Skip running tests"
                echo "  --help             Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    setup_workspace
    
    if [ "$DEPLOY_CONTRACTS" = true ]; then
        if [ "$SKIP_TESTS" = false ]; then
            # Run additional tests if not skipping
            log_info "Running full test suite..."
            pnpm test
        fi
        
        deploy_contracts
        update_addresses
    fi
    
    if [ "$DEPLOY_SERVICES" = true ]; then
        deploy_services
        verify_deployment
    fi
    
    # Final success message
    log_success "Bonitah Financial Network deployment completed successfully!"
    log_info "Services are running at:"
    log_info "  Frontend: http://localhost:3000"
    log_info "  Backend:  http://localhost:3001"
    log_info ""
    log_info "Next steps:"
    log_info "1. Test the application functionality"
    log_info "2. Configure monitoring and alerting"
    log_info "3. Set up SSL certificates for production"
    log_info "4. Review the deployment checklist in docs/DEPLOYMENT_CHECKLIST.md"
}

# Run main function with all arguments
main "$@"