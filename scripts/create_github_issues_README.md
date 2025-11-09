# GitHub Issue Creation Script

This script automates the creation of GitHub issues from markdown templates in the `github_issues/` directory.

## Features

- **Multiple Methods**: Supports GitHub CLI, curl API, and Python API
- **Dry Run Mode**: Preview commands without executing them
- **Issue Parsing**: Automatically extracts metadata from markdown files
- **Priority Sorting**: Creates issues in severity order (P0 first)

## Usage

### Prerequisites

1. **GitHub CLI** (for CLI method):
   ```bash
   # Install GitHub CLI
   gh auth login
   ```

2. **GitHub Token** (for API methods):
   ```bash
   # Set your GitHub token
   export GITHUB_TOKEN=your_personal_access_token_here
   ```

### Basic Usage

```bash
# Generate GitHub CLI commands (recommended)
python scripts/create_github_issues.py --method cli

# Generate curl API commands
python scripts/create_github_issues.py --method api

# Generate Python API script
python scripts/create_github_issues.py --method python

# Dry run (preview commands without executing)
python scripts/create_github_issues.py --method cli --dry-run
```

### Generated Scripts

The script creates executable scripts in the `scripts/` directory:

- **`create_issues_gh_cli.sh`** - GitHub CLI commands
- **`create_issues_api.sh`** - curl API commands  
- **`create_issues_api.py`** - Python API script

### Execution

```bash
# Make script executable and run
chmod +x scripts/create_issues_gh_cli.sh
./scripts/create_issues_gh_cli.sh

# Or for Python script
chmod +x scripts/create_issues_api.py
./scripts/create_issues_api.py
```

## Issue Format

The script expects markdown files in `github_issues/` with this structure:

```markdown
# BUG-001: Issue Title

**Severity:** P0 - CRITICAL  
**Priority:** High  
**Type:** Bug  
**Status:** Open  
**Assignee:** TBD  
**Labels:** `bug`, `critical`, `typescript`

## Description
Issue description...

## Impact
What's affected...

## Reproduction Steps
1. Step 1
2. Step 2

## Expected Behavior
What should happen...

## Actual Behavior
What actually happens...

## Proposed Fix
How to fix it...

## Code References
- File: `path/to/file`
- Related: documentation

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Additional Context
Any additional information...
```

## Supported Metadata

The script automatically extracts:
- **Title** from the first line
- **Severity** (P0, P1, etc.)
- **Priority** (High, Medium, Low)
- **Type** (Bug, Feature, Enhancement)
- **Labels** from backtick-enclosed tags
- **Body** from all sections

## Issue Priority Order

Issues are created in this order:
1. P0 - CRITICAL
2. P1 - HIGH  
3. P2 - MEDIUM
4. P3 - LOW

## Error Handling

- Invalid markdown files are skipped with warnings
- API failures are reported with detailed error messages
- Script stops on first error (set -e in shell scripts)

## Security Notes

- GitHub tokens are not stored in scripts
- API calls use secure HTTPS
- Dry run mode allows safe testing

## Example Output

```bash
$ python scripts/create_github_issues.py --method cli --dry-run

Found 10 issues to create:
--------------------------------------------------------------------------------
1. BUG-001: Missing Type Exports Block TypeScript Compilation
   Severity: P0 - CRITICAL, Priority: High
   Labels: bug, critical, typescript, compilation

2. BUG-003: HierarchyResponse Type Missing .entities Property
   Severity: P0 - CRITICAL, Priority: High
   Labels: bug, critical, typescript, api-contract

...

Script created: scripts/create_issues_gh_cli.sh
To execute: ./scripts/create_issues_gh_cli.sh

⚠️  DRY RUN MODE: Commands are commented out
```

## Troubleshooting

### GitHub CLI Authentication
```bash
gh auth status  # Check authentication
gh auth login   # Re-authenticate if needed
```

### API Token Issues
```bash
echo $GITHUB_TOKEN  # Check if token is set
export GITHUB_TOKEN=your_token_here  # Set token
```

### Permission Issues
```bash
chmod +x scripts/*.sh  # Make scripts executable
chmod +x scripts/*.py  # Make Python scripts executable
```

### File Encoding
Ensure issue files are UTF-8 encoded:
```bash
file -i github_issues/*.md  # Check encoding
```

## Repository Customization

To use with a different repository:
```bash
python scripts/create_github_issues.py --repo owner/repository_name
```

## Related Files

- `github_issues/README.md` - Issue directory documentation
- `scripts/create_github_issues.py` - Main script
- Generated scripts in `scripts/` directory