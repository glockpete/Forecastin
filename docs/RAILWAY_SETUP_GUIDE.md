# Railway Setup Guide for Forecastin

## Table of Contents
- [What is Railway?](#what-is-railway)
- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Step-by-Step Setup](#step-by-step-setup)
  - [1. PostgreSQL Database](#1-postgresql-database)
  - [2. Redis Cache](#2-redis-cache)
  - [3. Backend API](#3-backend-api)
  - [4. Frontend Application](#4-frontend-application)
- [Environment Variables Reference](#environment-variables-reference)
- [Testing Your Deployment](#testing-your-deployment)
- [Troubleshooting](#troubleshooting)
- [Cost Optimization](#cost-optimization)

---

## What is Railway?

Railway is a modern Platform-as-a-Service (PaaS) that simplifies application deployment and infrastructure management. It provides:

- **Automatic deployments** from Git repositories
- **Managed databases** (PostgreSQL, Redis, MySQL, MongoDB)
- **Custom domains** and SSL certificates
- **Environment variable management**
- **Simple pricing** based on resource usage
- **Built-in monitoring** and logs

Railway is ideal for deploying Forecastin for testing, staging, or production environments without managing complex infrastructure.

---

## Prerequisites

Before you begin, ensure you have:

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Account**: Railway integrates with GitHub for automatic deployments
3. **Railway CLI** (optional but recommended):
   ```bash
   npm install -g @railway/cli
   railway login
   ```
4. **Git Repository**: Your Forecastin repository pushed to GitHub

---

## Architecture Overview

Forecastin consists of four main services that need to be deployed on Railway:

```
┌─────────────────────────────────────────────────────┐
│                   Railway Project                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                │
│  │  PostgreSQL  │  │    Redis     │                │
│  │   (PostGIS)  │  │   (Cache)    │                │
│  └──────┬───────┘  └──────┬───────┘                │
│         │                  │                         │
│         └──────┬───────────┘                         │
│                │                                     │
│         ┌──────▼───────────┐                        │
│         │   Backend API    │                        │
│         │    (FastAPI)     │                        │
│         └──────┬───────────┘                        │
│                │                                     │
│         ┌──────▼───────────┐                        │
│         │     Frontend     │                        │
│         │  (React + Nginx) │                        │
│         └──────────────────┘                        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Step-by-Step Setup

### 1. PostgreSQL Database

Railway provides managed PostgreSQL with PostGIS support.

#### Create PostgreSQL Service

1. Go to your Railway project dashboard
2. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically provision a PostgreSQL instance

#### Configure PostGIS Extension

After the database is created, you need to enable PostGIS and LTREE extensions:

1. Click on your PostgreSQL service
2. Go to the **"Connect"** tab and copy the connection string
3. Use a PostgreSQL client or Railway's SQL console to run:

```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable LTREE extension for hierarchical data
CREATE EXTENSION IF NOT EXISTS ltree;

-- Verify extensions
\dx
```

#### Get Database Credentials

Railway automatically creates environment variables for your database:
- `DATABASE_URL`: Full connection string (e.g., `postgresql://postgres:password@host:5432/railway`)

**Note the `DATABASE_URL` - you'll need it for the API service.**

---

### 2. Redis Cache

Railway provides managed Redis for caching.

#### Create Redis Service

1. In your Railway project dashboard
2. Click **"+ New"** → **"Database"** → **"Add Redis"**
3. Railway will automatically provision a Redis instance

#### Get Redis Credentials

Railway automatically creates:
- `REDIS_URL`: Full connection string (e.g., `redis://default:password@host:6379`)

**Note the `REDIS_URL` - you'll need it for the API service.**

---

### 3. Backend API

The FastAPI backend requires PostgreSQL and Redis to be set up first.

#### Deploy from GitHub

1. In your Railway project dashboard
2. Click **"+ New"** → **"GitHub Repo"**
3. Connect your GitHub account if not already connected
4. Select your Forecastin repository
5. Railway will detect the repository structure

#### Configure Build Settings

1. Click on the newly created service
2. Go to **"Settings"** tab
3. Configure the following:

**Root Directory**: Set to `api`
   - This tells Railway to build from the `api` folder

**Build Command**: Leave default (Railway will detect Dockerfile)

**Start Command**: Leave default (uses Dockerfile CMD)

#### Set Environment Variables

Go to the **"Variables"** tab and add:

```bash
# Database connection (reference from PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis connection (reference from Redis service)
REDIS_URL=${{Redis.REDIS_URL}}

# API Configuration
API_PORT=9000
ENVIRONMENT=production

# WebSocket Configuration
WS_PING_INTERVAL=30
WS_PING_TIMEOUT=10

# CORS Origins (add your frontend domain)
ALLOWED_ORIGINS=https://your-frontend-domain.railway.app,http://localhost:3000

# Public URLs (will be your Railway domain)
PUBLIC_BASE_URL=https://your-api-domain.railway.app
WS_PUBLIC_URL=wss://your-api-domain.railway.app/ws
```

**Important**: Railway's variable syntax `${{ServiceName.VARIABLE}}` automatically references other services in your project.

#### Configure Port

1. Go to **"Settings"** → **"Networking"**
2. Railway should auto-detect port 9000 from the Dockerfile
3. If not, manually set **Port** to `9000`

#### Get Your API URL

After deployment:
1. Go to **"Settings"** → **"Domains"**
2. Railway auto-generates a domain like `your-service.up.railway.app`
3. Optionally, add a custom domain

---

### 4. Frontend Application

The React frontend connects to your deployed API.

#### Deploy from GitHub

1. In your Railway project dashboard
2. Click **"+ New"** → **"GitHub Repo"**
3. Select the same Forecastin repository
4. Railway will create a new service for the frontend

#### Configure Build Settings

1. Click on the frontend service
2. Go to **"Settings"** tab
3. Configure:

**Root Directory**: Set to `frontend`

**Build Command**:
```bash
npm install && npm run build
```

**Start Command**: Uses Dockerfile (nginx)

#### Set Build Arguments and Environment Variables

Go to the **"Variables"** tab:

```bash
# Build-time arguments (for React build process)
REACT_APP_API_URL=https://your-api-domain.railway.app
REACT_APP_WS_URL=wss://your-api-domain.railway.app/ws

# Node environment
NODE_ENV=production
```

**Critical**: Replace `your-api-domain.railway.app` with your actual API service URL from Step 3.

#### Configure Port

1. Go to **"Settings"** → **"Networking"**
2. Set **Port** to `80` (nginx serves on port 80)

#### Get Your Frontend URL

After deployment:
1. Go to **"Settings"** → **"Domains"**
2. Railway auto-generates a domain like `your-frontend.up.railway.app`
3. Optionally, add a custom domain

#### Update API CORS Settings

Now that you have your frontend URL, update the API's `ALLOWED_ORIGINS`:

1. Go back to your **API service**
2. Go to **"Variables"** tab
3. Update `ALLOWED_ORIGINS` to include your frontend domain:
   ```bash
   ALLOWED_ORIGINS=https://your-frontend.up.railway.app
   ```
4. Save and redeploy

---

## Environment Variables Reference

### PostgreSQL Service (Auto-generated by Railway)
```bash
DATABASE_URL=postgresql://postgres:password@host:5432/railway
POSTGRES_HOST=host
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=railway
```

### Redis Service (Auto-generated by Railway)
```bash
REDIS_URL=redis://default:password@host:6379
REDIS_HOST=host
REDIS_PORT=6379
REDIS_PASSWORD=password
```

### Backend API Service
```bash
# Database and Cache
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# API Configuration
API_PORT=9000
ENVIRONMENT=production

# WebSocket Configuration
WS_PING_INTERVAL=30
WS_PING_TIMEOUT=10

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend.railway.app

# Public URLs
PUBLIC_BASE_URL=https://your-api.railway.app
WS_PUBLIC_URL=wss://your-api.railway.app/ws
```

### Frontend Service
```bash
# API Connection (build-time variables)
REACT_APP_API_URL=https://your-api.railway.app
REACT_APP_WS_URL=wss://your-api.railway.app/ws

# Build Configuration
NODE_ENV=production
```

---

## Testing Your Deployment

### 1. Check Service Health

#### Test API Health Endpoint
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

#### Test API Documentation
Visit: `https://your-api.railway.app/docs`

You should see the FastAPI interactive documentation (Swagger UI).

### 2. Test WebSocket Connection

Use `wscat` or a browser console:

```bash
npm install -g wscat
wscat -c wss://your-api.railway.app/ws/echo
```

Send a test message:
```json
{"type":"test","data":"hello"}
```

You should receive an echo response.

### 3. Test Frontend

Visit: `https://your-frontend.railway.app`

- The application should load without errors
- Check browser console for any connection issues
- Verify WebSocket connection is established (check Network tab)

### 4. Check Railway Logs

For each service:
1. Click on the service in Railway dashboard
2. Go to **"Deployments"** tab
3. Click on the latest deployment
4. View **Build Logs** and **Deploy Logs**

Look for:
- ✅ Successful database connections
- ✅ Successful Redis connections
- ✅ WebSocket server starting
- ✅ No error messages

---

## Troubleshooting

### Issue: Database Connection Fails

**Symptoms**: API logs show `could not connect to server`

**Solutions**:
1. Verify PostgreSQL service is running (check Railway dashboard)
2. Check `DATABASE_URL` is correctly set in API service
3. Ensure you're using Railway's internal reference: `${{Postgres.DATABASE_URL}}`
4. Check API service has dependency on PostgreSQL (set in Railway)

### Issue: Redis Connection Fails

**Symptoms**: API logs show `Error connecting to Redis`

**Solutions**:
1. Verify Redis service is running
2. Check `REDIS_URL` is correctly set
3. Ensure you're using: `${{Redis.REDIS_URL}}`

### Issue: WebSocket Disconnects (1006 errors)

**Symptoms**: Frontend shows repeated WebSocket disconnections

**Solutions**:
1. Verify `WS_PING_INTERVAL` is set to `30` in API service
2. Check `ALLOWED_ORIGINS` includes your frontend domain
3. Ensure frontend uses `wss://` (not `ws://`) for HTTPS sites
4. Check Railway's proxy settings (Railway should handle this automatically)

### Issue: CORS Errors

**Symptoms**: Browser console shows `CORS policy` errors

**Solutions**:
1. Update API's `ALLOWED_ORIGINS` to include your frontend domain
2. Ensure no trailing slashes in origin URLs
3. Format: `https://your-frontend.railway.app` (no trailing `/`)
4. Redeploy API after changing CORS settings

### Issue: Frontend Shows "Cannot connect to API"

**Symptoms**: Frontend loads but can't fetch data

**Solutions**:
1. Verify `REACT_APP_API_URL` is set correctly in frontend service
2. Check API is running and accessible at that URL
3. Test API health endpoint directly
4. Check browser console for specific error messages
5. Ensure no mixed content (HTTPS frontend → HTTP API)

### Issue: Database Extensions Missing

**Symptoms**: API logs show `relation does not exist` or geometry errors

**Solutions**:
1. Connect to PostgreSQL via Railway console
2. Run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS ltree;
   \dx  -- Verify extensions are installed
   ```
3. Run migrations if available:
   ```bash
   # From your local machine with Railway CLI
   railway run python -m alembic upgrade head
   ```

### Issue: Build Fails

**Symptoms**: Deployment shows "Build failed"

**Solutions**:
1. Check build logs for specific error
2. Verify `Root Directory` is set correctly (`api` or `frontend`)
3. Ensure Dockerfile exists in the root directory
4. Check Dockerfile syntax and dependencies
5. Verify requirements.txt (API) or package.json (frontend) are present

---

## Cost Optimization

Railway uses a usage-based pricing model. Here are tips to optimize costs:

### Development/Testing
- Use Railway's **free trial** credits for initial testing
- **Sleep on idle**: Enable auto-sleep for services during inactive periods
- **Scale down**: Use minimal resources for testing environments

### Production
- **Enable caching**: Leverage Redis to reduce database queries
- **Optimize builds**: Use multi-stage Docker builds (already configured)
- **Monitor usage**: Check Railway dashboard for resource consumption
- **Set limits**: Configure resource limits to prevent unexpected costs

### Resource Recommendations

**Development/Testing Environment**:
```
PostgreSQL: Starter plan (~$5/month)
Redis: Starter plan (~$5/month)
API: ~$5-10/month (depending on traffic)
Frontend: ~$5/month (static content)
Total: ~$20-25/month
```

**Production Environment**:
- Scale based on actual traffic and performance requirements
- Monitor and adjust as needed
- Consider reserved capacity for cost savings

---

## Advanced Configuration

### Custom Domains

1. Go to service **"Settings"** → **"Domains"**
2. Click **"Add Domain"**
3. Enter your custom domain (e.g., `app.example.com`)
4. Add DNS records as shown by Railway:
   ```
   Type: CNAME
   Name: app
   Value: your-service.up.railway.app
   ```
5. Railway automatically provisions SSL certificates

### Database Backups

Railway provides automatic backups for PostgreSQL:
1. Go to PostgreSQL service
2. **"Settings"** → **"Backups"**
3. Configure backup frequency and retention

**Recommended**: Enable daily backups with 7-day retention for production.

### Monitoring and Alerts

1. Use Railway's built-in metrics (CPU, Memory, Network)
2. Set up log drains to external monitoring services
3. Configure health check endpoints (already included in Dockerfiles)

### CI/CD Integration

Railway automatically deploys on git push:
1. **Production**: Deploy from `main` branch
2. **Staging**: Create separate Railway project for `staging` branch
3. **Preview Deployments**: Enable PR previews in Railway settings

---

## Migration from Docker Compose

If you're currently using `docker-compose.yml` locally:

| Docker Compose Service | Railway Equivalent |
|------------------------|-------------------|
| `postgres` | Railway PostgreSQL database |
| `redis` | Railway Redis database |
| `api` | Railway service (GitHub repo, `api` root) |
| `frontend` | Railway service (GitHub repo, `frontend` root) |
| `prometheus` | Optional: Deploy as separate service or use external monitoring |
| `grafana` | Optional: Deploy as separate service or use Railway metrics |

**Note**: Railway's internal networking automatically handles service discovery using `${{ServiceName.VARIABLE}}` syntax.

---

## Next Steps

After successful deployment:

1. ✅ **Test all functionality**: Verify features work in production environment
2. ✅ **Set up monitoring**: Configure alerts for downtime or errors
3. ✅ **Configure backups**: Enable database backups
4. ✅ **Custom domains**: Add production domains
5. ✅ **Security review**: Audit environment variables and access controls
6. ✅ **Load testing**: Verify performance under expected traffic
7. ✅ **Documentation**: Update team documentation with Railway URLs

---

## Support and Resources

- **Railway Documentation**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: Community support and discussions
- **Forecastin Issues**: [github.com/glockpete/Forecastin/issues](https://github.com/glockpete/Forecastin/issues)
- **Railway CLI Reference**: `railway help`

---

## Quick Reference Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to existing project
railway link

# View project status
railway status

# View logs
railway logs

# Open service in browser
railway open

# Run command in Railway environment
railway run <command>

# Example: Run database migrations
railway run python -m alembic upgrade head

# SSH into running service
railway shell

# Environment variables
railway variables set KEY=value
railway variables get KEY
```

---

## Conclusion

You now have a fully functional Forecastin deployment on Railway! This setup provides:

✅ **Managed infrastructure** - No server maintenance required
✅ **Automatic deployments** - Push to GitHub, deploy automatically
✅ **Scalable architecture** - Scale services independently
✅ **Built-in monitoring** - Logs, metrics, and health checks
✅ **Secure by default** - SSL certificates and environment isolation

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section or open an issue on GitHub.

**Happy deploying! 🚀**
