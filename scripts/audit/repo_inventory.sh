#!/usr/bin/env bash
################################################################################
# Repo Inventory Script - Phase 1
# Purpose: Generate comprehensive inventory of Forecastin codebase
# Output: Prints to stdout, can be redirected to checks/INVENTORY.md
# Usage: ./scripts/audit/repo_inventory.sh > checks/INVENTORY.md
################################################################################

set -euo pipefail

# Colors for output (if terminal supports it)
if [[ -t 1 ]]; then
    BOLD='\033[1m'
    BLUE='\033[0;34m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    NC='\033[0m' # No Color
else
    BOLD=''
    BLUE=''
    GREEN=''
    YELLOW=''
    NC=''
fi

echo "# Repository Inventory"
echo ""
echo "**Generated:** $(date -u '+%Y-%m-%d %H:%M:%S UTC') ($(TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M:%S JST'))"
echo "**Purpose:** Comprehensive map of Forecastin codebase for Phase 1 truth alignment"
echo ""
echo "---"
echo ""

################################################################################
# 1. DIRECTORY TREE STRUCTURE
################################################################################
echo "## 1. Directory Tree Structure"
echo ""

if command -v tree &> /dev/null; then
    echo "### Backend (\`/api\`)"
    echo ""
    echo '```'
    tree -L 3 -I '__pycache__|*.pyc|.pytest_cache|*.egg-info|node_modules' api/ || echo "tree command failed"
    echo '```'
    echo ""

    echo "### Frontend (\`/frontend\`)"
    echo ""
    echo '```'
    tree -L 3 -I 'node_modules|build|dist|coverage|.cache' frontend/ || echo "tree command failed"
    echo '```'
else
    echo "### Backend (\`/api\`) - Directory listing (tree not available)"
    echo ""
    echo '```'
    find api -type d -not -path '*/\.*' -not -path '*/__pycache__*' -not -path '*/node_modules/*' | sort | head -50
    echo '```'
    echo ""

    echo "### Frontend (\`/frontend\`) - Directory listing (tree not available)"
    echo ""
    echo '```'
    find frontend -type d -not -path '*/node_modules/*' -not -path '*/build/*' -not -path '*/dist/*' | sort | head -50
    echo '```'
fi

echo ""
echo "---"
echo ""

################################################################################
# 2. FASTAPI ROUTES
################################################################################
echo "## 2. FastAPI Routes"
echo ""

echo "### Routers"
echo ""
echo "| File | Lines | Description |"
echo "|------|-------|-------------|"

if [ -d "api/routers" ]; then
    for router in api/routers/*.py; do
        if [ -f "$router" ] && [ "$(basename "$router")" != "__init__.py" ]; then
            filename=$(basename "$router")
            lines=$(wc -l < "$router")
            # Try to extract description from docstring or comments
            desc=$(head -20 "$router" | grep -E '^\s*(""".*"""|#.*Router)' | head -1 | sed 's/["""#]//g' | xargs || echo "Router")
            echo "| \`$filename\` | $lines | $desc |"
        fi
    done
else
    echo "_No routers directory found_"
fi

echo ""

echo "### Route Endpoints"
echo ""
echo "Extracted from router files:"
echo ""
echo '```python'

if [ -d "api/routers" ]; then
    for router in api/routers/*.py; do
        if [ -f "$router" ] && [ "$(basename "$router")" != "__init__.py" ]; then
            echo "# $(basename "$router")"
            grep -E '@(router|app)\.(get|post|put|patch|delete|websocket)\(' "$router" | head -20 || true
            echo ""
        fi
    done
else
    echo "# No routers found"
fi

echo '```'
echo ""
echo "---"
echo ""

################################################################################
# 3. PYDANTIC MODELS
################################################################################
echo "## 3. Pydantic Models & Schemas"
echo ""

echo "### Model Files"
echo ""
echo "| File | Lines | Purpose |"
echo "|------|-------|---------|"

if [ -d "api/models" ]; then
    for model in api/models/*.py; do
        if [ -f "$model" ] && [ "$(basename "$model")" != "__init__.py" ]; then
            filename=$(basename "$model")
            lines=$(wc -l < "$model")
            purpose=$(head -10 "$model" | grep -E '^\s*(""".*"""|#)' | head -1 | sed 's/["""#]//g' | xargs || echo "Models")
            echo "| \`$filename\` | $lines | $purpose |"
        fi
    done
else
    echo "_No models directory found_"
fi

echo ""

echo "### Schema Classes"
echo ""
echo "Pydantic BaseModel classes found:"
echo ""
echo '```python'

if [ -d "api/models" ]; then
    for model in api/models/*.py; do
        if [ -f "$model" ]; then
            echo "# $(basename "$model")"
            grep -E 'class.*\(BaseModel\)|class.*\(.*Schema\)' "$model" | head -20 || true
            echo ""
        fi
    done
fi

# Also check for schemas in other locations
if [ -f "api/models/websocket_schemas.py" ]; then
    echo "# WebSocket Schemas"
    grep -E 'class.*\(BaseModel\)' api/models/websocket_schemas.py | head -30 || true
fi

echo '```'
echo ""
echo "---"
echo ""

################################################################################
# 4. DATABASE MIGRATIONS
################################################################################
echo "## 4. Database Migrations"
echo ""

echo "### Migration Files"
echo ""

if [ -d "migrations" ]; then
    echo "| File | Size | Description |"
    echo "|------|------|-------------|"

    for migration in migrations/*.sql; do
        if [ -f "$migration" ]; then
            filename=$(basename "$migration")
            size=$(wc -l < "$migration")
            # Try to extract description from SQL comments
            desc=$(head -10 "$migration" | grep -E '^\s*--' | head -1 | sed 's/--//g' | xargs || echo "Migration")
            echo "| \`$filename\` | ${size} lines | $desc |"
        fi
    done

    total_migrations=$(find migrations -name "*.sql" -type f | wc -l)
    echo ""
    echo "**Total migrations:** $total_migrations"
else
    echo "_No migrations directory found_"
fi

echo ""

echo "### Alembic Migrations"
echo ""

if [ -d "migrations/versions" ]; then
    echo "Alembic version files:"
    echo '```'
    ls -lh migrations/versions/*.py 2>/dev/null || echo "No Alembic migrations found"
    echo '```'
else
    echo "_No Alembic versions found (using raw SQL migrations)_"
fi

echo ""
echo "---"
echo ""

################################################################################
# 5. FRONTEND ROUTES AND COMPONENTS
################################################################################
echo "## 5. Frontend Routes & Components"
echo ""

echo "### Routes/Pages"
echo ""

if [ -f "frontend/src/App.tsx" ]; then
    echo "Routes extracted from App.tsx:"
    echo ""
    echo '```tsx'
    grep -E '<Route|path=|element=' frontend/src/App.tsx | head -30 || echo "No routes pattern found"
    echo '```'
fi

echo ""

echo "### Component Structure"
echo ""

if [ -d "frontend/src/components" ]; then
    echo "| Component | Lines | Location |"
    echo "|-----------|-------|----------|"

    find frontend/src/components -name "*.tsx" -o -name "*.ts" | while read -r comp; do
        if [ -f "$comp" ]; then
            filename=$(basename "$comp")
            lines=$(wc -l < "$comp")
            location=$(dirname "$comp" | sed 's|frontend/src/||')
            echo "| \`$filename\` | $lines | \`$location\` |"
        fi
    done | sort | head -50

    echo ""
    total_components=$(find frontend/src/components -name "*.tsx" -o -name "*.ts" | wc -l)
    echo "**Total component files:** $total_components"
else
    echo "_No components directory found_"
fi

echo ""

echo "### Shared Types"
echo ""

if [ -d "frontend/src/types" ]; then
    echo "TypeScript type definition files:"
    echo ""
    echo "| File | Lines | Purpose |"
    echo "|------|-------|---------|"

    for typefile in frontend/src/types/*.ts; do
        if [ -f "$typefile" ]; then
            filename=$(basename "$typefile")
            lines=$(wc -l < "$typefile")
            purpose=$(head -5 "$typefile" | grep -E '^\s*//' | head -1 | sed 's|//||g' | xargs || echo "Type definitions")
            echo "| \`$filename\` | $lines | $purpose |"
        fi
    done
else
    echo "_No types directory found_"
fi

echo ""
echo "---"
echo ""

################################################################################
# 6. WEBSOCKET MESSAGE KINDS
################################################################################
echo "## 6. WebSocket Message Types"
echo ""

echo "### Backend WebSocket Events"
echo ""

if [ -f "api/models/websocket_schemas.py" ]; then
    echo "Message schemas from \`api/models/websocket_schemas.py\`:"
    echo ""
    echo '```python'
    grep -E 'class.*\(BaseModel\)|type:.*Literal' api/models/websocket_schemas.py | head -40 || echo "No message types found"
    echo '```'
fi

echo ""

if [ -f "api/routers/websocket.py" ]; then
    echo "WebSocket handlers from \`api/routers/websocket.py\`:"
    echo ""
    echo '```python'
    grep -E 'async def.*message|await.*send|ConnectionManager' api/routers/websocket.py | head -30 || echo "No handlers found"
    echo '```'
fi

echo ""

echo "### Frontend WebSocket Types"
echo ""

if [ -d "frontend/src/types" ]; then
    ws_types=$(find frontend/src/types -name "*websocket*" -o -name "*ws*" -o -name "*realtime*" 2>/dev/null)
    if [ -n "$ws_types" ]; then
        echo "WebSocket type files:"
        echo '```typescript'
        for wstype in $ws_types; do
            echo "// $(basename "$wstype")"
            grep -E 'interface.*Message|type.*Message|export.*Message' "$wstype" | head -20 || true
        done
        echo '```'
    else
        echo "_No dedicated WebSocket type files found_"
    fi
fi

echo ""
echo "---"
echo ""

################################################################################
# 7. PACKAGE MANAGERS AND VERSIONS
################################################################################
echo "## 7. Package Managers & Toolchain Versions"
echo ""

echo "### Pinned Versions"
echo ""

echo "| Tool | Version | Source |"
echo "|------|---------|--------|"

if [ -f ".nvmrc" ]; then
    node_version=$(cat .nvmrc)
    echo "| Node.js | \`$node_version\` | \`.nvmrc\` |"
fi

if [ -f ".tool-versions" ]; then
    while IFS= read -r line; do
        if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
            tool=$(echo "$line" | awk '{print $1}')
            version=$(echo "$line" | awk '{print $2}')
            echo "| $tool | \`$version\` | \`.tool-versions\` |"
        fi
    done < .tool-versions
fi

if [ -f "pyproject.toml" ]; then
    python_version=$(grep -E 'requires-python' pyproject.toml | head -1 | sed 's/.*=//g' | tr -d '"' | xargs || echo "Not specified")
    echo "| Python | \`$python_version\` | \`pyproject.toml\` |"
fi

echo ""

echo "### Backend Dependencies"
echo ""

if [ -f "api/requirements.txt" ]; then
    total_deps=$(grep -cE '^[a-zA-Z]' api/requirements.txt || echo "0")
    echo "- **Total Python packages:** $total_deps (from \`api/requirements.txt\`)"
    echo "- **Key dependencies:**"
    echo ""
    echo '```'
    grep -E '^(fastapi|uvicorn|pydantic|sqlalchemy|redis|postgres|pytest)' api/requirements.txt | head -15 || echo "No major deps found"
    echo '```'
fi

echo ""

echo "### Frontend Dependencies"
echo ""

if [ -f "frontend/package.json" ]; then
    echo "From \`frontend/package.json\`:"
    echo ""
    echo '```json'
    # Extract key dependency sections
    python3 -c "import json, sys; data=json.load(open('frontend/package.json')); print('Dependencies:', len(data.get('dependencies', {})), '\nDevDependencies:', len(data.get('devDependencies', {})))" 2>/dev/null || echo "Could not parse package.json"
    echo '```'
    echo ""
    echo "Key frontend packages:"
    echo '```'
    grep -E '"react"|"typescript"|"vite"|"deck.gl"|"maplibre"|"zustand"' frontend/package.json | head -10 || echo "No major deps found"
    echo '```'
fi

echo ""

echo "### Lockfiles Status"
echo ""

echo "| Lockfile | Status | Size |"
echo "|----------|--------|------|"

for lockfile in "frontend/package-lock.json" "frontend/pnpm-lock.yaml" "frontend/yarn.lock" "poetry.lock" "uv.lock"; do
    if [ -f "$lockfile" ]; then
        size=$(du -h "$lockfile" | cut -f1)
        echo "| \`$lockfile\` | ✅ Committed | $size |"
    fi
done

echo ""
echo "---"
echo ""

################################################################################
# 8. SERVICES AND BACKGROUND JOBS
################################################################################
echo "## 8. Services & Background Jobs"
echo ""

echo "### Service Files"
echo ""

if [ -d "api/services" ]; then
    echo "| Service | Lines | Purpose |"
    echo "|---------|-------|---------|"

    for service in api/services/*.py; do
        if [ -f "$service" ] && [ "$(basename "$service")" != "__init__.py" ]; then
            filename=$(basename "$service")
            lines=$(wc -l < "$service")
            purpose=$(head -10 "$service" | grep -E '^\s*(""".*"""|#)' | head -1 | sed 's/["""#]//g' | xargs || echo "Service")
            echo "| \`$filename\` | $lines | $purpose |"
        fi
    done

    echo ""
    total_services=$(find api/services -name "*.py" -not -name "__init__.py" -not -name "test_*" | wc -l)
    echo "**Total service files:** $total_services"
fi

echo ""
echo "---"
echo ""

################################################################################
# 9. FEATURE FLAGS
################################################################################
echo "## 9. Feature Flags"
echo ""

echo "### Feature Flag Configuration"
echo ""

if [ -f ".env.example" ]; then
    echo "Feature flags from \`.env.example\`:"
    echo ""
    echo '```bash'
    grep -E '^FF_|^FEATURE_' .env.example || echo "No feature flags found"
    echo '```'
fi

echo ""

if [ -f "api/services/feature_flag_service.py" ]; then
    echo "Feature flag service found: \`api/services/feature_flag_service.py\`"
    echo ""
    lines=$(wc -l < api/services/feature_flag_service.py)
    echo "- **Lines:** $lines"
    echo "- **Manages:** Feature flag initialization, validation, and runtime checks"
fi

echo ""
echo "---"
echo ""

################################################################################
# 10. CONTRACTS AND TYPES
################################################################################
echo "## 10. Contracts & Cross-Boundary Types"
echo ""

echo "### Contract Files"
echo ""

if [ -d "contracts" ]; then
    echo "| File | Size | Purpose |"
    echo "|------|------|---------|"

    for contract in contracts/*; do
        if [ -f "$contract" ]; then
            filename=$(basename "$contract")
            size=$(du -h "$contract" | cut -f1)
            echo "| \`$filename\` | $size | Contract definition |"
        fi
    done
else
    echo "_No contracts directory found (should be created in Phase 3)_"
fi

echo ""

if [ -d "types" ]; then
    echo "### Shared Types"
    echo ""
    echo "Repository root \`/types\` directory:"
    echo '```'
    ls -lh types/ 2>/dev/null || echo "Directory exists but empty"
    echo '```'
fi

echo ""
echo "---"
echo ""

################################################################################
# 11. TESTS
################################################################################
echo "## 11. Test Coverage"
echo ""

echo "### Backend Tests"
echo ""

if [ -d "api/tests" ] || [ -d "tests" ]; then
    backend_tests=$(find api/tests tests -name "test_*.py" -o -name "*_test.py" 2>/dev/null | wc -l)
    echo "- **Test files:** $backend_tests"

    if [ -d "api/tests" ]; then
        echo ""
        echo "Backend test structure:"
        echo '```'
        find api/tests -name "*.py" | head -20
        echo '```'
    fi
else
    echo "_No backend test directory found_"
fi

echo ""

echo "### Frontend Tests"
echo ""

if [ -d "frontend/src/tests" ] || [ -d "frontend/src/__tests__" ]; then
    frontend_tests=$(find frontend/src/tests frontend/src/__tests__ -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" 2>/dev/null | wc -l)
    echo "- **Test files:** $frontend_tests"

    echo ""
    echo "Frontend test files:"
    echo '```'
    find frontend/src/tests frontend/src/__tests__ -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | head -20 || echo "No test files found"
    echo '```'
else
    echo "_No frontend test directory found_"
fi

echo ""
echo "---"
echo ""

################################################################################
# 12. DOCKER AND INFRASTRUCTURE
################################################################################
echo "## 12. Docker & Infrastructure"
echo ""

echo "### Docker Files"
echo ""

echo "| File | Purpose |"
echo "|------|---------|"

for dockerfile in Dockerfile* docker-compose*.yml; do
    if [ -f "$dockerfile" ]; then
        echo "| \`$dockerfile\` | Container definition |"
    fi
done

echo ""

if [ -d "ops" ]; then
    echo "### Ops/Infrastructure"
    echo ""
    echo "Infrastructure files in \`/ops\`:"
    echo '```'
    find ops -type f | head -20
    echo '```'
fi

echo ""
echo "---"
echo ""

################################################################################
# 13. DOCUMENTATION
################################################################################
echo "## 13. Documentation Files"
echo ""

echo "| File | Size | Purpose |"
echo "|------|------|---------|"

for doc in README.md CONTRIBUTING.md SECURITY.md ARCHITECTURE*.md docs/*.md; do
    if [ -f "$doc" ]; then
        size=$(du -h "$doc" | cut -f1)
        filename=$(basename "$doc")
        echo "| \`$doc\` | $size | Documentation |"
    fi
done

echo ""
echo "---"
echo ""

################################################################################
# SUMMARY STATISTICS
################################################################################
echo "## Summary Statistics"
echo ""

total_py_files=$(find api -name "*.py" -not -path "*/\.*" -not -path "*/__pycache__/*" | wc -l)
total_ts_files=$(find frontend/src -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l)
total_py_lines=$(find api -name "*.py" -not -path "*/__pycache__/*" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')
total_ts_lines=$(find frontend/src -name "*.ts" -o -name "*.tsx" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}')

echo "| Metric | Count |"
echo "|--------|-------|"
echo "| Python files | $total_py_files |"
echo "| TypeScript/TSX files | $total_ts_files |"
echo "| Total Python LOC | $total_py_lines |"
echo "| Total TypeScript LOC | $total_ts_lines |"
echo "| API routers | $(find api/routers -name "*.py" -not -name "__init__.py" 2>/dev/null | wc -l) |"
echo "| Backend services | $(find api/services -name "*.py" -not -name "__init__.py" -not -name "test_*" 2>/dev/null | wc -l) |"
echo "| Frontend components | $(find frontend/src/components -name "*.tsx" 2>/dev/null | wc -l) |"
echo "| Database migrations | $(find migrations -name "*.sql" 2>/dev/null | wc -l) |"

echo ""
echo "---"
echo ""
echo "_End of Repository Inventory_"
echo ""
echo "**Next Steps:**"
echo "1. Review this inventory for accuracy"
echo "2. Align with GOLDEN_SOURCE.md"
echo "3. Create contracts/README.md ledger"
echo "4. Update documentation to reflect reality"
