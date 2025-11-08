# Railway Setup - Next Steps

## ✅ What's Been Done

1. ✅ Railway credentials received for `meticulous-unity` project
2. ✅ Created setup scripts and documentation
3. ✅ Added sensitive files to `.gitignore`

## 🎯 What You Need to Do Now

### Step 1: Enable PostgreSQL Extensions (REQUIRED)

Your Forecastin app needs two PostgreSQL extensions enabled. Choose ONE method:

#### Method A: Railway Dashboard (Easiest - 2 minutes)

1. Go to https://railway.app
2. Open project "meticulous-unity"
3. Click on **PostgreSQL** service
4. Click **"Data"** tab
5. Click **"Query"** button
6. Paste this SQL and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS ltree;
   \dx
   ```
7. Verify you see both `postgis` and `ltree` in the extensions list

#### Method B: Using Python Script (From Railway Shell)

1. In Railway Dashboard → PostgreSQL service → Settings
2. Enable shell access if available
3. Run:
   ```bash
   python scripts/railway-enable-extensions.py
   ```

#### Method C: Manual SQL (If you have psql installed locally with external access)

```bash
psql "postgresql://postgres:VKusmUGwgttBbItCsbeearDdCKfcwqci@postgres.railway.internal:5432/railway" \
  -c "CREATE EXTENSION IF NOT EXISTS postgis;" \
  -c "CREATE EXTENSION IF NOT EXISTS ltree;"
```

**NOTE**: This only works if run from within Railway's network.

---

### Step 2: Create API Service in Railway

1. Go to Railway Dashboard → meticulous-unity
2. Click **"+ New"** → **"GitHub Repo"**
3. Select repository: `glockpete/Forecastin`
4. Railway creates a new service

**Configure Build Settings:**

| Setting | Value |
|---------|-------|
| Service Name | `forecastin-api` (or any name you prefer) |
| Root Directory | `api` |
| Dockerfile Path | `Dockerfile.railway` |
| Branch | `claude/railway-connection-setup-011CUvNnS2FGYCk74dT3dsGm` |
| Port | `9000` |

**Add Environment Variables** (Variables tab):

```bash
# Database and Cache (Railway auto-references)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# API Configuration
API_PORT=9000
ENVIRONMENT=production

# WebSocket Configuration
WS_PING_INTERVAL=30
WS_PING_TIMEOUT=10

# CORS (update after frontend deployed)
ALLOWED_ORIGINS=http://localhost:3000

# Public URLs (update after deployment - see Step 3)
PUBLIC_BASE_URL=https://TEMP_PLACEHOLDER.railway.app
WS_PUBLIC_URL=wss://TEMP_PLACEHOLDER.railway.app/ws
```

**Save and Deploy** - This will trigger the first build (~3-5 minutes)

---

### Step 3: Get Your API URL

After the API deployment completes:

1. Go to API service → **Settings** → **Domains**
2. Railway auto-generates a domain like:
   ```
   forecastin-api-production-abc123.up.railway.app
   ```
3. **COPY THIS URL** - you'll need it!

**Update API Environment Variables:**

Go back to Variables tab and update:
```bash
PUBLIC_BASE_URL=https://your-actual-api-domain.up.railway.app
WS_PUBLIC_URL=wss://your-actual-api-domain.up.railway.app/ws
```

Save changes - Railway will redeploy automatically.

---

### Step 4: Test Your API

**Test Health Endpoint:**

```bash
curl https://your-api-domain.up.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": 1699123456.789,
  "services": {
    "database": "connected",
    "cache": "connected"
  }
}
```

**Test API Documentation:**

Visit in browser: `https://your-api-domain.up.railway.app/docs`

You should see the FastAPI Swagger UI interface.

**Check Deployment Logs:**

1. Railway Dashboard → API Service → **Deployments**
2. Click latest deployment
3. Check **Build Logs** and **Deploy Logs** for errors

---

### Step 5: Create Frontend Service in Railway

1. Go to Railway Dashboard → meticulous-unity
2. Click **"+ New"** → **"GitHub Repo"**
3. Select repository: `glockpete/Forecastin` (same repo)
4. Railway creates another service

**Configure Build Settings:**

| Setting | Value |
|---------|-------|
| Service Name | `forecastin-frontend` |
| Root Directory | `frontend` |
| Build Command | `npm install && npm run build` |
| Branch | `claude/railway-connection-setup-011CUvNnS2FGYCk74dT3dsGm` |
| Port | `80` |

**Add Environment Variables** (Variables tab):

**IMPORTANT**: Replace `YOUR_ACTUAL_API_DOMAIN` with the domain from Step 3!

```bash
# API Connection (from Step 3)
REACT_APP_API_URL=https://YOUR_ACTUAL_API_DOMAIN.railway.app
REACT_APP_WS_URL=wss://YOUR_ACTUAL_API_DOMAIN.railway.app/ws

# Build Configuration
NODE_ENV=production
```

**Save and Deploy**

---

### Step 6: Get Your Frontend URL

After frontend deployment completes:

1. Go to Frontend service → **Settings** → **Domains**
2. Railway auto-generates a domain like:
   ```
   forecastin-frontend-xyz789.up.railway.app
   ```
3. **COPY THIS URL**

---

### Step 7: Update API CORS Settings

Now that you have your frontend URL, update the API to allow connections:

1. Go to **API Service** → **Variables**
2. Update `ALLOWED_ORIGINS`:
   ```bash
   ALLOWED_ORIGINS=https://your-actual-frontend-domain.up.railway.app,http://localhost:3000
   ```
3. Save - Railway will redeploy the API

---

### Step 8: Test End-to-End

**Test Frontend:**

Visit: `https://your-frontend-domain.up.railway.app`

**Check Browser Console:**
- Open DevTools (F12)
- Go to Console tab
- Verify no CORS errors
- Check Network tab for WebSocket connection

**Test Full Functionality:**
- Application should load without errors
- API calls should work
- WebSocket should connect and stay connected

---

## 🚨 Troubleshooting

### API Build Fails

**Check Build Logs** in Railway Dashboard → API Service → Deployments

**Common Issues:**
- Wrong root directory (should be `api`)
- Wrong Dockerfile path (should be `Dockerfile.railway`)
- Missing dependencies in `requirements.railway.txt`

### Database Connection Errors

**Check:**
- PostgreSQL service is running (green status in Railway)
- `DATABASE_URL` uses correct syntax: `${{Postgres.DATABASE_URL}}`
- Extensions are enabled (PostGIS, LTREE)

**Test Connection:**
In API deployment logs, look for:
```
Database connection established successfully
```

### Frontend Can't Connect to API

**Check:**
- `REACT_APP_API_URL` has correct API domain (from Step 3)
- `ALLOWED_ORIGINS` in API includes frontend domain (from Step 6)
- Both use HTTPS (not HTTP)
- No mixed content warnings in browser console

### CORS Errors

**Browser Console Shows:** `CORS policy blocked`

**Fix:**
1. API Service → Variables → Update `ALLOWED_ORIGINS`
2. Must include exact frontend domain
3. No trailing slashes
4. Format: `https://domain.railway.app`

---

## 📊 Quick Status Check

Use this checklist to track your progress:

- [ ] Step 1: PostgreSQL extensions enabled (PostGIS, LTREE)
- [ ] Step 2: API service created and configured
- [ ] Step 3: API URL obtained and environment variables updated
- [ ] Step 4: API health endpoint tested successfully
- [ ] Step 5: Frontend service created and configured
- [ ] Step 6: Frontend URL obtained
- [ ] Step 7: API CORS settings updated with frontend URL
- [ ] Step 8: End-to-end testing completed

---

## 📁 Important Files Created

- **RAILWAY_CONNECTION_SETUP.md** - Full connection details (⚠️ DO NOT COMMIT)
- **railway-setup.sh** - Bash script to enable extensions
- **scripts/railway-enable-extensions.py** - Python script to enable extensions
- **RAILWAY_NEXT_STEPS.md** - This file (step-by-step guide)

---

## 🔗 Useful Links

- **Railway Dashboard**: https://railway.app
- **Project**: meticulous-unity
- **Detailed Setup Guide**: `docs/RAILWAY_SETUP_GUIDE.md`
- **GitHub Integration Guide**: `docs/RAILWAY_GITHUB_CLAUDE_SETUP.md`
- **API Documentation** (after deployment): `https://your-api-domain.railway.app/docs`

---

## ❓ Need Help?

If you encounter issues:

1. **Check Railway Logs**: Dashboard → Service → Deployments → Latest → Logs
2. **Review Setup Guides**: See `docs/` folder
3. **Verify Environment Variables**: Dashboard → Service → Variables
4. **Test Individually**: Test API health endpoint first, then frontend

---

## ✅ Success Criteria

You'll know everything is working when:

1. ✅ API health endpoint returns `"status": "healthy"`
2. ✅ API docs page loads at `/docs`
3. ✅ Frontend loads without errors
4. ✅ Browser console shows no CORS errors
5. ✅ WebSocket connection established
6. ✅ Data loads from API in frontend

---

**Good luck with your deployment!** 🚀

If you need to commit these changes to git, remember to commit everything EXCEPT `RAILWAY_CONNECTION_SETUP.md` (it's in `.gitignore`).
