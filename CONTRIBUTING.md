# Contributing to Forecastin

Thank you for your interest in contributing to Forecastin! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. By participating in this project, you agree to:

- Be respectful and considerate in all interactions
- Provide constructive feedback
- Focus on what is best for the community and project
- Show empathy towards other contributors

## Getting Started

### Prerequisites

- Docker and Docker Compose (recommended)
- Python 3.9+ (for local development)
- Node.js 18+ (for frontend development)
- Git

### Initial Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Forecastin.git
   cd Forecastin
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/glockpete/Forecastin.git
   ```
4. **Set up development environment** (see [DEVELOPER_SETUP.md](docs/DEVELOPER_SETUP.md))

## Development Process

### Branching Strategy

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Creating a Branch

```bash
git checkout -b feature/your-feature-name
```

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Coding Standards

### Python (Backend)

- **Style Guide**: Follow PEP 8
- **Type Hints**: Use type hints for all function signatures
- **Docstrings**: Use Google-style docstrings
- **Imports**: Use absolute imports, organize with isort
- **Line Length**: 100 characters maximum

**Example:**
```python
from typing import List, Optional

def get_entities(path: str, limit: Optional[int] = None) -> List[dict]:
    """
    Retrieve entities from the hierarchy.

    Args:
        path: LTREE path string (e.g., 'world.asia.japan')
        limit: Optional maximum number of entities to return

    Returns:
        List of entity dictionaries with hierarchy information

    Raises:
        ValueError: If path format is invalid
    """
    pass
```

### TypeScript/React (Frontend)

- **Style Guide**: Follow Airbnb TypeScript style guide
- **Strict Mode**: All code must pass TypeScript strict mode
- **Components**: Use functional components with hooks
- **State Management**: React Query for server state, Zustand for UI state
- **Naming**:
  - Components: PascalCase (`UserProfile.tsx`)
  - Hooks: camelCase with 'use' prefix (`useEntityHierarchy.ts`)
  - Utilities: camelCase (`formatDate.ts`)

**Example:**
```typescript
interface EntityHierarchyProps {
  path: string;
  onSelect: (entityId: string) => void;
}

export const EntityHierarchy: React.FC<EntityHierarchyProps> = ({
  path,
  onSelect
}) => {
  // Implementation
};
```

### SQL

- **Keywords**: UPPERCASE
- **Tables/Columns**: snake_case
- **Always include**: Comments explaining complex queries
- **Migrations**: Include both up and down migrations

## Testing Requirements

All contributions must include appropriate tests:

### Backend Tests

- **Unit Tests**: Required for all new functions/classes
- **Integration Tests**: Required for API endpoints
- **Performance Tests**: Required for optimizations
- **Coverage Target**: Minimum 80% code coverage

**Run tests:**
```bash
cd api
pytest tests/ -v
pytest tests/ --cov=. --cov-report=html
```

### Frontend Tests

- **Component Tests**: Required for all new components
- **Integration Tests**: Required for critical user flows
- **Coverage Target**: Minimum 70% code coverage

**Run tests:**
```bash
cd frontend
npm test
npm run test:coverage
```

See [TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for detailed testing documentation.

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Examples

```bash
feat(api): add RSS feed deduplication with 0.8 similarity threshold

Implement content deduplication system using semantic similarity
analysis to prevent duplicate RSS content ingestion.

Closes #123
```

```bash
fix(websocket): prevent infinite reconnection loop

Add connection state guard to prevent race condition in WebSocket
reconnection logic that could cause infinite connection attempts.

Fixes #456
```

```bash
docs(readme): update API endpoint documentation

Replace obsolete v3 API references with actual endpoint paths.
Update migration file references to correct locations.
```

## Pull Request Process

### Before Submitting

1. ✅ **Tests pass**: Run full test suite locally
2. ✅ **Linting passes**: No linting errors
3. ✅ **TypeScript compiles**: Zero compilation errors (frontend)
4. ✅ **Documentation updated**: Update relevant docs
5. ✅ **CHANGELOG updated**: Add entry to CHANGELOG.md

### PR Title Format

Use the same format as commit messages:
```
feat(component): brief description
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran to verify your changes.

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] No new warnings generated
- [ ] CHANGELOG.md updated

## Related Issues
Closes #(issue number)
```

### Review Process

1. **Automated Checks**: CI/CD pipeline must pass
2. **Code Review**: At least one maintainer approval required
3. **Performance Check**: Performance SLOs validated
4. **Security Check**: Security scans must pass
5. **Documentation Review**: Docs must be clear and complete

### After Approval

- Squash commits if requested
- Rebase on latest main if needed
- Maintainer will merge your PR

## Documentation

### When to Update Documentation

Update documentation when you:
- Add new features
- Change API endpoints
- Modify environment variables
- Update dependencies
- Change deployment process
- Fix bugs that affect documented behaviour

### Documentation Files to Update

- **README.md**: High-level features and quick start
- **AGENTS.md**: Non-obvious patterns and gotchas
- **GOLDEN_SOURCE.md**: Project state and phases
- **API docs**: OpenAPI specs and endpoint documentation
- **Architecture docs**: System design changes
- **CHANGELOG.md**: All user-facing changes

### Documentation Style

- Use **British English** (colour, optimise, etc.)
- Use **metric system** (kilometres, metres)
- Use **clear examples** with code snippets
- Use **diagrams** where helpful (Mermaid, ASCII)
- Keep **line length to 100 characters** in markdown

## Performance Considerations

All code changes should maintain or improve performance SLOs:

| Metric | Target | Test Method |
|--------|--------|-------------|
| Ancestor Resolution | <10ms | `pytest api/tests/test_performance.py` |
| Throughput | >10,000 RPS | Load testing script |
| Cache Hit Rate | >90% | Monitor cache metrics |
| WebSocket Latency | <200ms | WebSocket health endpoint |

See [PERFORMANCE_OPTIMIZATION_REPORT.md](docs/PERFORMANCE_OPTIMIZATION_REPORT.md) for details.

## Security

### Reporting Security Vulnerabilities

**DO NOT** open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for reporting procedures.

### Security Best Practices

- Never commit secrets or credentials
- Validate all user input
- Use parameterized SQL queries (no string concatenation)
- Sanitize HTML content from RSS feeds
- Follow OWASP Top 10 guidelines
- Use security headers (CORS, CSP, etc.)

## Feature Flags

New features should use feature flags for gradual rollout:

1. Add feature flag to database
2. Implement feature behind flag check
3. Test with flag enabled
4. Gradual rollout: 10% → 25% → 50% → 100%
5. Remove flag after full rollout (if appropriate)

Example:
```python
if await feature_flag_service.is_enabled("new_feature", user_id):
    # New feature code
else:
    # Legacy code
```

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue with bug template
- **Features**: Open a GitHub Issue with feature template
- **Security**: See [SECURITY.md](SECURITY.md)

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- CHANGELOG.md for significant contributions
- README.md acknowledgments section

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (to be determined for open source launch).

---

**Thank you for contributing to Forecastin!**

Your contributions help make geopolitical intelligence more accessible and actionable for everyone.
