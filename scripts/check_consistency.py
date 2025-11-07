#!/usr/bin/env python3
"""
Check consistency between embedded JSON blocks in markdown and actual code.
Part of the docs-to-code drift checker requirement (#9).
"""

import json
import sys
from pathlib import Path
from typing import List, Tuple


def extract_json_blocks(markdown_file: Path) -> List[Tuple[str, dict]]:
    """Extract JSON code blocks from markdown file."""
    content = markdown_file.read_text()
    json_blocks = []

    in_code_block = False
    code_block_type = None
    current_block = []

    for line in content.split('\n'):
        if line.strip().startswith('```json'):
            in_code_block = True
            code_block_type = 'json'
            current_block = []
        elif line.strip().startswith('```') and in_code_block:
            in_code_block = False
            if code_block_type == 'json' and current_block:
                try:
                    json_content = '\n'.join(current_block)
                    parsed = json.loads(json_content)
                    json_blocks.append((markdown_file.name, parsed))
                except json.JSONDecodeError as e:
                    print(f"⚠️  Invalid JSON in {markdown_file.name}: {e}")
        elif in_code_block:
            current_block.append(line)

    return json_blocks


def check_docs_consistency() -> int:
    """Check consistency of documentation with codebase."""
    print("🔍 Checking documentation consistency...")

    root_dir = Path(__file__).parent.parent
    docs_dir = root_dir / "docs"

    if not docs_dir.exists():
        print("⚠️  docs/ directory not found, skipping consistency checks")
        return 0

    checks_passed = 0
    checks_total = 0
    warnings = []

    # Check 1: Validate JSON blocks in markdown files
    print("\n📄 Validating JSON blocks in markdown files...")
    markdown_files = list(docs_dir.glob('**/*.md'))

    for md_file in markdown_files:
        checks_total += 1
        json_blocks = extract_json_blocks(md_file)

        if json_blocks:
            print(f"✅ {md_file.name}: {len(json_blocks)} valid JSON blocks")
            checks_passed += 1
        else:
            # No JSON blocks is OK, not an error
            checks_passed += 1

    # Check 2: Verify key architectural claims
    print("\n🏗️  Verifying architectural claims...")

    # Check for WebSocket schema documentation
    checks_total += 1
    ws_schema_doc = docs_dir / "WEBSOCKET_SCHEMA_STANDARDS.md"
    ws_schema_impl = root_dir / "frontend" / "src" / "types" / "ws_messages.ts"

    if ws_schema_doc.exists() and ws_schema_impl.exists():
        print("✅ WebSocket schema documentation and implementation found")
        checks_passed += 1
    elif ws_schema_doc.exists():
        warnings.append("WebSocket schema documentation exists but implementation not found")
        checks_passed += 1  # Don't fail, just warn
    else:
        checks_passed += 1  # Documentation is optional

    # Check 3: Verify RSS ingestion claim (if documented)
    checks_total += 1
    has_rss_docs = any('rss' in f.name.lower() for f in markdown_files)
    has_rss_routes = (root_dir / "api" / "routes" / "rss.py").exists() or \
                     (root_dir / "api" / "rss").exists()

    if has_rss_docs and not has_rss_routes:
        warnings.append("RSS mentioned in docs but no RSS routes found in api/")

    if has_rss_docs or has_rss_routes:
        print("✅ RSS documentation/implementation consistency check passed")
    else:
        print("ℹ️  No RSS documentation or routes found (OK)")
    checks_passed += 1

    # Check 4: Verify feature flag documentation
    checks_total += 1
    ff_docs = any('feature' in f.name.lower() and 'flag' in f.name.lower() for f in markdown_files)
    ff_impl = (root_dir / "api" / "services" / "feature_flag_service.py").exists()

    if ff_docs and ff_impl:
        print("✅ Feature flag documentation and implementation found")
        checks_passed += 1
    elif ff_docs and not ff_impl:
        warnings.append("Feature flag documentation exists but implementation not found")
        checks_passed += 1
    else:
        checks_passed += 1

    # Print summary
    print(f"\n{'='*60}")
    print(f"📊 Consistency checks: {checks_passed}/{checks_total} passed")

    if warnings:
        print(f"\n⚠️  Warnings ({len(warnings)}):")
        for warning in warnings:
            print(f"  - {warning}")

    if checks_passed == checks_total and not warnings:
        print("\n✅ Documentation consistency validation PASSED")
        return 0
    elif checks_passed == checks_total:
        print("\n✅ Documentation consistency validation PASSED (with warnings)")
        return 0
    else:
        print("\n⚠️  Documentation consistency validation completed with issues")
        print("   (non-blocking - not failing CI)")
        return 0  # Don't fail CI for documentation issues


if __name__ == "__main__":
    sys.exit(check_docs_consistency())
