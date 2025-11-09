#!/usr/bin/env python3
"""
Detect async mocking anti-patterns in test files.

This script scans test files for common async mocking issues and provides
actionable suggestions for fixes.

Usage:
    python scripts/detect_async_mock_issues.py api/tests/

Output:
    - List of files with issues
    - Specific line numbers and problems
    - Suggested fixes
    - Summary statistics

Author: Forecastin Testing Infrastructure Team
Created: 2025-11-09
"""

import re
import sys
from pathlib import Path
from typing import List, Dict
from dataclasses import dataclass, field


@dataclass
class Issue:
    """Represents a single async mocking issue."""
    file_path: str
    line_number: int
    issue_type: str
    line_content: str
    suggestion: str
    severity: str  # 'critical', 'warning', 'info'


@dataclass
class AnalysisResult:
    """Results from analyzing test files."""
    issues: List[Issue] = field(default_factory=list)
    files_scanned: int = 0
    files_with_issues: int = 0

    def add_issue(self, issue: Issue):
        """Add an issue to the results."""
        self.issues.append(issue)

    def get_summary(self) -> Dict[str, int]:
        """Get summary statistics."""
        return {
            'total_issues': len(self.issues),
            'critical': sum(1 for i in self.issues if i.severity == 'critical'),
            'warning': sum(1 for i in self.issues if i.severity == 'warning'),
            'info': sum(1 for i in self.issues if i.severity == 'info'),
            'files_scanned': self.files_scanned,
            'files_with_issues': self.files_with_issues
        }


class AsyncMockAnalyzer:
    """Analyzes test files for async mocking issues."""

    def __init__(self):
        self.result = AnalysisResult()

    def analyze_file(self, file_path: Path) -> List[Issue]:
        """Analyze a single test file."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')

        file_issues = []

        # Check for all issue types
        file_issues.extend(self._check_mock_spec_async(file_path, lines))
        file_issues.extend(self._check_redundant_asyncmock(file_path, lines))
        file_issues.extend(self._check_manual_replacement(file_path, lines))
        file_issues.extend(self._check_mixing_sync_async(file_path, lines))
        file_issues.extend(self._check_missing_imports(file_path, content))

        return file_issues

    def _check_mock_spec_async(self, file_path: Path, lines: List[str]) -> List[Issue]:
        """Check for Mock(spec=AsyncService) pattern."""
        issues = []
        async_service_pattern = re.compile(
            r'Mock\(spec=(CacheService|RealtimeService|DatabaseManager|.*Service|.*Manager)\)'
        )

        for i, line in enumerate(lines, 1):
            if async_service_pattern.search(line):
                issues.append(Issue(
                    file_path=str(file_path),
                    line_number=i,
                    issue_type='mock_spec_async',
                    line_content=line.strip(),
                    suggestion='Replace Mock(spec=...) with AsyncMock(spec=...) or use create_*_mock() from mock_helpers',
                    severity='critical'
                ))

        return issues

    def _check_redundant_asyncmock(self, file_path: Path, lines: List[str]) -> List[Issue]:
        """Check for redundant AsyncMock assignments."""
        issues = []

        for i in range(len(lines) - 1):
            current_line = lines[i].strip()
            next_line = lines[i + 1].strip()

            # Pattern: var = AsyncMock()
            if 'AsyncMock()' in current_line and '=' in current_line:
                var_name = current_line.split('=')[0].strip()

                # Check if next line assigns AsyncMock to method
                if next_line.startswith(f'{var_name}.') and 'AsyncMock(' in next_line:
                    issues.append(Issue(
                        file_path=str(file_path),
                        line_number=i + 2,
                        issue_type='redundant_asyncmock',
                        line_content=next_line,
                        suggestion=f'Remove this line - AsyncMock already makes methods async. Use mock_helpers factory instead.',
                        severity='warning'
                    ))

        return issues

    def _check_manual_replacement(self, file_path: Path, lines: List[str]) -> List[Issue]:
        """Check for manual async method replacement."""
        issues = []

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            # Pattern: obj.method = async def ...
            if re.search(r'\.[\w_]+\s*=\s*async\s+def', stripped):
                issues.append(Issue(
                    file_path=str(file_path),
                    line_number=i,
                    issue_type='manual_replacement',
                    line_content=stripped,
                    suggestion='Use patch_async_method() from mock_helpers instead of manual replacement',
                    severity='warning'
                ))

            # Pattern: original = obj.method (saving original)
            if re.search(r'original_\w+\s*=\s*\w+\._', stripped):
                issues.append(Issue(
                    file_path=str(file_path),
                    line_number=i,
                    issue_type='manual_replacement',
                    line_content=stripped,
                    suggestion='Use patch_async_method() which handles cleanup automatically',
                    severity='info'
                ))

        return issues

    def _check_mixing_sync_async(self, file_path: Path, lines: List[str]) -> List[Issue]:
        """Check for mixing Mock and AsyncMock on same object."""
        issues = []

        # Look for pattern where AsyncMock base has Mock methods
        for i in range(len(lines) - 2):
            line1 = lines[i].strip()

            if 'AsyncMock()' in line1 and '=' in line1:
                var_name = line1.split('=')[0].strip()

                # Check subsequent lines for Mock assignment
                for j in range(i + 1, min(i + 10, len(lines))):
                    check_line = lines[j].strip()
                    if check_line.startswith(f'{var_name}.') and 'Mock(return_value=' in check_line and 'AsyncMock' not in check_line:
                        issues.append(Issue(
                            file_path=str(file_path),
                            line_number=j + 1,
                            issue_type='mixing_sync_async',
                            line_content=check_line,
                            suggestion='Use create_*_mock() factory which properly handles sync/async method separation',
                            severity='warning'
                        ))

        return issues

    def _check_missing_imports(self, file_path: Path, content: str) -> List[Issue]:
        """Check if mock_helpers is imported when it should be."""
        issues = []

        has_mock_helpers_import = 'from api.tests.mock_helpers import' in content
        has_manual_mocks = any([
            'AsyncMock()' in content,
            'Mock(spec=' in content,
            'create_pool' in content and 'mock' in content.lower()
        ])

        if has_manual_mocks and not has_mock_helpers_import:
            issues.append(Issue(
                file_path=str(file_path),
                line_number=1,
                issue_type='missing_import',
                line_content='',
                suggestion='Consider importing from api.tests.mock_helpers for standardized mocks',
                severity='info'
            ))

        return issues

    def analyze_directory(self, directory: Path) -> AnalysisResult:
        """Analyze all test files in directory."""
        test_files = list(directory.glob('test_*.py'))

        self.result.files_scanned = len(test_files)

        for test_file in test_files:
            file_issues = self.analyze_file(test_file)

            if file_issues:
                self.result.files_with_issues += 1

            for issue in file_issues:
                self.result.add_issue(issue)

        return self.result


def print_report(result: AnalysisResult):
    """Print formatted analysis report."""
    print("=" * 80)
    print("ASYNC MOCK ANTI-PATTERN DETECTION REPORT")
    print("=" * 80)
    print()

    if not result.issues:
        print("✅ No async mocking issues found!")
        print()
        print(f"Scanned {result.files_scanned} test files.")
        return

    # Group issues by file
    issues_by_file: Dict[str, List[Issue]] = {}
    for issue in result.issues:
        if issue.file_path not in issues_by_file:
            issues_by_file[issue.file_path] = []
        issues_by_file[issue.file_path].append(issue)

    # Print issues by file
    for file_path, issues in sorted(issues_by_file.items()):
        print(f"\n📁 {file_path}")
        print("-" * 80)

        # Group by severity
        critical = [i for i in issues if i.severity == 'critical']
        warnings = [i for i in issues if i.severity == 'warning']
        info = [i for i in issues if i.severity == 'info']

        if critical:
            print("\n🔴 CRITICAL ISSUES:")
            for issue in critical:
                print(f"  Line {issue.line_number}: {issue.line_content[:60]}...")
                print(f"    Issue: {issue.issue_type}")
                print(f"    Fix: {issue.suggestion}")
                print()

        if warnings:
            print("⚠️  WARNINGS:")
            for issue in warnings:
                print(f"  Line {issue.line_number}: {issue.line_content[:60]}...")
                print(f"    Issue: {issue.issue_type}")
                print(f"    Fix: {issue.suggestion}")
                print()

        if info:
            print("ℹ️  INFO:")
            for issue in info:
                print(f"  Line {issue.line_number}: {issue.issue_type}")
                print(f"    Suggestion: {issue.suggestion}")
                print()

    # Print summary
    summary = result.get_summary()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Files scanned:        {summary['files_scanned']}")
    print(f"Files with issues:    {summary['files_with_issues']}")
    print(f"Total issues:         {summary['total_issues']}")
    print(f"  🔴 Critical:        {summary['critical']}")
    print(f"  ⚠️  Warnings:        {summary['warning']}")
    print(f"  ℹ️  Info:            {summary['info']}")
    print()

    # Recommendations
    print("=" * 80)
    print("RECOMMENDATIONS")
    print("=" * 80)
    print("1. Fix critical issues first (Mock(spec=AsyncService))")
    print("2. Use factory functions from api/tests/mock_helpers.py")
    print("3. Review docs/testing/ASYNC_MOCKING_QUICK_REFERENCE.md")
    print("4. See docs/testing/MIGRATION_EXAMPLE.md for examples")
    print()


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python detect_async_mock_issues.py <test_directory>")
        print()
        print("Example:")
        print("  python scripts/detect_async_mock_issues.py api/tests/")
        sys.exit(1)

    test_dir = Path(sys.argv[1])

    if not test_dir.exists():
        print(f"❌ Error: {test_dir} does not exist")
        sys.exit(1)

    if not test_dir.is_dir():
        print(f"❌ Error: {test_dir} is not a directory")
        sys.exit(1)

    print(f"🔍 Scanning test files in {test_dir}...")
    print()

    analyzer = AsyncMockAnalyzer()
    result = analyzer.analyze_directory(test_dir)

    print_report(result)

    # Exit with error code if critical issues found
    summary = result.get_summary()
    if summary['critical'] > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
