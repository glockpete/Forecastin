.PHONY: help bootstrap check typecheck test test-unit test-integration dev build clean install-api install-frontend openapi contracts

# Colors for output
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
RESET  := $(shell tput -Txterm sgr0)

help: ## Show this help message
	@echo '${GREEN}Forecastin Development Makefile${RESET}'
	@echo ''
	@echo 'Usage:'
	@echo '  ${YELLOW}make${RESET} <target>'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  ${YELLOW}%-20s${RESET} %s\n", $$1, $$2}' $(MAKEFILE_LIST)

bootstrap: ## Bootstrap development environment
	@echo "${GREEN}Bootstrapping development environment...${RESET}"
	@bash scripts/dev/bootstrap.sh

check: typecheck test ## Run all checks (typecheck + tests)

typecheck: ## Run TypeScript type checking
	@echo "${GREEN}Running TypeScript type check...${RESET}"
	cd frontend && npm run typecheck

test: ## Run all tests
	@echo "${GREEN}Running all tests...${RESET}"
	cd frontend && npm test

test-unit: ## Run unit tests only
	@echo "${GREEN}Running unit tests...${RESET}"
	cd frontend && npm test -- tests/

test-integration: ## Run integration tests
	@echo "${GREEN}Running integration tests...${RESET}"
	cd frontend && npm test -- src/layers/tests/

dev: ## Start development servers
	@echo "${GREEN}Starting development servers...${RESET}"
	docker-compose up -d postgres redis
	@echo "Waiting for services to be ready..."
	@sleep 5
	@echo "${GREEN}Services ready! Start backend and frontend separately:${RESET}"
	@echo "  Backend:  cd api && uvicorn main:app --reload --port 9000"
	@echo "  Frontend: cd frontend && npm start"

build: ## Build production Docker images
	@echo "${GREEN}Building production images...${RESET}"
	docker-compose build

clean: ## Clean build artifacts and dependencies
	@echo "${GREEN}Cleaning build artifacts...${RESET}"
	cd frontend && rm -rf node_modules build dist
	cd api && find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	docker-compose down -v

install-api: ## Install Python dependencies
	@echo "${GREEN}Installing Python dependencies...${RESET}"
	cd api && pip install -r requirements.txt

install-frontend: ## Install Node dependencies
	@echo "${GREEN}Installing Node dependencies...${RESET}"
	cd frontend && npm install --legacy-peer-deps

openapi: ## Generate OpenAPI schema from FastAPI
	@echo "${GREEN}Generating OpenAPI schema...${RESET}"
	python3 scripts/generate_openapi_minimal.py

ws-contracts: ## Generate WebSocket contract schema from Pydantic models
	@echo "${GREEN}Generating WebSocket contract schema...${RESET}"
	python3 scripts/generate_ws_contract.py

contracts: openapi ws-contracts ## Generate TypeScript contracts from Python models
	@echo "${GREEN}Generating TypeScript contracts...${RESET}"
	python3 scripts/dev/generate_contracts.py
	@echo "${GREEN}Contract generation complete!${RESET}"
	@echo "  - contracts/openapi.json"
	@echo "  - contracts/ws.json"
	@echo "  - frontend/src/types/contracts.generated.ts"
	@echo "${GREEN}Verifying contract consistency...${RESET}"
	cd frontend && npm run contracts:check || echo "${YELLOW}Note: Run 'npm install' in frontend if verification fails${RESET}"

# Service management
services-up: ## Start all services
	docker-compose up -d

services-down: ## Stop all services
	docker-compose down

services-logs: ## Tail service logs
	docker-compose logs -f

# Database operations
db-migrate: ## Run database migrations
	@echo "${GREEN}Running database migrations...${RESET}"
	bash scripts/migrate_feature_flags.sh migrate

db-reset: ## Reset database (WARNING: destructive)
	@echo "${YELLOW}WARNING: This will delete all data!${RESET}"
	@read -p "Are you sure? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		docker-compose down -v postgres; \
		docker-compose up -d postgres; \
		echo "${GREEN}Database reset complete${RESET}"; \
	else \
		echo "Cancelled"; \
	fi

# Pre-commit hooks
pre-commit: typecheck test ## Run pre-commit checks
	@echo "${GREEN}All pre-commit checks passed ✓${RESET}"
