# Digital Ocean Quick Start Guide

Get your Forecastin app deployed to Digital Ocean in 5 minutes!

## 🚀 Fastest Path to Deployment

### Option 1: One-Click Deploy (Web Console)

1. **Go to Digital Ocean**
   - Visit https://cloud.digitalocean.com/apps
   - Click **"Create App"**

2. **Import App Spec**
   - Choose **"Import from Spec"**
   - Upload `.do/app.yaml` from this repository
   - Click **"Next"**

3. **Connect GitHub**
   - Link your GitHub account
   - Grant access to your `glockpete/Forecastin` repository
   - Click **"Next"**

4. **Review & Deploy**
   - Review the configuration (2 services + 2 databases)
   - Estimated cost: ~$24/month (dev tier)
   - Click **"Create Resources"**

5. **Wait for Deployment** (5-10 minutes)
   - Digital Ocean will:
     - Create PostgreSQL database
     - Create Redis cache
     - Build and deploy API
     - Build and deploy Frontend
     - Connect everything together

6. **Access Your App**
   - Once deployed, you'll get URLs like:
     - Frontend: `https://forecastin-xxxxx.ondigitalocean.app`
     - API: `https://forecastin-api-xxxxx.ondigitalocean.app`

### Option 2: Command Line Deploy

```bash
# 1. Install Digital Ocean CLI
brew install doctl  # macOS
# or download from https://github.com/digitalocean/doctl/releases

# 2. Authenticate
doctl auth init
# Get API token from: https://cloud.digitalocean.com/account/api/tokens

# 3. Deploy
cd /path/to/Forecastin
doctl apps create --spec .do/app.yaml

# 4. Monitor deployment
doctl apps list  # Get your app ID
doctl apps logs YOUR_APP_ID --follow
```

## 📝 Before You Deploy

### 1. Update App Spec

Edit `.do/app.yaml` and update:

```yaml
github:
  repo: YOUR_GITHUB_USERNAME/Forecastin  # Change this
  branch: main                            # Or your branch
```

### 2. Verify GitHub Access

Make sure Digital Ocean can access your repository:
- Repository must be public, OR
- You've granted Digital Ocean GitHub app access

## ✅ Post-Deployment Steps

### 1. Enable PostGIS Extension

Your app needs PostGIS for geospatial features:

```bash
# Get database connection string
doctl databases list
doctl databases connection YOUR_DB_ID

# Connect with psql
psql "postgres://username:password@host:port/database?sslmode=require"

# Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS ltree;
```

### 2. Verify Deployment

```bash
# Check API health
curl https://your-api-url.ondigitalocean.app/health

# Check frontend
curl https://your-frontend-url.ondigitalocean.app/
```

### 3. Set Up Custom Domain (Optional)

In Digital Ocean console:
- Go to: Apps → Your App → Settings → Domains
- Add your custom domain
- Update DNS records as instructed

## 🔧 Common Issues & Fixes

### Issue: "No supported files found"

**Cause**: Digital Ocean can't find package.json/Dockerfile in root

**Fix**: Use the App Spec file (app.yaml) which specifies Dockerfile paths

### Issue: Build fails

**Cause**: Missing dependencies or incorrect paths

**Fix**:
```bash
# Check build logs
doctl apps logs YOUR_APP_ID --type BUILD

# Common fixes:
# - Ensure Dockerfiles exist at specified paths
# - Verify all COPY commands in Dockerfile reference valid files
# - Check requirements.txt / package.json are present
```

### Issue: Health checks failing

**Cause**: App not responding on expected port

**Fix**:
```yaml
# In app.yaml, verify:
http_port: 9000  # For API
http_port: 80    # For frontend

# API must listen on 0.0.0.0:9000
# Frontend nginx must serve on port 80
```

### Issue: Database connection errors

**Cause**: Database not connected or extensions missing

**Fix**:
1. Verify database is attached in Digital Ocean console
2. Check environment variables are set: `${db.DATABASE_URL}`
3. Enable required extensions (PostGIS, ltree)

### Issue: Frontend can't reach API

**Cause**: CORS or incorrect API URL

**Fix**:
1. Verify `REACT_APP_API_URL` is set to API's public URL
2. Check CORS configuration in FastAPI app
3. Ensure both services are deployed

## 💰 Pricing Estimate

### Development Configuration
- **API Service**: Basic XS - $5/month
- **Frontend Service**: Basic XS - $5/month
- **PostgreSQL**: Development - $7/month
- **Redis**: Development - $7/month
- **Total**: ~$24/month

### Production Configuration
- **API Service**: Basic S - $12/month
- **Frontend Service**: Basic S - $12/month
- **PostgreSQL**: Basic (1GB RAM) - $15/month
- **Redis**: Basic (1GB RAM) - $15/month
- **Total**: ~$54/month

## 📊 Monitoring Your App

```bash
# View live logs
doctl apps logs YOUR_APP_ID --follow

# Component-specific logs
doctl apps logs YOUR_APP_ID --component api
doctl apps logs YOUR_APP_ID --component frontend

# Check app status
doctl apps get YOUR_APP_ID

# List all deployments
doctl apps list-deployments YOUR_APP_ID
```

## 🔄 Updating Your App

Auto-deploy is enabled by default. Just push to your main branch:

```bash
git add .
git commit -m "Update app"
git push origin main

# Digital Ocean automatically deploys changes
```

Or manually trigger a deployment:

```bash
doctl apps create-deployment YOUR_APP_ID
```

## 📚 Next Steps

- [ ] Set up custom domain
- [ ] Enable production database tier
- [ ] Configure monitoring and alerts
- [ ] Set up automated backups
- [ ] Review security settings
- [ ] Add environment-specific secrets
- [ ] Enable auto-scaling (if needed)

## 🆘 Need Help?

- **Deployment Guide**: See `.do/DEPLOY.md` for detailed instructions
- **Environment Variables**: See `.do/env.production.example`
- **Digital Ocean Docs**: https://docs.digitalocean.com/products/app-platform/
- **Support**: https://cloud.digitalocean.com/support/tickets

---

**That's it!** Your app should be live at `https://your-app.ondigitalocean.app` 🎉
