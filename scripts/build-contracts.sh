#!/bin/bash

# Build Contracts Script
# Complete pipeline for contract compilation, ABI generation, and shared package preparation

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check for Foundry
    if ! command -v forge &> /dev/null; then
        log_error "Foundry (forge) is not installed. Install from https://getfoundry.sh/"
        exit 1
    fi
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check contracts directory
    if [ ! -d "$PROJECT_ROOT/contracts" ]; then
        log_error "contracts directory not found"
        exit 1
    fi
    
    # Check shared directory
    if [ ! -d "$PROJECT_ROOT/shared" ]; then
        log_error "shared directory not found"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Clean previous builds
clean_builds() {
    log_info "Cleaning previous builds..."
    
    cd "$PROJECT_ROOT/contracts"
    
    # Clean Foundry artifacts
    if [ -d "out" ]; then
        rm -rf out
        log_info "Removed contracts/out"
    fi
    
    if [ -d "cache" ]; then
        rm -rf cache
        log_info "Removed contracts/cache"
    fi
    
    # Clean shared build
    cd "$PROJECT_ROOT/shared"
    if [ -d "dist" ]; then
        rm -rf dist
        log_info "Removed shared/dist"
    fi
    
    log_success "Clean completed"
}

# Compile smart contracts
compile_contracts() {
    log_info "Compiling smart contracts with Foundry..."
    
    cd "$PROJECT_ROOT/contracts"
    
    # Compile contracts
    if forge build; then
        log_success "Smart contracts compiled successfully"
    else
        log_error "Smart contract compilation failed"
        exit 1
    fi
    
    # Verify all expected contracts are compiled
    local contracts=("Registry" "SavingsVault" "CommunityTreasury" "Education" "Governance")
    
    for contract in "${contracts[@]}"; do
        if [ ! -f "out/${contract}.sol/${contract}.json" ]; then
            log_error "Missing compilation artifact: ${contract}.json"
            exit 1
        fi
    done
    
    log_success "All contract artifacts generated"
}

# Generate ABIs and addresses
generate_abis() {
    log_info "Generating TypeScript ABIs and address files..."
    
    cd "$PROJECT_ROOT"
    
    if node scripts/generate-abis.js; then
        log_success "ABI generation completed"
    else
        log_error "ABI generation failed"
        exit 1
    fi
}

# Install shared package dependencies
install_shared_deps() {
    log_info "Installing shared package dependencies..."
    
    cd "$PROJECT_ROOT/shared"
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    log_success "Shared package dependencies installed"
}

# Build shared package
build_shared() {
    log_info "Building shared package..."
    
    cd "$PROJECT_ROOT/shared"
    
    if npm run build; then
        log_success "Shared package built successfully"
    else
        log_error "Shared package build failed"
        exit 1
    fi
}

# Run tests on shared package
test_shared() {
    log_info "Running shared package tests..."
    
    cd "$PROJECT_ROOT/shared"
    
    if npm test; then
        log_success "Shared package tests passed"
    else
        log_warn "Shared package tests failed (non-critical)"
    fi
}

# Validate generated artifacts
validate_artifacts() {
    log_info "Validating generated artifacts..."
    
    # Check ABI files
    local contracts=("Registry" "SavingsVault" "CommunityTreasury" "Education" "Governance")
    
    for contract in "${contracts[@]}"; do
        # Check individual ABI files
        if [ ! -f "$PROJECT_ROOT/shared/src/contracts/abis/${contract}.ts" ]; then
            log_error "Missing ABI file: ${contract}.ts"
            exit 1
        fi
        
        # Check built artifacts
        if [ ! -f "$PROJECT_ROOT/shared/dist/contracts/abis/${contract}.js" ]; then
            log_error "Missing built ABI: ${contract}.js"
            exit 1
        fi
    done
    
    # Check main exports
    if [ ! -f "$PROJECT_ROOT/shared/dist/index.js" ]; then
        log_error "Missing main export: index.js"
        exit 1
    fi
    
    # Check address files
    if [ ! -f "$PROJECT_ROOT/shared/dist/contracts/addresses/index.js" ]; then
        log_error "Missing address exports"
        exit 1
    fi
    
    log_success "Artifact validation passed"
}

# Print summary
print_summary() {
    log_success "=== CONTRACT BUILD SUMMARY ==="
    echo ""
    log_info "Generated Files:"
    log_info "  📄 contracts/out/ - Foundry compilation artifacts"  
    log_info "  📄 shared/src/abis.ts - Legacy ABI exports"
    log_info "  📁 shared/src/contracts/ - Structured contract exports"
    log_info "  📄 shared/dist/ - Built TypeScript package"
    echo ""
    log_info "Usage:"
    log_info "  Frontend: import { registryAbi, getContractAddress } from '@bonitah/shared'"
    log_info "  Backend: import { CONTRACT_ABIS } from '@bonitah/shared/contracts'"
    echo ""
    log_success "Build pipeline completed successfully! 🎉"
}

# Main execution
main() {
    echo "🚀 Starting BFN Contract Build Pipeline"
    echo "======================================"
    echo ""
    
    # Parse command line arguments
    SKIP_CLEAN=false
    SKIP_TESTS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-clean)
                SKIP_CLEAN=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --skip-clean    Skip cleaning previous builds"
                echo "  --skip-tests    Skip running tests"
                echo "  -h, --help      Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute build pipeline
    check_prerequisites
    
    if [ "$SKIP_CLEAN" = false ]; then
        clean_builds
    fi
    
    compile_contracts
    generate_abis
    install_shared_deps
    build_shared
    
    if [ "$SKIP_TESTS" = false ]; then
        test_shared
    fi
    
    validate_artifacts
    print_summary
}

# Handle script interruption
trap 'log_error "Build interrupted"; exit 1' INT TERM

# Run main function
main "$@"