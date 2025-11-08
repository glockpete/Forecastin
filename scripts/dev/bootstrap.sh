#!/bin/bash
#
# Development Environment Bootstrap Script
# Sets up complete development environment for Forecastin
#
# Usage:
#   ./scripts/dev/bootstrap.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Determine project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================"
echo "  Forecastin Development Bootstrap"
echo "========================================"
echo ""

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_tools+=("node (v18+ required)")
    else
        local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            log_warning "Node.js version $node_version detected. v18+ recommended."
        fi
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi

    # Check Python
    if ! command -v python3 &> /dev/null; then
        missing_tools+=("python3 (v3.9+ required)")
    else
        local python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f2)
        if [ "$python_version" -lt 9 ]; then
            log_warning "Python 3.$python_version detected. 3.9+ recommended."
        fi
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi

    # Check docker-compose
    if ! command -v docker-compose &> /dev/null; then
        missing_tools+=("docker-compose")
    fi

    # Check Make
    if ! command -v make &> /dev/null; then
        log_warning "make not found. Install for easier development workflow."
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools:"
        for tool in "${missing_tools[@]}"; do
            echo "  - $tool"
        done
        exit 1
    fi

    log_success "All prerequisites met"
}

# Install Python dependencies
install_python_deps() {
    log_info "Installing Python dependencies..."

    if [ -f "api/requirements.txt" ]; then
        cd api
        if command -v pip3 &> /dev/null; then
            pip3 install -r requirements.txt --quiet
        else
            pip install -r requirements.txt --quiet
        fi
        cd ..
        log_success "Python dependencies installed"
    else
        log_warning "api/requirements.txt not found"
    fi
}

# Install Node dependencies
install_node_deps() {
    log_info "Installing Node.js dependencies..."

    if [ -f "frontend/package.json" ]; then
        cd frontend
        npm install --legacy-peer-deps --silent
        cd ..
        log_success "Node.js dependencies installed"
    else
        log_error "frontend/package.json not found"
        exit 1
    fi
}

# Start Docker services
start_docker_services() {
    log_info "Starting Docker services (postgres, redis)..."

    if docker-compose ps | grep -q "Up"; then
        log_warning "Services already running"
    else
        docker-compose up -d postgres redis

        # Wait for services to be healthy
        log_info "Waiting for services to be ready..."
        sleep 5

        # Check PostgreSQL
        local retries=0
        while ! docker-compose exec -T postgres pg_isready -U forecastin &> /dev/null; do
            retries=$((retries + 1))
            if [ $retries -gt 30 ]; then
                log_error "PostgreSQL failed to start"
                exit 1
            fi
            sleep 1
        done

        log_success "Docker services started and healthy"
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    if docker-compose exec -T postgres psql -U forecastin -d forecastin -c "\dt" &> /dev/null; then
        log_success "Database schema initialized"
    else
        log_warning "Could not verify database schema"
    fi
}

# Generate contracts
generate_contracts() {
    log_info "Generating TypeScript contracts..."

    if [ -f "scripts/dev/generate_contracts.py" ]; then
        python3 scripts/dev/generate_contracts.py
        log_success "Contracts generated"
    else
        log_warning "Contract generator not found"
    fi
}

# Setup pre-commit hooks
setup_pre_commit() {
    log_info "Setting up pre-commit hooks..."

    if [ ! -d ".git" ]; then
        log_warning "Not a git repository, skipping pre-commit hooks"
        return
    fi

    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Forecastin pre-commit hook

echo "Running pre-commit checks..."

# Run TypeScript type check
cd frontend && npm run typecheck
if [ $? -ne 0 ]; then
    echo "❌ TypeScript type check failed"
    exit 1
fi

# Regenerate contracts if Python files changed
if git diff --cached --name-only | grep -E '(api/services/|api/models/).*\.py$'; then
    echo "Python service files changed, regenerating contracts..."
    python3 scripts/dev/generate_contracts.py
    git add frontend/src/types/contracts.generated.ts
fi

echo "✅ Pre-commit checks passed"
exit 0
EOF

    chmod +x .git/hooks/pre-commit
    log_success "Pre-commit hooks installed"
}

# Create .env file if it doesn't exist
setup_env_file() {
    if [ ! -f ".env" ]; then
        log_info "Creating .env file..."

        cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://forecastin:forecastin_password@localhost:5432/forecastin
DB_HOST=localhost
DB_PORT=5432
DB_NAME=forecastin
DB_USER=forecastin

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379

# API
API_PORT=9000
ENVIRONMENT=development

# Frontend
REACT_APP_API_URL=http://localhost:9000
REACT_APP_WS_URL=ws://localhost:9000/ws

# Feature Flags
FF_GEOSPATIAL_ENABLED=true
FF_REALTIME_ENABLED=true
EOF

        log_success ".env file created"
    else
        log_info ".env file already exists"
    fi
}

# Main execution
main() {
    check_prerequisites
    setup_env_file
    install_python_deps
    install_node_deps
    start_docker_services
    run_migrations
    generate_contracts
    setup_pre_commit

    echo ""
    echo "========================================"
    log_success "Bootstrap complete!"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "  1. Start backend:  cd api && uvicorn main:app --reload --port 9000"
    echo "  2. Start frontend: cd frontend && npm start"
    echo "  3. View app:       http://localhost:3000"
    echo ""
    echo "Useful commands:"
    echo "  make help          - Show all available commands"
    echo "  make check         - Run type checking and tests"
    echo "  make dev           - Start development environment"
    echo "  make contracts     - Regenerate TypeScript contracts"
    echo ""
}

main "$@"
