# Claude Chrome Browser Tool - Railway Setup Prompt

This guide provides ready-to-use prompts for setting up Railway deployment using Claude's Chrome browser tool.

---

## 🎯 Complete Railway Setup Prompt

Copy and paste this into Claude Code (with Chrome browser tool enabled):

```
I need help completing my Railway deployment setup for the Forecastin application.

**Context:**
- I have a monorepo with API (FastAPI/Python) in /api and Frontend (React/TypeScript) in /frontend
- I already have railway.json config files in both directories
- I've read the setup guide at docs/RAILWAY_SETUP_GUIDE.md
- I'm ready to deploy but need help with the Railway UI configuration

**What I need you to do:**

1. Navigate to https://railway.app and help me verify my account setup

2. Guide me through creating/configuring these services in order:

   a) **PostgreSQL Database**
      - Create PostgreSQL service
      - Enable PostGIS extension
      - Enable LTREE extension
      - Note the DATABASE_URL variable

   b) **Redis Cache**
      - Create Redis service
      - Note the REDIS_URL variable

   c) **Backend API Service**
      - Deploy from GitHub repository: glockpete/Forecastin
      - Branch: claude/chrome-tool-setup-011CUvPn3LsKmJouAEj2N9fm
      - Root Directory: api
      - Config file: railway.json (already exists)
      - Environment variables needed:
        * DATABASE_URL=${{Postgres.DATABASE_URL}}
        * REDIS_URL=${{Redis.REDIS_URL}}
        * API_PORT=9000
        * ENVIRONMENT=production
        * WS_PING_INTERVAL=30
        * WS_PING_TIMEOUT=10
        * ALLOWED_ORIGINS=http://localhost:3000
      - Port: 9000
      - Get the deployed URL for next step

   d) **Frontend Service**
      - Deploy from same GitHub repository
      - Branch: claude/chrome-tool-setup-011CUvPn3LsKmJouAEj2N9fm
      - Root Directory: frontend
      - Config file: railway.json (already exists)
      - Environment variables (use API URL from previous step):
        * REACT_APP_API_URL=https://[API_DOMAIN].railway.app
        * REACT_APP_WS_URL=wss://[API_DOMAIN].railway.app/ws
        * NODE_ENV=production
      - Port: 80
      - Get the deployed frontend URL

   e) **Update API CORS Settings**
      - Update API service ALLOWED_ORIGINS to include frontend URL
      - Redeploy API service

3. Test the deployment:
   - Test API health: GET https://[API_DOMAIN].railway.app/health
   - Test frontend: Visit https://[FRONTEND_DOMAIN].railway.app
   - Verify WebSocket connection works

4. Provide me with:
   - Summary of all deployed service URLs
   - Any errors encountered and how to fix them
   - Next steps for ongoing deployment/testing

**Important notes:**
- The railway.json files already exist in api/ and frontend/ directories
- Use Dockerfile.railway for API builds (already configured in railway.json)
- Use Dockerfile for frontend builds (already configured in railway.json)
- Watch patterns are configured to avoid unnecessary rebuilds

Please proceed step by step and let me know what information you need from me.
```

---

## 🔍 Troubleshooting Specific Issues

### Prompt: Fix Build Failures

```
My Railway API build is failing. Can you:

1. Navigate to my Railway project at https://railway.app
2. Check the latest build logs for the API service
3. Identify the specific error
4. Check if it's related to:
   - Prophet dependency (should use Dockerfile.railway, not Dockerfile.full)
   - Missing system dependencies
   - Timeout issues
   - Wrong Dockerfile path
5. Provide specific fixes based on the error

My project structure:
- Repository: glockpete/Forecastin
- Branch: claude/chrome-tool-setup-011CUvPn3LsKmJouAEj2N9fm
- Config file: api/railway.json
- Dockerfile: api/Dockerfile.railway

Reference documentation at docs/RAILWAY_BUILD_FIX.md if needed.
```

### Prompt: Fix Environment Variables

```
Help me verify and fix Railway environment variables:

1. Navigate to my Railway API service
2. Check current environment variables against this required list:
   - DATABASE_URL=${{Postgres.DATABASE_URL}}
   - REDIS_URL=${{Redis.REDIS_URL}}
   - API_PORT=9000
   - ENVIRONMENT=production
   - WS_PING_INTERVAL=30
   - WS_PING_TIMEOUT=10
   - ALLOWED_ORIGINS=[needs to include frontend URL]

3. Navigate to my Railway Frontend service
4. Check frontend environment variables:
   - REACT_APP_API_URL=https://[correct API domain]
   - REACT_APP_WS_URL=wss://[correct API domain]/ws
   - NODE_ENV=production

5. Report any misconfigurations and provide correct values
6. Help me update any incorrect variables

Reference: docs/RAILWAY_SETUP_GUIDE.md section on environment variables
```

### Prompt: Fix CORS Issues

```
The frontend can't connect to the API due to CORS errors. Help me fix it:

1. Get the current frontend Railway URL
2. Navigate to the API service environment variables
3. Check the ALLOWED_ORIGINS variable
4. Update it to include:
   - The frontend Railway URL (https://[frontend].railway.app)
   - Keep http://localhost:3000 for local development
   - Format: https://frontend-url.railway.app,http://localhost:3000
5. Trigger a redeploy of the API service
6. Test the CORS headers with curl or browser DevTools

The error in browser console is: [paste your CORS error here]
```

### Prompt: Fix WebSocket Issues

```
WebSocket connections are failing with 1006 errors. Help diagnose:

1. Check API service environment variables:
   - WS_PING_INTERVAL should be 30
   - WS_PING_TIMEOUT should be 10
2. Verify the frontend is using wss:// (not ws://) for HTTPS
3. Check frontend environment variable REACT_APP_WS_URL
4. Test WebSocket connection:
   - Use wscat or browser to connect to wss://[API_DOMAIN]/ws/echo
   - Send test message
   - Verify ping/pong heartbeats
5. Check API logs for WebSocket-related errors

Reference: docs/RAILWAY_SETUP_GUIDE.md WebSocket configuration section
```

### Prompt: Database Extension Setup

```
Help me set up PostgreSQL extensions for Railway:

1. Navigate to my Railway PostgreSQL service
2. Open the database console/SQL editor
3. Run these commands:
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS ltree;
   \dx
4. Verify both extensions are installed
5. If there are errors, help troubleshoot:
   - Check PostgreSQL version supports PostGIS
   - Verify permissions
   - Try alternative installation methods

The API requires PostGIS for geospatial features and LTREE for hierarchical data.
```

---

## 🚀 Deployment Testing Prompts

### Prompt: Complete Deployment Test

```
Run a complete test of my Railway deployment:

1. **Backend API Tests:**
   - GET https://[API_URL]/health
     Expected: {"status": "healthy", "database": "connected", "redis": "connected"}
   - GET https://[API_URL]/docs
     Expected: FastAPI Swagger UI loads
   - WebSocket test: wscat -c wss://[API_URL]/ws/echo
     Expected: Connection established, echo works

2. **Frontend Tests:**
   - Visit https://[FRONTEND_URL]
     Expected: Application loads without errors
   - Check browser console
     Expected: No CORS errors, no WebSocket errors
   - Check Network tab
     Expected: API calls succeed, WebSocket connected

3. **Integration Tests:**
   - Verify frontend can fetch data from API
   - Verify WebSocket real-time updates work
   - Check for any mixed content warnings (HTTP vs HTTPS)

4. **Provide test results:**
   - List all passing tests ✅
   - List all failing tests ❌
   - Provide specific fixes for failures

My URLs:
- API: [paste your API URL or "not deployed yet"]
- Frontend: [paste your frontend URL or "not deployed yet"]
```

### Prompt: Monitor Deployment

```
Help me monitor my Railway deployment:

1. Navigate to Railway project dashboard
2. Check each service:
   - PostgreSQL: Status, CPU, Memory usage
   - Redis: Status, CPU, Memory usage
   - API: Status, CPU, Memory, response time
   - Frontend: Status, CPU, Memory
3. Check deployment logs for errors
4. Review recent deployments:
   - Build times
   - Success/failure rate
   - Any patterns in failures
5. Check health check status for API and Frontend
6. Provide recommendations:
   - Any performance issues
   - Cost optimization opportunities
   - Reliability improvements needed

Generate a status report.
```

---

## 📋 Quick Setup Checklist Prompt

```
Walk me through this Railway deployment checklist:

**Pre-deployment:**
- [ ] Repository pushed to GitHub
- [ ] Branch: claude/chrome-tool-setup-011CUvPn3LsKmJouAEj2N9fm exists
- [ ] railway.json files exist in api/ and frontend/
- [ ] Dockerfiles exist and are correct

**Railway Services:**
- [ ] PostgreSQL created with PostGIS and LTREE extensions
- [ ] Redis created and running
- [ ] API service deployed from GitHub
- [ ] Frontend service deployed from GitHub

**Configuration:**
- [ ] API environment variables set correctly
- [ ] Frontend environment variables set correctly
- [ ] API root directory set to "api"
- [ ] Frontend root directory set to "frontend"
- [ ] Watch patterns configured (from railway.json)

**Networking:**
- [ ] API port set to 9000
- [ ] Frontend port set to 80
- [ ] API CORS includes frontend URL
- [ ] Health checks configured

**Testing:**
- [ ] API /health endpoint returns 200
- [ ] API /docs loads
- [ ] WebSocket connection works
- [ ] Frontend loads without errors
- [ ] Frontend can connect to API
- [ ] No CORS errors in console

Help me verify each item and fix any that are incomplete.
```

---

## 🔧 Configuration Update Prompts

### Prompt: Update Railway Config Files

```
I need to update my Railway configuration:

Current situation: [describe what needs to change]

Please help me:
1. Review current api/railway.json and frontend/railway.json
2. Update the config files with these changes:
   [describe specific changes needed]
3. Commit the changes with an appropriate message
4. Push to branch: claude/chrome-tool-setup-011CUvPn3LsKmJouAEj2N9fm
5. Monitor Railway for automatic redeployment
6. Verify the changes took effect

Reference: docs/RAILWAY_CONFIG_FILES.md for configuration options
```

### Prompt: Switch Dockerfile

```
I need to switch the API from Dockerfile.railway to Dockerfile.full (or vice versa):

Current: [Dockerfile.railway or Dockerfile.full]
Target: [Dockerfile.railway or Dockerfile.full]

Please:
1. Update api/railway.json to use the new Dockerfile
2. Explain the differences:
   - Build time impact
   - Features included/excluded
   - Resource requirements
3. Commit and push the change
4. Monitor the new build
5. Report build time and success/failure

Context:
- Dockerfile.railway: 3-5 min build, no Prophet ML features
- Dockerfile.full: 10-15 min build, includes Prophet
```

---

## 🎓 Learning Prompts

### Prompt: Explain Current Setup

```
Help me understand my current Railway deployment:

1. Navigate to my Railway project
2. Document the current architecture:
   - List all services and their purpose
   - Show service dependencies (what depends on what)
   - Explain the deployment flow (GitHub → Railway)
3. Explain the railway.json configurations:
   - What does each setting do?
   - Why are watch patterns important?
   - How do health checks work?
4. Show me the environment variable flow:
   - How PostgreSQL URL gets to the API
   - How API URL gets to the Frontend
5. Create a visual diagram of the architecture

This will help me understand what's deployed and how it works.
```

### Prompt: Cost Analysis

```
Analyze my Railway deployment costs:

1. Navigate to Railway billing/usage dashboard
2. Review current resource usage:
   - Build minutes used
   - Compute hours per service
   - Database storage and queries
   - Network egress
3. Estimate monthly costs based on current usage
4. Provide optimization recommendations:
   - Watch patterns to reduce unnecessary builds
   - Resource limits to control costs
   - Idle shutdown strategies for dev environment
5. Compare costs to alternatives (if asked)

Help me understand and optimize my Railway spending.
```

---

## 💡 Best Practices

When using these prompts with Claude Chrome browser tool:

1. **Be Specific**: Include your actual URLs, branch names, and error messages
2. **Provide Context**: Reference the relevant documentation files
3. **One Step at a Time**: For complex setups, break into smaller prompts
4. **Verify**: Ask Claude to verify each step before proceeding
5. **Test**: Always ask for testing after changes
6. **Document**: Ask Claude to document what was changed and why

---

## 📚 Related Documentation

- **[Railway Setup Guide](./RAILWAY_SETUP_GUIDE.md)** - Complete manual setup
- **[Railway Config Files](./RAILWAY_CONFIG_FILES.md)** - Configuration reference
- **[Railway + GitHub + Claude](./RAILWAY_GITHUB_CLAUDE_SETUP.md)** - Full workflow
- **[Railway Build Fix](../api/RAILWAY_BUILD_FIX.md)** - Build troubleshooting

---

## 🚨 Emergency Rollback Prompt

```
Something broke in production! Help me rollback:

**What broke:** [describe the issue]

**What I need:**
1. Navigate to Railway → [Service Name] → Deployments
2. Find the last working deployment (before the issue)
3. Click "Rollback to this deployment"
4. Monitor the rollback progress
5. Verify the service is healthy again
6. Help me investigate what went wrong:
   - Compare the broken deployment with working one
   - Review what changed (code, config, env vars)
   - Suggest how to fix the issue properly
7. Create a plan to fix and redeploy safely

**Critical**: Rollback first, investigate second!
```

---

**Happy deploying! 🚀**

Save these prompts for quick access when working with Railway and Claude Chrome browser tool.
