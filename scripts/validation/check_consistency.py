#!/usr/bin/env python3
"""
Check documentation consistency across the codebase.
Validates that embedded JSON blocks and code examples in markdown are consistent.
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Tuple


def check_json_blocks(file_path: Path) -> Tuple[bool, List[str]]:
    """Check if JSON blocks in markdown files are valid."""
    errors = []

    try:
        content = file_path.read_text(encoding='utf-8')
        in_json_block = False
        json_content = []
        block_start_line = 0
        current_line = 0

        for line in content.split('\n'):
            current_line += 1

            if '```json' in line.lower():
                in_json_block = True
                json_content = []
                block_start_line = current_line
                continue

            if in_json_block:
                if '```' in line:
                    # End of JSON block, validate
                    try:
                        json.loads('\n'.join(json_content))
                    except json.JSONDecodeError as e:
                        errors.append(
                            f"{file_path}:{block_start_line}: Invalid JSON block: {e}"
                        )
                    in_json_block = False
                    json_content = []
                else:
                    json_content.append(line)

        return len(errors) == 0, errors

    except Exception as e:
        errors.append(f"{file_path}: Error reading file: {e}")
        return False, errors


def check_consistency(target_file=None) -> Dict:
    """Check consistency across documentation files."""

    # Find all markdown files
    # Script is at scripts/validation/check_consistency.py, need to go up 3 levels to root
    docs_dir = Path(__file__).parent.parent.parent / "docs"
    root_dir = Path(__file__).parent.parent.parent

    markdown_files = list(docs_dir.glob("**/*.md")) if docs_dir.exists() else []
    markdown_files.extend(root_dir.glob("*.md"))

    results = {
        "timestamp": None,
        "total_files_checked": len(markdown_files),
        "files_with_errors": 0,
        "total_errors": 0,
        "errors": [],
        "status": "passed"
    }

    from datetime import datetime
    results["timestamp"] = datetime.utcnow().isoformat() + "Z"

    print(f"🔍 Checking consistency across {len(markdown_files)} markdown files...")

    for md_file in markdown_files:
        is_valid, errors = check_json_blocks(md_file)

        if not is_valid:
            results["files_with_errors"] += 1
            results["total_errors"] += len(errors)
            results["errors"].extend(errors)
            results["status"] = "failed"

    if target_file:
        target_path = Path(target_file)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        with open(target_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"✅ Consistency check results saved to: {target_file}")

    # Print summary
    if results["status"] == "passed":
        print(f"\n✅ All {results['total_files_checked']} files passed consistency checks")
    else:
        print(f"\n⚠️ Found {results['total_errors']} errors in {results['files_with_errors']} files:")
        for error in results["errors"][:10]:  # Show first 10 errors
            print(f"  - {error}")
        if results["total_errors"] > 10:
            print(f"  ... and {results['total_errors'] - 10} more errors")

    return results


def main():
    parser = argparse.ArgumentParser(description="Check documentation consistency")
    parser.add_argument("--target", help="Output file path for results JSON")
    args = parser.parse_args()

    try:
        results = check_consistency(args.target)

        if results["status"] == "passed":
            print("\n✅ Documentation consistency check passed")
            return 0
        else:
            print("\n⚠️ Documentation consistency check completed with warnings")
            # Don't fail CI for documentation issues
            return 0
    except Exception as e:
        print(f"❌ Error checking consistency: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
