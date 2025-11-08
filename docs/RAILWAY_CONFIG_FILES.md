# Railway Configuration Files Guide

## Overview

Railway supports **Config as Code** through `railway.json` or `railway.toml` files. These configuration files allow you to version control your deployment settings and override Railway dashboard configurations.

**Key Benefits:**
- ✅ Version controlled deployment configuration
- ✅ Consistent deployments across environments
- ✅ Override dashboard settings with code
- ✅ Easier team collaboration
- ✅ Infrastructure as Code approach

---

## Configuration Files in This Project

This project includes Railway configuration files for both services:

### API Service
- **Location**: `api/railway.json` or `api/railway.toml`
- **Dockerfile**: `Dockerfile.railway` (optimized 3-5 min build)
- **Port**: 9000
- **Health Check**: `/health`
- **Watch Pattern**: Only rebuilds when `api/**` files change

### Frontend Service
- **Location**: `frontend/railway.json` or `frontend/railway.toml`
- **Dockerfile**: `Dockerfile`
- **Port**: 80 (nginx)
- **Health Check**: `/`
- **Watch Pattern**: Only rebuilds when `frontend/**` files change

---

## File Format Options

Railway supports both JSON and TOML formats. Choose based on your preference:

### Option 1: railway.json (Recommended for IDE Support)

**Advantages:**
- JSON Schema validation
- Autocomplete in VS Code and other IDEs
- Familiar format for most developers

**Example**: `api/railway.json`
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.railway",
    "watchPatterns": ["api/**"]
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port 9000",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Option 2: railway.toml (More Readable)

**Advantages:**
- More human-readable
- Less verbose (no quotes, commas)
- Popular in Rust/DevOps communities

**Example**: `api/railway.toml`
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.railway"
watchPatterns = ["api/**"]

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port 9000"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**You only need ONE format** - pick whichever you prefer!

---

## Configuration Options Reference

### Build Section

```json
{
  "build": {
    "builder": "DOCKERFILE",           // Use Dockerfile for builds
    "dockerfilePath": "Dockerfile",     // Path to Dockerfile
    "buildCommand": "npm run build",    // Optional custom build command
    "watchPatterns": ["src/**"]         // Only trigger builds on these file changes
  }
}
```

**Available Builders:**
- `DOCKERFILE` - Use a Dockerfile (recommended for this project)
- `NIXPACKS` - Railway's automatic builder (detects language)
- `BUILDPACKS` - Cloud Native Buildpacks

### Deploy Section

```json
{
  "deploy": {
    "startCommand": "npm start",              // Command to start your service
    "healthcheckPath": "/health",             // Endpoint for health checks
    "healthcheckTimeout": 100,                // Timeout in seconds
    "restartPolicyType": "ON_FAILURE",        // When to restart
    "restartPolicyMaxRetries": 10,            // Max restart attempts
    "numReplicas": 1                          // Number of instances
  }
}
```

**Restart Policy Types:**
- `ON_FAILURE` - Restart only on crashes (recommended)
- `ALWAYS` - Always restart
- `NEVER` - Don't restart

---

## How Railway Uses These Files

### Priority Order

Railway configuration priority (highest to lowest):

1. **Config file in code** (`railway.json` or `railway.toml`) ← Highest priority
2. **Dashboard settings** (Railway UI)
3. **Auto-detection** (Railway's defaults)

> **Important**: Config files ALWAYS override dashboard settings!

### File Location

By default, Railway looks for config files in:
- **Service root directory** (e.g., `api/railway.json`)
- **Repository root** (e.g., `railway.json`)

You can also specify a custom path in Railway dashboard:
- Go to Service → Settings → Config File Path
- Enter: `/api/railway.toml` or `/frontend/railway.json`

---

## Setup Instructions

### For API Service

1. **In Railway Dashboard:**
   - Go to your API service
   - Settings → **Root Directory**: Set to `api`
   - Settings → **Config File Path**: Leave empty (auto-detects `railway.json`)

2. **Configuration is now in code!**
   - The `api/railway.json` file controls the build
   - Push changes to GitHub to deploy with new config

3. **Verify it's working:**
   - Push a change to `api/railway.json`
   - Check Railway build logs for: "Using config from railway.json"

### For Frontend Service

1. **In Railway Dashboard:**
   - Go to your Frontend service
   - Settings → **Root Directory**: Set to `frontend`
   - Settings → **Config File Path**: Leave empty (auto-detects)

2. **Configuration is now in code!**
   - The `frontend/railway.json` file controls the build

---

## Watch Patterns (Smart Rebuilds)

Watch patterns prevent unnecessary rebuilds by only triggering deployments when relevant files change.

### Current Configuration

**API Service** (`api/railway.json`):
```json
{
  "build": {
    "watchPatterns": ["api/**"]
  }
}
```
- ✅ Rebuilds when: Files in `api/` directory change
- ❌ Skips rebuild when: Files in `frontend/` or `docs/` change

**Frontend Service** (`frontend/railway.json`):
```json
{
  "build": {
    "watchPatterns": ["frontend/**"]
  }
}
```
- ✅ Rebuilds when: Files in `frontend/` directory change
- ❌ Skips rebuild when: Files in `api/` or `docs/` change

### Benefits

**Without watch patterns:**
```
You change: frontend/src/App.tsx
Railway rebuilds: ✅ Frontend + ✅ API (unnecessary!)
Build time: ~8-10 minutes
Cost: Double the build minutes
```

**With watch patterns:**
```
You change: frontend/src/App.tsx
Railway rebuilds: ✅ Frontend only
Build time: ~3-5 minutes
Cost: Half the build minutes ✨
```

---

## Environment Variables

Environment variables are **NOT** stored in config files for security reasons.

### Setting Environment Variables

**Option 1: Railway Dashboard** (Recommended for secrets)
```
Service → Variables → Add Variable
DATABASE_URL = ${{Postgres.DATABASE_URL}}
REDIS_URL = ${{Redis.REDIS_URL}}
API_PORT = 9000
```

**Option 2: Railway CLI**
```bash
railway variables set DATABASE_URL=${{Postgres.DATABASE_URL}}
railway variables set API_PORT=9000
```

**Never commit secrets to config files!**

---

## Common Configuration Examples

### Example 1: Different Dockerfile for Production

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.production"
  }
}
```

### Example 2: Custom Build Command (Node.js)

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build:production"
  },
  "deploy": {
    "startCommand": "npm run start:prod"
  }
}
```

### Example 3: Multiple Watch Patterns

```json
{
  "build": {
    "watchPatterns": [
      "api/**",
      "shared/**",
      "package.json"
    ]
  }
}
```

### Example 4: No Auto-Restart (For Jobs/Crons)

```json
{
  "deploy": {
    "restartPolicyType": "NEVER"
  }
}
```

---

## Troubleshooting

### Config File Not Being Used

**Symptoms**: Changes to `railway.json` don't affect deployment

**Solutions:**

1. **Check file location:**
   ```bash
   # Should be in service root directory
   api/railway.json  ✅
   railway.json      ❌ (if root directory is 'api')
   ```

2. **Verify JSON syntax:**
   ```bash
   # Validate JSON
   cat api/railway.json | python -m json.tool
   ```

3. **Check Railway logs:**
   - Look for: "Using config from railway.json"
   - Or: "Config file not found, using dashboard settings"

4. **Force config file path:**
   - Service → Settings → Config File Path
   - Set explicitly: `railway.json` or `railway.toml`

### Build Still Triggers on Unrelated Changes

**Symptoms**: API rebuilds when you change frontend files

**Solutions:**

1. **Add watch patterns:**
   ```json
   {
     "build": {
       "watchPatterns": ["api/**"]
     }
   }
   ```

2. **Verify in Railway dashboard:**
   - Service → Settings → Deployment
   - Check "Watch Paths" matches your config

3. **Test with a commit:**
   ```bash
   # Change a frontend file
   echo "// test" >> frontend/src/App.tsx
   git commit -am "Test watch patterns"
   git push

   # Check Railway - API should NOT rebuild
   ```

### Health Check Failing

**Symptoms**: Deployment succeeds but Railway marks service as unhealthy

**Solutions:**

1. **Verify health endpoint exists:**
   ```bash
   curl https://your-api.railway.app/health
   # Should return 200 OK
   ```

2. **Adjust timeout:**
   ```json
   {
     "deploy": {
       "healthcheckTimeout": 300  // 5 minutes for slow startups
     }
   }
   ```

3. **Check health check path:**
   ```json
   {
     "deploy": {
       "healthcheckPath": "/health",  // Not "/health/"
     }
   }
   ```

---

## Migration Guide

### From Dashboard Configuration → Config Files

If you've already configured services in the Railway dashboard:

1. **Document current settings:**
   ```
   Dashboard → Service → Settings
   - Note: Root Directory, Dockerfile Path, Start Command
   - Note: Health check settings
   ```

2. **Create config file matching current settings:**
   ```bash
   # In your service directory
   touch railway.json
   ```

3. **Add configuration:**
   ```json
   {
     "$schema": "https://railway.com/railway.schema.json",
     "build": {
       "builder": "DOCKERFILE",
       "dockerfilePath": "Dockerfile.railway"
     },
     "deploy": {
       "startCommand": "your-current-start-command",
       "healthcheckPath": "/health"
     }
   }
   ```

4. **Commit and push:**
   ```bash
   git add railway.json
   git commit -m "Add Railway config as code"
   git push
   ```

5. **Verify Railway picks it up:**
   - Check build logs for "Using config from railway.json"

6. **Remove dashboard overrides (optional):**
   - Dashboard settings no longer matter (config file takes precedence)
   - You can clear them or leave them as fallback

---

## Best Practices

### ✅ Do's

- **Version control config files**: Always commit to git
- **Use watch patterns**: Save build time and costs
- **Set health checks**: Enable Railway's auto-healing
- **Use schema validation**: Add `$schema` to JSON files
- **Document changes**: Add comments explaining custom settings
- **Test locally first**: Verify Docker builds before pushing

### ❌ Don'ts

- **Don't commit secrets**: Use Railway variables for sensitive data
- **Don't use overly broad watch patterns**: `**` triggers on everything
- **Don't set very short health check timeouts**: Allow time for startup
- **Don't skip health checks**: Railway needs them for monitoring
- **Don't mix formats**: Pick JSON or TOML, not both

---

## Quick Reference

### File Structure
```
Forecastin/
├── api/
│   ├── railway.json     ← API configuration (pick one)
│   ├── railway.toml     ← API configuration (pick one)
│   └── Dockerfile.railway
├── frontend/
│   ├── railway.json     ← Frontend configuration (pick one)
│   ├── railway.toml     ← Frontend configuration (pick one)
│   └── Dockerfile
└── docs/
    └── RAILWAY_CONFIG_FILES.md  ← This file
```

### Common Commands

```bash
# Validate JSON config
cat api/railway.json | python -m json.tool

# Test Docker build locally (API)
docker build -f api/Dockerfile.railway -t test-api api/

# Test Docker build locally (Frontend)
docker build -f frontend/Dockerfile -t test-frontend frontend/

# View Railway service status
railway status

# Force redeploy with config
git commit --allow-empty -m "Trigger redeploy"
git push
```

---

## Related Documentation

- **[Railway Setup Guide](./RAILWAY_SETUP_GUIDE.md)** - Complete Railway deployment guide
- **[Railway + GitHub + Claude Setup](./RAILWAY_GITHUB_CLAUDE_SETUP.md)** - Full workflow guide
- **[API Railway Build Fix](../api/RAILWAY_BUILD_FIX.md)** - Troubleshooting build issues
- **[Railway Official Docs](https://docs.railway.com/guides/config-as-code)** - Config as Code reference

---

## Support

If you encounter issues with Railway configuration files:

1. **Check Railway build logs**: Look for config file detection messages
2. **Validate your JSON/TOML**: Use online validators or CLI tools
3. **Review this guide**: Ensure you're following best practices
4. **Railway Discord**: Community support for Railway-specific issues
5. **GitHub Issues**: Report project-specific problems

---

## Changelog

### 2025-11-08
- ✅ Created initial `railway.json` files for API and Frontend
- ✅ Created alternative `railway.toml` files
- ✅ Added watch patterns for optimized rebuilds
- ✅ Configured health checks for both services
- ✅ Set restart policies for production reliability

---

**You're now using Infrastructure as Code with Railway! 🚀**

All deployment configuration is version controlled and can be reviewed in pull requests alongside your code changes.
