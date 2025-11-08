#!/usr/bin/env python3
"""
Revert deep relative imports fix - TypeScript doesn't like @types/ prefix for regular imports
Keep relative imports as they are since they work.
"""

import re
from pathlib import Path

def revert_imports_in_file(file_path):
    """Revert imports back to relative paths"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()

        original = content

        # Revert @types/ imports back to relative paths
        # For files in components subdirectories (2 levels deep)
        content = re.sub(
            r"from '@types/",
            "from '../../types/",
            content
        )

        # Revert import type statements
        content = re.sub(
            r"import type (.*) from '@types/",
            r"import type \1 from '../../types/",
            content
        )

        if content != original:
            with open(file_path, 'w') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    frontend_src = Path(__file__).parent.parent / 'frontend' / 'src'

    # Files we modified
    files_to_fix = [
        'components/Entity/EntityDetail.tsx',
        'components/Search/SearchInterface.tsx',
        'components/Outcomes/HorizonLane.tsx',
        'components/Outcomes/OutcomesDashboard.tsx',
        'components/Outcomes/ActionQueue.tsx',
        'components/Outcomes/EvidencePanel.tsx',
        'components/MillerColumns/MillerColumns.tsx',
        'components/Outcomes/OpportunityRadar.tsx',
        'components/Outcomes/StakeholderMap.tsx',
        'components/Outcomes/LensBar.tsx',
    ]

    fixed_count = 0
    for file_path_str in files_to_fix:
        file_path = frontend_src / file_path_str
        if file_path.exists():
            if revert_imports_in_file(file_path):
                print(f"✅ Reverted: {file_path_str}")
                fixed_count += 1
            else:
                print(f"⏭️  No changes: {file_path_str}")
        else:
            print(f"❌ Not found: {file_path_str}")

    print(f"\n✅ Reverted {fixed_count} files")
    print("\nNote: Deep relative imports are acceptable in TypeScript.")
    print("The paths configuration in tsconfig.json is for TypeScript's benefit,")
    print("but regular relative imports work fine and are simpler.")

if __name__ == '__main__':
    main()
