# Railway Build Failure Fix Guide

## Problem

Railway build fails during `pip install -r requirements.txt` with dependency compilation errors. The root cause is **Prophet (1.1.5)** which requires extensive C++ build tools and Stan libraries that take 10-15 minutes to compile.

---

## Three Solutions

### ✅ **Solution 1: Use Railway-Optimized Build (RECOMMENDED)**

This is the fastest way to get Forecastin running on Railway for testing.

#### What it does:
- Uses `requirements.railway.txt` (lightweight, no Prophet/ML packages)
- Builds in ~3-5 minutes
- Includes all core functionality: API, WebSocket, Database, Cache, Geospatial

#### What's excluded:
- `prophet` - Hierarchical forecasting (Phase 6 feature)
- `pandas` / `numpy` / `pyarrow` - Heavy data science packages
- ML model training capabilities

#### How to use:

**In Railway Dashboard:**

1. Go to your API service
2. **Settings** → **Build Configuration**
3. Set **Dockerfile Path**: `Dockerfile.railway`
4. **Redeploy** the service

**Result**: Build will succeed in 3-5 minutes. ✅

---

### 🔧 **Solution 2: Full Build with All Dependencies**

Use this when you need Prophet and ML forecasting features.

#### What it does:
- Uses `Dockerfile.full` with all build dependencies
- Includes Prophet, pandas, numpy, pyarrow
- Build time: ~10-15 minutes (Prophet compilation)

#### How to use:

**In Railway Dashboard:**

1. Go to your API service
2. **Settings** → **Build Configuration**
3. Set **Dockerfile Path**: `Dockerfile.full`
4. **Increase Build Timeout**: Settings → Advanced → Build timeout: `20 minutes`
5. **Redeploy** the service

**Result**: Full functionality with longer build time.

---

### 🛠️ **Solution 3: Fix Original Dockerfile**

Update the existing `Dockerfile` to support all dependencies.

#### Changes needed:

In `api/Dockerfile`, replace the builder stage system dependencies section:

```dockerfile
# Install system dependencies needed for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    gfortran \
    cmake \
    libpq-dev \
    libgeos-dev \
    libproj-dev \
    libblas-dev \
    liblapack-dev \
    libopenblas-dev \
    python3-dev \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
```

And update runtime stage dependencies:

```dockerfile
# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgeos-c1v5 \
    libproj25 \
    libgomp1 \
    libopenblas0 \
    libgfortran5 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && groupadd -r forecastin && useradd -r -g forecastin forecastin
```

---

## Comparison Table

| Solution | Build Time | Includes Prophet | Includes ML | Complexity |
|----------|-----------|------------------|-------------|------------|
| **Solution 1** (Railway-optimized) | 3-5 min | ❌ | ❌ | ✅ Simple |
| **Solution 2** (Full Dockerfile) | 10-15 min | ✅ | ✅ | ⚠️ Medium |
| **Solution 3** (Fix original) | 10-15 min | ✅ | ✅ | ⚠️ Medium |

---

## Recommendation by Use Case

### For Testing / MVP / Demo
→ **Use Solution 1** (Railway-optimized)
- Fastest deployment
- All core features work
- Prophet is a Phase 6 feature (not needed immediately)

### For Production with Forecasting
→ **Use Solution 2** (Full Dockerfile)
- Pre-configured and tested
- All dependencies included
- Just needs longer build timeout

### For Custom Configuration
→ **Use Solution 3** (Fix original)
- Modify existing Dockerfile
- Maintain single Dockerfile
- Requires manual updates

---

## Step-by-Step: Deploy Solution 1 on Railway

1. **Commit the new files** (already in your repo):
   ```bash
   git add api/requirements.railway.txt api/Dockerfile.railway
   git commit -m "Add Railway-optimized build configuration"
   git push
   ```

2. **Configure Railway**:
   - Go to Railway dashboard
   - Select your API service
   - Go to **Settings** → **Build**
   - Set **Dockerfile Path**: `Dockerfile.railway`
   - Click **Save**

3. **Redeploy**:
   - Go to **Deployments** tab
   - Click **Deploy** button
   - Or push a new commit to trigger auto-deploy

4. **Monitor Build**:
   - Watch build logs in Railway dashboard
   - Should complete in 3-5 minutes
   - Look for: "Successfully built" message

5. **Verify**:
   ```bash
   curl https://your-api.railway.app/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "redis": "connected"
   }
   ```

---

## What Breaks Without Prophet?

Prophet is only used for **hierarchical forecasting** (Phase 6 feature). Removing it does NOT affect:

✅ Core API functionality
✅ Database operations (LTREE, PostGIS)
✅ Redis caching
✅ WebSocket real-time updates
✅ RSS ingestion
✅ Entity extraction
✅ Geospatial layers
✅ Feature flags
✅ Authentication
✅ Frontend functionality

❌ Only affects: ML-based forecasting models (Phase 6)

---

## When to Add Prophet Back

You can add Prophet later when you need forecasting:

1. Switch to `Dockerfile.full`:
   ```bash
   # In Railway dashboard
   Settings → Build → Dockerfile Path: Dockerfile.full
   ```

2. Or install Prophet at runtime:
   ```bash
   # This will take 10-15 minutes
   railway run pip install prophet pandas numpy pyarrow
   ```

3. Or use a separate forecasting service:
   ```
   API Service (fast build, no Prophet)
   ↓
   Forecasting Service (full build, with Prophet)
   ```

---

## Troubleshooting

### Build still fails with Dockerfile.railway

**Check:**
1. Verify `requirements.railway.txt` exists in `api/` folder
2. Check Dockerfile path in Railway: `Dockerfile.railway` (no `api/` prefix needed)
3. Look at build logs for specific error

### Build timeout with Dockerfile.full

**Solution:**
1. Railway Settings → Advanced
2. Increase **Build Timeout** to 20 minutes
3. Ensure Railway plan supports longer builds

### Missing functionality after deployment

**Check:**
1. All environment variables are set (DATABASE_URL, REDIS_URL, etc.)
2. Database extensions enabled (PostGIS, LTREE)
3. Health endpoint returns "connected" for DB and Redis

---

## Files Created

```
api/
├── requirements.txt             # Original (with Prophet)
├── requirements.railway.txt     # NEW: Lightweight for Railway ✅
├── Dockerfile                   # Original
├── Dockerfile.railway          # NEW: Railway-optimized ✅
├── Dockerfile.full             # NEW: Full with all deps ✅
└── RAILWAY_BUILD_FIX.md        # This file ✅
```

---

## Need Help?

- Check Railway build logs for specific errors
- Test locally with Docker:
  ```bash
  cd api
  docker build -f Dockerfile.railway -t forecastin-api .
  docker run -p 9000:9000 forecastin-api
  ```
- Open issue on GitHub with build logs

---

## Summary

**Quick Fix**: Use `Dockerfile.railway` → Deploy in 3-5 minutes ✅

**Full Build**: Use `Dockerfile.full` → All features, 10-15 min build

**Most apps don't need Prophet immediately** - start with Solution 1 and add it later if needed.
