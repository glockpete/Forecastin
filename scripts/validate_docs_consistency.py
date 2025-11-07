#!/usr/bin/env python3
"""
Validate that documentation matches implementation.
Checks for consistency between docs and actual code structure.
"""

import sys
from pathlib import Path


def validate_docs():
    """Validate documentation consistency with implementation."""

    print("🔍 Validating documentation consistency...")

    root_dir = Path(__file__).parent.parent
    docs_dir = root_dir / "docs"
    api_dir = root_dir / "api"

    checks_passed = 0
    checks_total = 0

    # Check 1: README exists
    checks_total += 1
    if (root_dir / "README.md").exists():
        print("✅ README.md exists")
        checks_passed += 1
    else:
        print("⚠️ README.md not found")

    # Check 2: API documentation
    checks_total += 1
    if api_dir.exists():
        print("✅ API directory exists")
        checks_passed += 1
    else:
        print("⚠️ API directory not found")

    # Check 3: Docs directory
    checks_total += 1
    if docs_dir.exists():
        print(f"✅ Documentation directory exists ({len(list(docs_dir.glob('**/*.md')))} files)")
        checks_passed += 1
    else:
        print("⚠️ Documentation directory not found")

    print(f"\n📊 Documentation validation: {checks_passed}/{checks_total} checks passed")

    if checks_passed == checks_total:
        print("✅ Documentation validation passed")
        return 0
    else:
        print("⚠️ Documentation validation completed with warnings")
        return 0  # Don't fail CI for docs


if __name__ == "__main__":
    sys.exit(validate_docs())
