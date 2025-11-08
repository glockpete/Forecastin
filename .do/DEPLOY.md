# Deploying Forecastin to Digital Ocean App Platform

This guide will walk you through deploying the Forecastin application to Digital Ocean App Platform.

## Overview

Forecastin is deployed as a multi-service application with:
- **Frontend**: React/TypeScript application with deck.gl (served via nginx)
- **API**: FastAPI Python backend
- **Database**: Managed PostgreSQL (with PostGIS)
- **Cache**: Managed Redis

## Prerequisites

1. A Digital Ocean account ([Sign up here](https://www.digitalocean.com/))
2. Your GitHub repository connected to Digital Ocean
3. Basic familiarity with Digital Ocean App Platform

## Deployment Methods

### Method 1: Using the App Spec File (Recommended)

This is the easiest and most automated way to deploy.

#### Step 1: Install doctl (Digital Ocean CLI)

```bash
# macOS
brew install doctl

# Linux
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf ~/doctl-1.98.1-linux-amd64.tar.gz
sudo mv ~/doctl /usr/local/bin

# Windows (use WSL or download from GitHub releases)
```

#### Step 2: Authenticate doctl

```bash
# Create an API token at: https://cloud.digitalocean.com/account/api/tokens
doctl auth init
```

#### Step 3: Update the App Spec

Edit `.do/app.yaml` and replace the GitHub repo reference:

```yaml
github:
  repo: glockpete/Forecastin  # Update with your org/repo
  branch: main                 # Update with your branch
```

#### Step 4: Deploy the App

```bash
# From the project root
doctl apps create --spec .do/app.yaml

# This will output an app ID - save it!
# Example: App created with ID: abc123-def456-ghi789
```

#### Step 5: Monitor Deployment

```bash
# Check app status
doctl apps list

# View deployment logs
doctl apps logs <your-app-id> --type BUILD
doctl apps logs <your-app-id> --type DEPLOY
doctl apps logs <your-app-id> --type RUN

# Get app info
doctl apps get <your-app-id>
```

### Method 2: Using the Digital Ocean Web Console

If you prefer a GUI approach:

#### Step 1: Create a New App

1. Go to [Digital Ocean Apps](https://cloud.digitalocean.com/apps)
2. Click **"Create App"**
3. Select **"Import from Spec"**
4. Upload or paste the contents of `.do/app.yaml`
5. Click **"Next"**

#### Step 2: Review Configuration

Digital Ocean will parse the spec and show you:
- Services to be created
- Databases to be provisioned
- Environment variables
- Estimated costs

#### Step 3: Configure GitHub Integration

1. Connect your GitHub account if not already connected
2. Grant Digital Ocean access to your repository
3. Select the repository and branch

#### Step 4: Review and Create

1. Review all settings
2. Click **"Create Resources"**
3. Wait for deployment to complete (5-10 minutes)

### Method 3: Manual Configuration (Advanced)

If you want full control over each step:

#### Step 1: Create Database Services First

1. **Create PostgreSQL Database**:
   - Navigate to **Databases** → **Create Database Cluster**
   - Select **PostgreSQL 13**
   - Choose **Development** tier (or higher for production)
   - Select region (e.g., NYC3)
   - Name it: `forecastin-db`

2. **Create Redis Cache**:
   - Navigate to **Databases** → **Create Database Cluster**
   - Select **Redis 7**
   - Choose **Development** tier (or higher for production)
   - Select the same region as PostgreSQL
   - Name it: `forecastin-redis`

3. **Note the connection details** - you'll need them for environment variables

#### Step 2: Create the API Service

1. Navigate to **Apps** → **Create App**
2. Connect your GitHub repository
3. Configure the API component:
   - **Source Directory**: `/` (root)
   - **Dockerfile Path**: `api/Dockerfile`
   - **HTTP Port**: `9000`
   - **Health Check Path**: `/health`
   - **Environment Variables**: See "Environment Variables" section below

#### Step 3: Create the Frontend Service

1. In the same app, add a new component
2. Configure the frontend:
   - **Type**: Web Service (Dockerfile)
   - **Source Directory**: `/` (root)
   - **Dockerfile Path**: `frontend/Dockerfile`
   - **HTTP Port**: `80`
   - **Environment Variables**: See "Environment Variables" section below

## Environment Variables

### API Service Environment Variables

```bash
# Application Settings
ENVIRONMENT=production
API_PORT=9000
LOG_LEVEL=INFO

# Database (Auto-configured when using managed database)
DATABASE_HOST=${db.HOSTNAME}
DATABASE_PORT=${db.PORT}
DATABASE_NAME=${db.DATABASE}
DATABASE_USER=${db.USERNAME}
DATABASE_PASSWORD=${db.PASSWORD}
DATABASE_URL=${db.DATABASE_URL}

# Redis (Auto-configured when using managed cache)
REDIS_HOST=${redis.HOSTNAME}
REDIS_PORT=${redis.PORT}
REDIS_URL=${redis.DATABASE_URL}
```

### Frontend Service Environment Variables

```bash
NODE_ENV=production
REACT_APP_API_URL=${api.PUBLIC_URL}
REACT_APP_WS_URL=${api.PUBLIC_URL}
```

**Note**: Variables like `${db.HOSTNAME}` are automatically substituted by Digital Ocean when using managed databases.

## Post-Deployment Configuration

### 1. Set Up Custom Domain (Optional)

```bash
# Using doctl
doctl apps update <app-id> --spec .do/app.yaml

# Or in the web console:
# Apps → Your App → Settings → Domains
```

### 2. Enable PostgreSQL Extensions

Digital Ocean's managed PostgreSQL doesn't include PostGIS by default. You may need to:

1. Connect to your database:
   ```bash
   doctl databases connection <database-id>
   ```

2. Enable PostGIS extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS ltree;
   ```

### 3. Run Database Migrations

If you have database migrations:

```bash
# Connect to the API container
doctl apps logs <app-id> --type RUN_RESTARTED

# Or add a pre-deploy job in app.yaml (see commented section)
```

### 4. Configure CORS (if needed)

The API should already be configured to accept requests from the frontend domain. Verify in your FastAPI app that CORS settings are correct.

## Monitoring and Logs

### View Application Logs

```bash
# Real-time logs
doctl apps logs <app-id> --follow

# Component-specific logs
doctl apps logs <app-id> --type RUN --component api
doctl apps logs <app-id> --type RUN --component frontend
```

### Check Application Health

```bash
# Get app info
doctl apps get <app-id>

# Check endpoints
curl https://<your-app-url>/health  # API health check
curl https://<your-app-url>/         # Frontend
```

### Monitor Database

```bash
# List databases
doctl databases list

# Get database info
doctl databases get <database-id>

# View connection details
doctl databases connection <database-id>
```

## Scaling

### Manual Scaling

```bash
# Scale API instances
doctl apps update <app-id> --spec .do/app.yaml
# Edit instance_count in app.yaml before running
```

### Auto-scaling (Requires Pro plan or higher)

Uncomment the autoscaling section in `.do/app.yaml`:

```yaml
autoscaling:
  min_instance_count: 1
  max_instance_count: 3
  metrics:
    cpu:
      percent: 80
```

## Cost Optimization

### Development/Testing

The current spec uses development-tier resources:
- **API**: Basic XS ($5/month)
- **Frontend**: Basic XS ($5/month)
- **PostgreSQL**: Dev tier ($7/month)
- **Redis**: Dev tier ($7/month)

**Total**: ~$24/month

### Production

For production workloads, consider:
- **API**: Basic S or higher ($12+/month)
- **Frontend**: Basic S ($12+/month)
- **PostgreSQL**: Basic ($15+/month, includes backups)
- **Redis**: Basic ($15+/month)

**Total**: ~$54+/month

### Cost-Saving Tips

1. **Use static site hosting for frontend** (cheaper than a web service):
   - Uncomment the `static_sites` section in `app.yaml`
   - Remove the frontend service
   - This serves pre-built React as static files

2. **Combine services**: Run frontend and API in one container (not recommended for scaling)

3. **Use external database**: Self-host PostgreSQL on a Droplet if you need more control

## Troubleshooting

### Build Failures

**Issue**: "Verify the repo contains supported file types"
- **Solution**: Use the App Spec file or set source directory to `/` with correct Dockerfile paths

**Issue**: Dockerfile build fails
- **Solution**: Check build logs with `doctl apps logs <app-id> --type BUILD`
- Ensure all files referenced in Dockerfile exist

### Runtime Errors

**Issue**: Health checks failing
- **Solution**:
  - Ensure API is listening on port 9000
  - Verify `/health` endpoint works
  - Check environment variables are set correctly

**Issue**: Database connection errors
- **Solution**:
  - Verify database is in the same region
  - Check environment variables: `${db.DATABASE_URL}` should be set
  - Ensure database extensions are installed

**Issue**: Frontend can't connect to API
- **Solution**:
  - Check `REACT_APP_API_URL` environment variable
  - Verify CORS settings in API
  - Check API is publicly accessible

### Performance Issues

**Issue**: Slow response times
- **Solution**:
  - Scale up instance size
  - Enable auto-scaling
  - Add Redis caching (already configured)
  - Enable CDN for frontend assets

## Updating the Application

### Automatic Deployments

With `deploy_on_push: true`, Digital Ocean will automatically deploy when you push to your main branch.

### Manual Deployments

```bash
# Trigger a new deployment
doctl apps create-deployment <app-id>

# Or update the spec
doctl apps update <app-id> --spec .do/app.yaml
```

## Rollback

```bash
# List deployments
doctl apps list-deployments <app-id>

# Get deployment details
doctl apps get-deployment <app-id> <deployment-id>

# Rollback (requires manual intervention in console)
# Go to: Apps → Your App → Deployments → Previous → Rollback
```

## Additional Resources

- [Digital Ocean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [App Spec Reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [doctl CLI Reference](https://docs.digitalocean.com/reference/doctl/)
- [Digital Ocean Community](https://www.digitalocean.com/community)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Digital Ocean's documentation
3. Check application logs
4. Contact Digital Ocean support
5. Open an issue in the GitHub repository

## Security Checklist

Before going to production:

- [ ] Use production database tiers (not dev)
- [ ] Enable database backups
- [ ] Set up SSL/TLS (automatic with App Platform)
- [ ] Configure environment variables securely (never commit secrets)
- [ ] Enable monitoring and alerts
- [ ] Review API authentication/authorization
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Review security headers
- [ ] Enable database connection pooling
- [ ] Set up regular database backups
- [ ] Configure log retention
- [ ] Review IAM and access controls

---

**Happy Deploying!** 🚀
