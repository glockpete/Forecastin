# Requirements Files

This directory contains Python dependency files for the Forecastin API.

## Files

### `requirements.txt`
Production runtime dependencies required to run the API server.

**Install:**
```bash
pip install -r requirements.txt
```

### `requirements-dev.txt`
Development dependencies including testing, linting, security scanning, and performance profiling tools.

**Install:**
```bash
pip install -r requirements.txt -r requirements-dev.txt
```

## Deployment Scenarios

### Local Development
```bash
pip install -r requirements.txt -r requirements-dev.txt
pre-commit install
```

### Production/Docker
```bash
pip install -r requirements.txt
```

### CI/CD
```bash
pip install -r requirements.txt -r requirements-dev.txt
```

## Maintenance

- Keep versions pinned for reproducible builds
- Update dependencies regularly using `pip list --outdated`
- Test updates in a separate branch before merging
- Use Dependabot for automated security updates

## Obsolete Files

The following files have been consolidated and should not be used:
- `requirements_new.txt` - was incomplete/unused
- `requirements_mini.txt` - consolidated into requirements.txt
- `requirements.railway.txt` - use requirements.txt instead
