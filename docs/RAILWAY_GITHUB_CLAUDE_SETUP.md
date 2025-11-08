# Railway + GitHub + Claude Code Web - Complete Setup Guide

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Part 1: GitHub Setup](#part-1-github-setup)
- [Part 2: Railway Setup with GitHub Integration](#part-2-railway-setup-with-github-integration)
- [Part 3: Testing with Claude Code Web](#part-3-testing-with-claude-code-web)
- [Complete Workflow Examples](#complete-workflow-examples)
- [Troubleshooting](#troubleshooting)
- [Quick Reference Commands](#quick-reference-commands)

---

## Overview

This guide shows you how to set up a complete testing workflow using:
- **GitHub** - Version control and deployment trigger
- **Railway** - Cloud deployment platform
- **Claude Code Web** - AI-assisted development and testing

### What You'll Achieve

```
┌─────────────────────────────────────────────────────────┐
│                    Your Workflow                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Make changes in Claude Code Web                     │
│           ↓                                              │
│  2. Push to GitHub branch                                │
│           ↓                                              │
│  3. Railway auto-deploys                                 │
│           ↓                                              │
│  4. Test live deployment                                 │
│           ↓                                              │
│  5. Iterate quickly with Claude                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before you begin, ensure you have:

1. **GitHub Account** - https://github.com
2. **Railway Account** - https://railway.app (can sign in with GitHub)
3. **Claude Code Web Access** - https://claude.ai/code
4. **Repository Pushed to GitHub** - Your Forecastin repository
5. **Git CLI** (optional) - For local commands

---

## Part 1: GitHub Setup

### 1.1 Prepare Your Repository

Your Forecastin repository should already be on GitHub. If not:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add remote (replace with your GitHub repo URL)
git remote add origin https://github.com/YOUR_USERNAME/Forecastin.git

# Push to GitHub
git push -u origin main
```

### 1.2 Create a Development Branch

It's best practice to use branches for testing:

```bash
# Create and switch to development branch
git checkout -b railway-testing

# Push to GitHub
git push -u origin railway-testing
```

### 1.3 Verify Repository Structure

Ensure your repository has the required files:

```
Forecastin/
├── api/
│   ├── Dockerfile.railway          ✅ Required for Railway
│   ├── requirements.railway.txt    ✅ Required for Railway
│   ├── main.py                     ✅ FastAPI application
│   └── ...
├── frontend/
│   ├── Dockerfile                  ✅ Required for Railway
│   ├── package.json                ✅ Required for Railway
│   └── ...
└── docker-compose.yml              ℹ️ For local development
```

**Important**: Railway will use `api/Dockerfile.railway` for fast builds (3-5 minutes).

---

## Part 2: Railway Setup with GitHub Integration

### 2.1 Create Railway Account

1. Go to https://railway.app
2. Click **"Login with GitHub"** (recommended for easier integration)
3. Authorize Railway to access your GitHub account

### 2.2 Create New Project

1. Click **"New Project"** in Railway dashboard
2. Select **"Deploy from GitHub repo"**
3. You'll see a list of your GitHub repositories
4. Select **"Forecastin"**

Railway will scan your repository and detect the structure.

### 2.3 Set Up PostgreSQL Database

**First, add PostgreSQL:**

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway provisions a PostgreSQL instance automatically

**Enable Required Extensions:**

1. Click on the PostgreSQL service
2. Go to **"Connect"** tab
3. Click **"Connect"** to open the SQL console
4. Run these commands:

```sql
-- Enable PostGIS extension for geospatial features
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable LTREE extension for hierarchical data
CREATE EXTENSION IF NOT EXISTS ltree;

-- Verify extensions are installed
\dx
```

You should see both extensions listed.

**Note the database URL:**
- Railway auto-generates `DATABASE_URL` environment variable
- You'll reference this in your API service as `${{Postgres.DATABASE_URL}}`

### 2.4 Set Up Redis Cache

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add Redis"**
3. Railway provisions a Redis instance automatically

**Note the Redis URL:**
- Railway auto-generates `REDIS_URL` environment variable
- You'll reference this in your API service as `${{Redis.REDIS_URL}}`

### 2.5 Configure Backend API Service

Railway should have already created a service from your GitHub repo. Now configure it:

#### Configure Build Settings

1. Click on the API service in Railway dashboard
2. Go to **"Settings"** tab
3. Set the following:

| Setting | Value | Why |
|---------|-------|-----|
| **Root Directory** | `api` | Tells Railway to build from the `api` folder |
| **Dockerfile Path** | `Dockerfile.railway` | Uses optimized build (3-5 min) without Prophet |
| **Branch** | `railway-testing` | Deploy from your testing branch |

#### Set Environment Variables

1. Go to **"Variables"** tab
2. Click **"+ New Variable"** for each of these:

```bash
# Database connection (references PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis connection (references Redis service)
REDIS_URL=${{Redis.REDIS_URL}}

# API Configuration
API_PORT=9000
ENVIRONMENT=production

# WebSocket Configuration (prevents 1006 disconnects)
WS_PING_INTERVAL=30
WS_PING_TIMEOUT=10

# CORS Origins (will update after frontend deployed)
ALLOWED_ORIGINS=http://localhost:3000

# Public URLs (will update after deployment)
PUBLIC_BASE_URL=https://your-api-domain.railway.app
WS_PUBLIC_URL=wss://your-api-domain.railway.app/ws
```

**Note**: Railway's `${{ServiceName.VARIABLE}}` syntax automatically links services.

#### Configure Networking

1. Go to **"Settings"** → **"Networking"**
2. Railway should auto-detect **Port 9000** from the Dockerfile
3. If not, manually set it to `9000`

#### Get Your API URL

1. Go to **"Settings"** → **"Domains"**
2. Railway auto-generates a domain like `forecastin-api-production.up.railway.app`
3. Copy this URL - you'll need it for the frontend

**Example**: `https://forecastin-api-production-abc123.up.railway.app`

### 2.6 Configure Frontend Service

#### Add Frontend as Separate Service

1. In Railway project dashboard, click **"+ New"**
2. Select **"GitHub Repo"**
3. Choose the **same Forecastin repository**
4. Railway creates a new service

#### Configure Build Settings

1. Click on the frontend service
2. Go to **"Settings"** tab
3. Set the following:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Branch** | `railway-testing` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | Uses Dockerfile (nginx) |

#### Set Environment Variables

1. Go to **"Variables"** tab
2. Add these build-time variables:

```bash
# API Connection (replace with your actual API URL from step 2.5)
REACT_APP_API_URL=https://forecastin-api-production-abc123.up.railway.app
REACT_APP_WS_URL=wss://forecastin-api-production-abc123.up.railway.app/ws

# Build Configuration
NODE_ENV=production
```

**Critical**: Replace the URLs with your actual API domain from step 2.5.

#### Configure Networking

1. Go to **"Settings"** → **"Networking"**
2. Set **Port** to `80` (nginx serves on port 80)

#### Get Your Frontend URL

1. Go to **"Settings"** → **"Domains"**
2. Railway auto-generates a domain like `forecastin-frontend.up.railway.app`
3. This is your production URL

**Example**: `https://forecastin-frontend-xyz789.up.railway.app`

### 2.7 Update API CORS Settings

Now that you have your frontend URL, update the API to allow connections:

1. Go back to your **API service**
2. Go to **"Variables"** tab
3. Update `ALLOWED_ORIGINS` to:

```bash
ALLOWED_ORIGINS=https://forecastin-frontend-xyz789.up.railway.app,http://localhost:3000
```

4. Update `PUBLIC_BASE_URL` if needed
5. Click **"Deploy"** to apply changes

### 2.8 Enable Automatic Deployments

Railway automatically deploys when you push to GitHub:

1. Go to API service → **"Settings"** → **"Deployment"**
2. Verify **"Watch Paths"** includes `api/**` (or leave default to watch all)
3. Go to Frontend service → **"Settings"** → **"Deployment"**
4. Verify **"Watch Paths"** includes `frontend/**`

**Result**: Every push to your `railway-testing` branch will trigger a new deployment.

---

## Part 3: Testing with Claude Code Web

### 3.1 Connect Claude Code to GitHub

1. Go to https://claude.ai/code
2. Click **"Connect to GitHub"**
3. Authorize Claude to access your repositories
4. Select **"Forecastin"** repository
5. Claude will clone the repository

### 3.2 Make Changes in Claude Code Web

Let's test the workflow with a simple change:

**Example: Add a new health check field**

1. In Claude Code Web, ask:
   ```
   Add a "version" field to the /health endpoint that returns "1.0.0"
   ```

2. Claude will:
   - Read `api/main.py` or relevant files
   - Make the changes
   - Show you the diff

3. Review and approve the changes

### 3.3 Commit and Push from Claude Code Web

1. After Claude makes changes, ask:
   ```
   Commit these changes with message "Add version to health endpoint"
   and push to the railway-testing branch
   ```

2. Claude will execute:
   ```bash
   git add .
   git commit -m "Add version to health endpoint"
   git push origin railway-testing
   ```

3. Claude will confirm the push succeeded

### 3.4 Monitor Railway Deployment

**Automatic deployment is triggered!**

1. Go to Railway dashboard
2. You'll see a new deployment starting in your API service
3. Click on **"Deployments"** tab to watch progress

**What you'll see:**

```
Building...
├── Cloning repository from GitHub
├── Checking out railway-testing branch
├── Building from api/Dockerfile.railway
├── Installing dependencies (3-5 minutes)
├── Building image
└── Deploying... ✅

Deploy successful!
```

### 3.5 Test Your Changes

**Test the health endpoint:**

1. In Claude Code Web, ask:
   ```
   Test the /health endpoint on Railway to verify the version field is present
   ```

2. Claude will execute:
   ```bash
   curl https://forecastin-api-production-abc123.up.railway.app/health
   ```

3. You should see:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "redis": "connected",
     "version": "1.0.0"
   }
   ```

**Success!** Your change is live on Railway.

### 3.6 Test Frontend Changes

**Example: Update UI to display version**

1. In Claude Code Web, ask:
   ```
   Update the frontend to fetch and display the API version from the /health endpoint
   ```

2. Claude makes changes to frontend files
3. Commit and push:
   ```
   Commit and push these frontend changes to railway-testing
   ```

4. Railway automatically deploys the frontend
5. Visit your frontend URL: `https://forecastin-frontend-xyz789.up.railway.app`
6. Verify the version is displayed

---

## Complete Workflow Examples

### Example 1: Fix a Bug with Claude

**Scenario**: WebSocket connection is failing

1. **Identify the issue in Claude Code Web:**
   ```
   The WebSocket connection is timing out after 60 seconds.
   Check the WS_PING_INTERVAL setting and increase it if needed.
   ```

2. **Claude investigates:**
   - Reads `api/main.py` and WebSocket configuration
   - Identifies the issue
   - Suggests solution

3. **Claude makes the fix:**
   ```
   Update the WebSocket ping interval to 30 seconds and add proper error handling
   ```

4. **Commit and push:**
   ```
   Commit this fix and push to railway-testing
   ```

5. **Railway auto-deploys** (3-5 minutes)

6. **Test with Claude:**
   ```
   Test the WebSocket connection using wscat to verify it stays connected
   ```

7. **Verify fix works:**
   ```bash
   wscat -c wss://forecastin-api-production-abc123.up.railway.app/ws/health
   # Should stay connected with periodic heartbeats
   ```

### Example 2: Add a New Feature

**Scenario**: Add a new API endpoint for entity search

1. **Define the feature in Claude:**
   ```
   Add a new /api/entities/search endpoint that accepts a query parameter
   and returns matching entities from the database
   ```

2. **Claude implements:**
   - Creates the new endpoint
   - Adds database queries
   - Updates API documentation

3. **Test locally (optional):**
   ```
   Can you test this endpoint with a sample query?
   ```

4. **Commit and push:**
   ```
   Commit this new feature and push to railway-testing
   ```

5. **Railway deploys automatically**

6. **Test on Railway:**
   ```
   curl https://forecastin-api-production-abc123.up.railway.app/api/entities/search?q=test
   ```

7. **Update frontend to use new endpoint:**
   ```
   Update the frontend search component to use this new API endpoint
   ```

8. **Push frontend changes:**
   ```
   Commit and push the frontend changes
   ```

9. **Test end-to-end on Railway deployment**

### Example 3: Environment Variable Change

**Scenario**: Need to update CORS settings

1. **In Railway Dashboard:**
   - Go to API service → **"Variables"**
   - Update `ALLOWED_ORIGINS` to include a new domain
   - Click **"Deploy"** to restart with new variables

2. **Test in Claude Code Web:**
   ```
   Test the CORS headers from the new domain to verify they work
   ```

3. **No code changes needed** - just environment config

---

## Troubleshooting

### Issue: Railway Build Fails

**Symptoms**: Deployment shows "Build failed" in Railway dashboard

**Solutions:**

1. **Check build logs:**
   - Click on failed deployment
   - View **Build Logs**
   - Look for error messages

2. **Common causes:**
   ```
   Error: Cannot find Dockerfile
   → Solution: Verify "Root Directory" is set correctly (api or frontend)

   Error: pip install fails
   → Solution: Ensure using Dockerfile.railway (not Dockerfile.full)

   Error: npm install fails
   → Solution: Check package.json is valid and in frontend directory
   ```

3. **Test build locally with Claude:**
   ```
   Build the Docker image locally to test:
   docker build -f api/Dockerfile.railway -t test-api ./api
   ```

### Issue: Claude Code Can't Push to GitHub

**Symptoms**: `git push` fails with authentication error

**Solutions:**

1. **Check GitHub authentication:**
   - Claude Code needs GitHub OAuth access
   - Re-authenticate: Settings → GitHub → Reconnect

2. **Check branch protection:**
   - Verify branch is not protected
   - Use a different branch for testing

3. **Manual push if needed:**
   ```bash
   git push -u origin railway-testing --force
   ```

### Issue: Railway Not Auto-Deploying

**Symptoms**: Pushed to GitHub but no Railway deployment

**Solutions:**

1. **Check watch paths:**
   - Railway → Service → Settings → Deployment
   - Verify "Watch Paths" includes your changed files
   - Example: `api/**` for backend changes

2. **Check branch:**
   - Verify you pushed to the correct branch
   - Railway → Service → Settings → Source
   - Should match your branch (e.g., `railway-testing`)

3. **Manual deploy:**
   - Railway dashboard → Service
   - Click **"Deploy"** → **"Trigger Deploy"**

### Issue: Frontend Can't Connect to API

**Symptoms**: Frontend loads but shows "Cannot connect to API"

**Solutions:**

1. **Check environment variables:**
   ```
   Frontend service → Variables
   REACT_APP_API_URL=https://correct-api-domain.railway.app ✅
   ```

2. **Check CORS settings:**
   ```
   API service → Variables
   ALLOWED_ORIGINS=https://frontend-domain.railway.app ✅
   ```

3. **Test API directly:**
   ```bash
   curl https://api-domain.railway.app/health
   ```

4. **Check browser console:**
   - Open DevTools → Console
   - Look for CORS or network errors
   - Verify WebSocket connection

### Issue: Database Connection Fails

**Symptoms**: API logs show "could not connect to server"

**Solutions:**

1. **Verify DATABASE_URL:**
   ```
   API service → Variables
   DATABASE_URL=${{Postgres.DATABASE_URL}} ✅
   ```

2. **Check PostgreSQL service is running:**
   - Railway dashboard → PostgreSQL service
   - Should show "Active" status

3. **Verify extensions are installed:**
   ```sql
   -- In Railway PostgreSQL console
   \dx
   -- Should show postgis and ltree
   ```

4. **Check service dependencies:**
   - Railway → API service → Settings
   - Ensure it depends on PostgreSQL service

---

## Quick Reference Commands

### Claude Code Web Commands

```
# Ask Claude to make changes
"Add a new endpoint for user authentication"

# Commit and push
"Commit these changes with message 'Add auth endpoint' and push to railway-testing"

# Test deployment
"Test the /health endpoint on Railway"

# Check logs
"Check the Railway deployment logs for any errors"

# Run tests
"Run the test suite to verify everything works"

# Build locally
"Build the Docker image locally to test"

# Deploy
Railway auto-deploys on push - no manual command needed!
```

### Railway CLI Commands (Optional)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Open service in browser
railway open

# Run command in Railway environment
railway run <command>

# Example: Run migrations
railway run python -m alembic upgrade head
```

### GitHub Commands (in Claude or terminal)

```bash
# Create new branch
git checkout -b feature-name

# Commit changes
git add .
git commit -m "Description of changes"

# Push to GitHub (triggers Railway deployment)
git push origin railway-testing

# Check status
git status

# View recent commits
git log --oneline -5
```

---

## Testing Checklist

Use this checklist when testing your Railway deployment:

### Backend API
- [ ] Health endpoint returns 200: `curl https://api-domain.railway.app/health`
- [ ] Database connected: Check health response includes `"database": "connected"`
- [ ] Redis connected: Check health response includes `"redis": "connected"`
- [ ] API docs accessible: Visit `https://api-domain.railway.app/docs`
- [ ] WebSocket connects: `wscat -c wss://api-domain.railway.app/ws/health`
- [ ] CORS allows frontend: Check browser console for CORS errors

### Frontend
- [ ] Frontend loads: Visit `https://frontend-domain.railway.app`
- [ ] No console errors: Check browser DevTools → Console
- [ ] API connection works: Verify data loads from API
- [ ] WebSocket connects: Check Network tab for WS connection
- [ ] No mixed content warnings: All requests use HTTPS

### Deployment Pipeline
- [ ] Push to GitHub triggers build: Check Railway dashboard
- [ ] Build completes successfully: < 5 minutes for Dockerfile.railway
- [ ] Deploy succeeds: Service shows "Active" status
- [ ] Health checks pass: Railway monitors health endpoint
- [ ] Logs are clean: No errors in deployment logs

---

## Best Practices

### 1. Use Feature Branches

```bash
# Create feature branch for each change
git checkout -b feature/add-search
# Make changes
git push origin feature/add-search
```

### 2. Test Locally First (Optional)

```bash
# Run locally with Docker Compose
docker-compose up
# Test at http://localhost:3000
# Then push to Railway when ready
```

### 3. Use Environment Variables

**Never hardcode:**
- Database URLs
- API keys
- CORS origins
- Domain names

**Always use Railway variables:**
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
API_URL=${{ApiService.URL}}
```

### 4. Monitor Deployments

- Watch build logs for errors
- Check deployment time (should be < 5 min)
- Test immediately after deployment
- Keep an eye on Railway metrics (CPU, Memory)

### 5. Rollback if Needed

If a deployment breaks something:

1. **Quick fix:** Revert in Railway
   - Railway → Deployments → Previous deployment → **"Rollback"**

2. **Permanent fix:** Revert commit
   ```bash
   git revert HEAD
   git push origin railway-testing
   ```

---

## Cost Management

Railway uses usage-based pricing. Tips to optimize:

### Development/Testing
- Use Railway's **$5 free credit** to start
- **Sleep on idle**: Enable for development environments
- **Limit resources**: Set resource limits in Railway settings
- **Monitor usage**: Check Railway dashboard regularly

### Typical Costs for Testing

```
PostgreSQL Starter:     ~$5/month
Redis Starter:          ~$5/month
API Service:            ~$5-10/month (low traffic)
Frontend Service:       ~$5/month (static)
─────────────────────────────────────
Total:                  ~$20-25/month
```

**Pro tip**: Delete test deployments when not in use to save credits.

---

## Next Steps

After completing this setup:

1. ✅ **Test the workflow** - Make a small change, push, and verify deployment
2. ✅ **Set up monitoring** - Configure Railway alerts for downtime
3. ✅ **Add custom domains** - Connect your own domain (optional)
4. ✅ **Enable backups** - Configure PostgreSQL backups
5. ✅ **Document your setup** - Share with your team
6. ✅ **Create a staging environment** - Duplicate setup for staging branch

---

## Additional Resources

- **Railway Documentation**: https://docs.railway.app
- **Claude Code Documentation**: https://claude.ai/code/docs
- **GitHub Actions**: For additional CI/CD (see `docs/GITHUB_ACTIONS_GUIDE.md`)
- **Forecastin Setup**: See `docs/RAILWAY_SETUP_GUIDE.md` for detailed Railway config

---

## Summary

You now have a complete workflow:

1. **Make changes** in Claude Code Web (AI-assisted development)
2. **Push to GitHub** with simple commands
3. **Auto-deploy to Railway** (3-5 minute builds)
4. **Test live** on your Railway deployment
5. **Iterate quickly** with Claude's help

This setup enables:
- ⚡ **Fast iteration** - Push and deploy in minutes
- 🤖 **AI assistance** - Claude helps with code, testing, and debugging
- 🚀 **Production-ready** - Railway provides enterprise infrastructure
- 🔄 **Automatic deploys** - No manual deployment steps
- 📊 **Full visibility** - Logs, metrics, and monitoring built-in

**Happy building!** 🎉
