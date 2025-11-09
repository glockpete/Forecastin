# GitHub Issue Creation Scripts

This directory contains scripts for creating GitHub issues from markdown templates in the `github_issues/` directory.

## Available Scripts

### Main Script
- [`create_github_issues.py`](create_github_issues.py) - Main script that generates issue creation commands

### Generated Scripts (Created by main script)
- [`create_issues_gh_cli.sh`](create_issues_gh_cli.sh) - GitHub CLI commands for issue creation
- [`create_issues_api.sh`](create_issues_api.sh) - curl API commands for issue creation  
- [`create_issues_api.py`](create_issues_api.py) - Python API script for issue creation

### Documentation
- [`create_github_issues_README.md`](create_github_issues_README.md) - Detailed usage guide

## Quick Start

### Using GitHub CLI (Recommended)
```bash
# Generate and execute GitHub CLI commands
python create_github_issues.py --method cli
./create_issues_gh_cli.sh
```

### Using API with curl
```bash
# Set GitHub token first
export GITHUB_TOKEN=your_token_here

# Generate and execute API commands
python create_github_issues.py --method api
./create_issues_api.sh
```

### Using Python API
```bash
# Set GitHub token first
export GITHUB_TOKEN=your_token_here

# Generate and execute Python script
python create_github_issues.py --method python
./create_issues_api.py
```

## Features

- **Automatic Issue Parsing**: Reads markdown files from `github_issues/` directory
- **Priority Sorting**: Creates issues in severity order (P0 first, then P1, etc.)
- **Multiple Methods**: Supports GitHub CLI, curl API, and Python API
- **Dry Run Mode**: Preview commands without executing them
- **Error Handling**: Robust parsing with fallback for malformed files

## Issue Format

The scripts expect markdown files with this structure:
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

## Repository

The scripts are configured to create issues on the `glockpete/Forecastin` repository by default. To use a different repository:

```bash
python create_github_issues.py --repo owner/repository_name
```

## Security

- GitHub tokens are not stored in generated scripts
- API calls use secure HTTPS
- Dry run mode allows safe testing before execution

## Troubleshooting

### Authentication Issues
```bash
# For GitHub CLI
gh auth status
gh auth login

# For API methods
echo $GITHUB_TOKEN  # Check if token is set
export GITHUB_TOKEN=your_token_here
```

### Permission Issues
```bash
chmod +x *.sh *.py  # Make scripts executable
```

### File Encoding Issues
The scripts handle UTF-8 encoding properly for Windows environments.

## Related Files

- [`github_issues/README.md`](../github_issues/README.md) - Issue directory documentation
- [`github_issues/`](../github_issues/) - Directory containing issue templates