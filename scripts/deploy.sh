#!/bin/bash

# Production deployment script for qerrors
# This script handles the complete deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="qerrors"
BACKUP_DIR="./backups"
DEPLOYMENT_LOG="./logs/deployment.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "./logs"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$DEPLOYMENT_LOG"
}

log_info() {
    log "INFO" "${BLUE}$1${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$1${NC}"
}

log_warning() {
    log "WARNING" "${YELLOW}$1${NC}"
}

log_error() {
    log "ERROR" "${RED}$1${NC}"
}

# Error handling
error_exit() {
    log_error "$1"
    log_error "Deployment failed. Check logs for details."
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        error_exit "Node.js is not installed"
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_NODE_VERSION="18"
    if ! node -e "const v = process.version.replace('v', '').split('.')[0]; process.exit(v >= 18 ? 0 : 1)" 2>/dev/null; then
        error_exit "Node.js v18+ is required. Current version: $NODE_VERSION"
    fi
    log_success "Node.js version check passed: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error_exit "npm is not installed"
    fi
    log_success "npm is available: $(npm --version)"
    
    # Check if required files exist
    REQUIRED_FILES=("package.json" "tsconfig.json" "index.js" "index.ts")
    for file in "${REQUIRED_FILES[@]}"; do
        if [[ ! -f "$file" ]]; then
            error_exit "Required file missing: $file"
        fi
    done
    log_success "Required files check passed"
}

# Create backup
create_backup() {
    log_info "Creating backup..."
    
    local backup_name="${PROJECT_NAME}_backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    # Create backup of current deployment
    if [[ -d "dist" ]]; then
        cp -r dist "$backup_path/"
        log_success "Backup created: $backup_path"
    else
        log_warning "No dist directory found, skipping backup"
    fi
    
    # Backup configuration files
    mkdir -p "$backup_path/config"
    if [[ -d "config" ]]; then
        cp -r config/* "$backup_path/config/"
    fi
    
    # Backup logs if they exist
    if [[ -d "logs" ]]; then
        cp -r logs "$backup_path/"
        log_success "Logs backed up"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Clean existing node_modules if clean install requested
    if [[ "$1" == "--clean" ]]; then
        log_info "Performing clean install..."
        rm -rf node_modules
    fi
    
    # Install production dependencies only
    npm ci --only=production || error_exit "Dependency installation failed"
    log_success "Dependencies installed"
}

# Build the project
build_project() {
    log_info "Building the project..."
    
    # Clean previous build
    if [[ -d "dist" ]]; then
        rm -rf dist
        log_info "Cleaned previous build"
    fi
    
    # Run build script
    node scripts/build.js || error_exit "Build failed"
    log_success "Build completed"
}

# Run validation
validate_deployment() {
    log_info "Validating deployment..."
    
    # Run configuration validation
    node scripts/validate-config.js || error_exit "Configuration validation failed"
    
    # Run deployment validation
    node scripts/deploy.js || error_exit "Deployment validation failed"
    
    log_success "Deployment validation passed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Run monitoring setup
    node scripts/setup-monitoring.js || error_exit "Monitoring setup failed"
    
    log_success "Monitoring setup completed"
}

# Health check
health_check() {
    log_info "Performing post-deployment health check..."
    
    # Check if main module can be required
    node -e "
        try {
            const qerrors = require('./dist/index.js');
            console.log('✓ Main module loads successfully');
            
            if (typeof qerrors.middleware === 'function') {
                console.log('✓ Middleware function available');
            } else {
                throw new Error('Middleware function not available');
            }
            
            if (typeof qerrors.generateErrorId === 'function') {
                console.log('✓ Error ID generator available');
            } else {
                throw new Error('Error ID generator not available');
            }
            
            console.log('✓ All core functionality checks passed');
        } catch (error) {
            console.error('✗ Health check failed:', error.message);
            process.exit(1);
        }
    " || error_exit "Health check failed"
    
    log_success "Health check passed"
}

# Update process manager (if using PM2)
update_process_manager() {
    if command -v pm2 &> /dev/null; then
        log_info "Updating PM2 process..."
        
        if pm2 list | grep -q "$PROJECT_NAME"; then
            pm2 reload "$PROJECT_NAME" || log_warning "PM2 reload failed"
        else
            log_info "PM2 process not found, skipping reload"
        fi
        
        log_success "PM2 update completed"
    else
        log_info "PM2 not found, skipping process manager update"
    fi
}

# Cleanup old backups
cleanup_backups() {
    log_info "Cleaning up old backups..."
    
    # Keep only the last 7 backups
    find "$BACKUP_DIR" -type d -name "${PROJECT_NAME}_backup_*" -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
    log_success "Old backups cleaned up"
}

# Main deployment function
deploy() {
    local clean_install=${1:-"false"}
    
    log_info "Starting $PROJECT_NAME deployment..."
    log_info "Deployment started at: $(date)"
    
    # Deployment steps
    check_prerequisites
    create_backup
    install_dependencies "$clean_install"
    build_project
    validate_deployment
    setup_monitoring
    health_check
    update_process_manager
    cleanup_backups
    
    log_success "Deployment completed successfully!"
    log_info "Deployment finished at: $(date)"
    
    # Post-deployment information
    echo ""
    log_info "=== Post-Deployment Information ==="
    echo "Application: $PROJECT_NAME"
    echo "Version: $(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version)")"
    echo "Node.js: $(node --version)"
    echo "Environment: ${NODE_ENV:-development}"
    echo "Logs directory: $(pwd)/logs"
    echo "Health endpoint: GET /health"
    echo "Metrics endpoint: GET /metrics"
    echo ""
    log_info "Next steps:"
    echo "1. Start the application: npm start"
    echo "2. Monitor logs: tail -f logs/app/app.log"
    echo "3. Check health: curl http://localhost:3000/health"
    echo "4. View metrics: curl http://localhost:3000/metrics"
}

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --clean        Perform clean installation (remove node_modules)"
    echo "  --help         Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  NODE_ENV       Set environment (default: development)"
    echo "  LOG_LEVEL      Set log level (default: info)"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    --clean)
        deploy "true"
        ;;
    --help)
        show_help
        ;;
    "")
        deploy "false"
        ;;
    *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac