# Multi-stage Dockerfile for Forecastin Frontend
# Optimized for React + TypeScript + Deck.gl geospatial application

# ==============================================================================
# BUILD STAGE - Compile and bundle the application
# ==============================================================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Set build arguments for environment configuration
ARG NODE_ENV=production
ARG REACT_APP_API_URL=http://localhost:9000
ARG REACT_APP_WS_URL=ws://localhost:9000

# Copy package files first for better Docker layer caching
# This is crucial for dependency installation caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for building)
# We'll install all dependencies in builder stage, then copy only production deps to runtime
RUN npm install --include=dev && npm cache clean --force

# Copy source code
COPY . .

# Build the application for production
# This compiles TypeScript, bundles with Webpack, and optimizes assets
RUN npm run build

# ==============================================================================
# RUNTIME STAGE - Serve the application with nginx
# ==============================================================================
FROM nginx:1.25-alpine AS runtime

# Install additional runtime dependencies if needed
RUN apk add --no-cache \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy clean nginx configuration
COPY nginx-fixed.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Use nginx user for security
USER nginx

# Start nginx with custom configuration
CMD ["nginx", "-g", "daemon off;"]