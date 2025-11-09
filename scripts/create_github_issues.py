#!/usr/bin/env python3
"""
GitHub Issue Creator Script

This script reads GitHub issue templates from the github_issues/ directory
and generates commands to create them on the glockpete/Forecastin repository
using either GitHub CLI or direct API calls.

Usage:
    python scripts/create_github_issues.py [--method cli|api] [--dry-run]
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional


class GitHubIssueCreator:
    def __init__(self, repo: str = "glockpete/Forecastin"):
        self.repo = repo
        self.issues_dir = Path("github_issues")
        
    def parse_issue_file(self, file_path: Path) -> Dict:
        """Parse a GitHub issue markdown file and extract structured data."""
        content = file_path.read_text(encoding='utf-8')
        
        # Extract issue metadata from header
        metadata = {}
        lines = content.split('\n')
        
        # Get title (first line after #)
        title_match = re.match(r'^#\s+(.+?):\s+(.+)$', lines[0])
        if title_match:
            metadata['issue_id'] = title_match.group(1).strip()
            metadata['title'] = title_match.group(2).strip()
        else:
            # Fallback: use filename as issue_id
            metadata['issue_id'] = file_path.stem
            metadata['title'] = lines[0].replace('#', '').strip()
        
        # Extract metadata fields
        current_section = None
        sections = {}
        
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
                
            # Check for section headers
            if line.startswith('## '):
                current_section = line[3:].strip()
                sections[current_section] = []
            elif line.startswith('**') and ':**' in line:
                # Metadata field like **Severity:** P0 - CRITICAL
                key_match = re.match(r'\*\*([^:]+):\*\*\s*(.+)', line)
                if key_match:
                    key = key_match.group(1).strip().lower().replace(' ', '_')
                    value = key_match.group(2).strip()
                    metadata[key] = value
            elif current_section and line:
                # Add content to current section
                sections[current_section].append(line)
        
        # Combine sections into body
        body_parts = []
        for section_name, section_lines in sections.items():
            if section_lines:
                body_parts.append(f"## {section_name}")
                body_parts.extend(section_lines)
                body_parts.append("")  # Add spacing
        
        metadata['body'] = '\n'.join(body_parts).strip()
        
        # Extract labels from metadata
        labels = []
        if 'labels' in metadata:
            # Parse labels like `bug`, `critical`, `typescript`
            label_match = re.findall(r'`([^`]+)`', metadata['labels'])
            labels.extend(label_match)
        
        metadata['labels'] = labels
        
        return metadata
    
    def get_all_issues(self) -> List[Dict]:
        """Get all issues from the github_issues directory."""
        issues = []
        
        for file_path in self.issues_dir.glob("*.md"):
            if file_path.name == "README.md":
                continue
                
            try:
                issue_data = self.parse_issue_file(file_path)
                issues.append(issue_data)
            except Exception as e:
                print(f"Error parsing {file_path}: {e}")
                continue
        
        # Sort by severity (P0 first, then P1, etc.)
        severity_order = {'p0': 0, 'p1': 1, 'p2': 2, 'p3': 3}
        
        def get_severity_value(issue):
            severity = issue.get('severity', '').lower()
            if severity:
                parts = severity.split()
                if parts:
                    return severity_order.get(parts[0], 999)
            return 999
        
        issues.sort(key=get_severity_value)
        
        return issues
    
    def generate_gh_cli_commands(self, issues: List[Dict], dry_run: bool = False) -> List[str]:
        """Generate GitHub CLI commands for creating issues."""
        commands = []
        
        for issue in issues:
            title = issue['title']
            body = issue['body']
            labels = ','.join(issue['labels'])
            
            # Escape special characters for CLI
            title_escaped = title.replace('"', '\\"')
            body_escaped = body.replace('"', '\\"').replace('\n', '\\n')
            
            cmd = f'gh issue create --repo {self.repo} --title "{title_escaped}" --body "{body_escaped}" --label "{labels}"'
            
            if dry_run:
                cmd = f"# {cmd}"
            
            commands.append(cmd)
        
        return commands
    
    def generate_api_payloads(self, issues: List[Dict]) -> List[Dict]:
        """Generate API payloads for creating issues."""
        payloads = []
        
        for issue in issues:
            payload = {
                "title": issue['title'],
                "body": issue['body'],
                "labels": issue['labels']
            }
            payloads.append(payload)
        
        return payloads
    
    def generate_curl_commands(self, issues: List[Dict], dry_run: bool = False) -> List[str]:
        """Generate curl commands for API-based issue creation."""
        commands = []
        
        for issue in issues:
            payload = {
                "title": issue['title'],
                "body": issue['body'],
                "labels": issue['labels']
            }
            
            json_payload = json.dumps(payload)
            cmd = f'curl -X POST -H "Authorization: token $GITHUB_TOKEN" -H "Accept: application/vnd.github.v3+json" https://api.github.com/repos/{self.repo}/issues -d \'{json_payload}\''
            
            if dry_run:
                cmd = f"# {cmd}"
            
            commands.append(cmd)
        
        return commands
    
    def print_issue_summary(self, issues: List[Dict]):
        """Print a summary of all issues."""
        print(f"Found {len(issues)} issues to create:")
        print("-" * 80)
        
        for i, issue in enumerate(issues, 1):
            severity = issue.get('severity', 'Unknown')
            priority = issue.get('priority', 'Unknown')
            labels = ', '.join(issue['labels'])
            
            print(f"{i}. {issue['issue_id']}: {issue['title']}")
            print(f"   Severity: {severity}, Priority: {priority}")
            print(f"   Labels: {labels}")
            print()
    
    def create_script(self, method: str = "cli", dry_run: bool = False):
        """Create the main script for issue creation."""
        issues = self.get_all_issues()
        
        if not issues:
            print("No issues found in github_issues/ directory")
            return
        
        self.print_issue_summary(issues)
        
        if method == "cli":
            commands = self.generate_gh_cli_commands(issues, dry_run)
            script_name = "create_issues_gh_cli.sh"
        elif method == "api":
            commands = self.generate_curl_commands(issues, dry_run)
            script_name = "create_issues_api.sh"
        else:
            print(f"Unknown method: {method}")
            return
        
        # Create the shell script
        script_content = [
            "#!/bin/bash",
            f"# GitHub Issue Creation Script for {self.repo}",
            f"# Method: {method.upper()}",
            f"# Total issues: {len(issues)}",
            "",
            "# Set up environment",
            "set -e",
            "",
        ]
        
        if method == "api":
            script_content.extend([
                "# Ensure GITHUB_TOKEN is set",
                'if [ -z "$GITHUB_TOKEN" ]; then',
                '    echo "Error: GITHUB_TOKEN environment variable is not set"',
                '    echo "Please set it with: export GITHUB_TOKEN=your_token_here"',
                '    exit 1',
                'fi',
                "",
            ])
        
        script_content.append("# Issue creation commands:")
        script_content.extend(commands)
        
        script_path = Path("scripts") / script_name
        script_path.write_text('\n'.join(script_content), encoding='utf-8')
        
        # Make executable
        script_path.chmod(0o755)
        
        print(f"\nScript created: {script_path}")
        print(f"To execute: ./{script_path}")
        
        if dry_run:
            print("\n[DRY RUN MODE] Commands are commented out")
        else:
            print("\n[WARNING] This will create actual GitHub issues!")
            print("Review the script before running it.")
    
    def create_python_api_script(self):
        """Create a Python script for API-based issue creation."""
        issues = self.get_all_issues()
        payloads = self.generate_api_payloads(issues)
        
        script_content = [
            "#!/usr/bin/env python3",
            "\"\"\"",
            "GitHub Issue Creator - API Version",
            "Creates issues on glockpete/Forecastin repository using GitHub API",
            "\"\"\"",
            "",
            "import os",
            "import requests",
            "import json",
            "from typing import Dict, List",
            "",
            "GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')",
            "REPO = 'glockpete/Forecastin'",
            "API_URL = f'https://api.github.com/repos/{REPO}/issues'",
            "",
            "# Issue payloads",
            "ISSUES = " + json.dumps(payloads, indent=2),
            "",
            "def create_issue(payload: Dict) -> bool:",
            "    \"\"\"Create a single GitHub issue.\"\"\"",
            "    headers = {",
            "        'Authorization': f'token {GITHUB_TOKEN}',",
            "        'Accept': 'application/vnd.github.v3+json'",
            "    }",
            "    ",
            "    try:",
            "        response = requests.post(API_URL, headers=headers, json=payload)",
            "        if response.status_code == 201:",
            "            print(f\"✅ Created issue: {payload['title']}\")",
            "            return True",
            "        else:",
            "            print(f\"❌ Failed to create issue: {payload['title']}\")",
            "            print(f\"   Status: {response.status_code}\")",
            "            print(f\"   Response: {response.text}\")",
            "            return False",
            "    except Exception as e:",
            "        print(f\"❌ Error creating issue {payload['title']}: {e}\")",
            "        return False",
            "",
            "def main():",
            "    if not GITHUB_TOKEN:",
            "        print(\"Error: GITHUB_TOKEN environment variable is not set\")",
            "        print(\"Please set it with: export GITHUB_TOKEN=your_token_here\")",
            "        return",
            "    ",
            "    print(f\"Creating {len(ISSUES)} issues on {REPO}\")",
            "    print(\"-\" * 50)",
            "    ",
            "    success_count = 0",
            "    for i, issue_payload in enumerate(ISSUES, 1):",
            "        print(f\"\\n[{i}/{len(ISSUES)}] Creating: {issue_payload['title']}\")",
            "        if create_issue(issue_payload):",
            "            success_count += 1",
            "    ",
            "    print(f\"\\n✅ Successfully created {success_count}/{len(ISSUES)} issues\")",
            "",
            "if __name__ == \"__main__\":",
            "    main()",
        ]
        
        script_path = Path("scripts") / "create_issues_api.py"
        script_path.write_text('\n'.join(script_content), encoding='utf-8')
        script_path.chmod(0o755)
        
        print(f"Python API script created: {script_path}")


def main():
    parser = argparse.ArgumentParser(description='Create GitHub issues from templates')
    parser.add_argument('--method', choices=['cli', 'api', 'python'], default='cli',
                       help='Method for creating issues (cli: GitHub CLI, api: curl, python: Python API)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Generate commands but comment them out (dry run)')
    parser.add_argument('--repo', default='glockpete/Forecastin',
                       help='GitHub repository in format owner/repo')
    
    args = parser.parse_args()
    
    creator = GitHubIssueCreator(repo=args.repo)
    
    if args.method == 'python':
        creator.create_python_api_script()
    else:
        creator.create_script(method=args.method, dry_run=args.dry_run)


if __name__ == "__main__":
    main()