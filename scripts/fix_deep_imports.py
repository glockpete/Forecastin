#!/usr/bin/env python3
"""
Fix deep relative imports to use @types/* alias
"""

import re
from pathlib import Path

def fix_imports_in_file(file_path):
    """Fix deep relative imports in a single file"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()

        original = content

        # Fix imports like: from '../../types/' or '../../../types/'
        content = re.sub(
            r"from ['\"]\.\.\/\.\.\/types\/",
            "from '@types/",
            content
        )
        content = re.sub(
            r"from ['\"]\.\.\/\.\.\/\.\.\/types\/",
            "from '@types/",
            content
        )

        # Fix import type statements
        content = re.sub(
            r"import type (.*) from ['\"]\.\.\/\.\.\/types\/",
            r"import type \1 from '@types/",
            content
        )
        content = re.sub(
            r"import type (.*) from ['\"]\.\.\/\.\.\/\.\.\/types\/",
            r"import type \1 from '@types/",
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

    # Files with deep imports (from grep results)
    files_to_fix = [
        'layers/types/layer-types.ts',
        'layers/registry/LayerRegistry.ts',
        'components/Search/SearchInterface.tsx',
        'components/UI/ErrorBoundary.tsx',
        'components/Outcomes/HorizonLane.tsx',
        'components/Outcomes/OutcomesDashboard.tsx',
        'components/Outcomes/ActionQueue.tsx',
        'components/Outcomes/EvidencePanel.tsx',
        'components/Navigation/NavigationPanel.tsx',
        'components/Map/GeospatialView.tsx',
        'components/MillerColumns/MillerColumns.tsx',
        # EntityDetail.tsx already fixed manually
        'layers/tests/GeospatialIntegrationTests.test.ts',
        'components/Outcomes/OpportunityRadar.tsx',
        'components/Outcomes/StakeholderMap.tsx',
        'components/Outcomes/LensBar.tsx',
        'components/UI/LoadingSpinner.tsx',
    ]

    fixed_count = 0
    for file_path_str in files_to_fix:
        file_path = frontend_src / file_path_str
        if file_path.exists():
            if fix_imports_in_file(file_path):
                print(f"✅ Fixed: {file_path_str}")
                fixed_count += 1
            else:
                print(f"⏭️  No changes: {file_path_str}")
        else:
            print(f"❌ Not found: {file_path_str}")

    print(f"\n✅ Fixed {fixed_count} files")

if __name__ == '__main__':
    main()
