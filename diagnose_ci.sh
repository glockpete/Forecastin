#!/bin/bash
# Diagnostic script to help debug CI failures

echo "=== Git Status ==="
git log --oneline -3
echo ""

echo "=== Python Structure Check ==="
echo "api/__init__.py exists:"
ls -la api/__init__.py 2>&1 || echo "NOT FOUND"
echo "api/routers/__init__.py exists:"
ls -la api/routers/__init__.py 2>&1 || echo "NOT FOUND"
echo ""

echo "=== Requirements File ==="
echo "Root requirements.txt exists:"
ls -la requirements.txt 2>&1 || echo "NOT FOUND (expected)"
echo "api/requirements.txt exists:"
ls -la api/requirements.txt 2>&1 || echo "NOT FOUND"
echo ""

echo "=== Backend Workflow Config ==="
grep -A 2 "requirements.txt" .github/workflows/backend.yml | head -5
echo ""

echo "=== Ruff Config ==="
grep -A 3 "\[tool.ruff\]" pyproject.toml | head -5
echo ""

echo "=== Test Import Structure ==="
echo "Test files import from:"
grep "^from main import\|^import main" api/tests/test_*.py 2>&1 | head -5
echo ""

echo "=== Main.py Router Imports ==="
grep "from routers import" api/main.py
echo ""

echo "=== Checking for Python syntax errors ==="
python3 -m py_compile api/main.py 2>&1 && echo "✓ main.py syntax OK" || echo "✗ main.py syntax ERROR"
python3 -m py_compile api/routers/websocket.py 2>&1 && echo "✓ websocket.py syntax OK" || echo "✗ websocket.py syntax ERROR"
echo ""

echo "=== Ruff Check (quick) ==="
ruff check api/ --select=E9,F63,F7,F82 --target-version=py311 2>&1 || echo "Ruff check failed"
echo ""

echo "DONE - Please share this output with Claude"
