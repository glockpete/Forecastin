# ========================================
# BUILD STAGE - Install dependencies and build artifacts
# ========================================
FROM python:3.11-slim as builder

# Set build arguments for optimization
ARG PIP_NO_CACHE_DIR=1
ARG PIP_DISABLE_PIP_VERSION_CHECK=1
ARG PYTHONDONTWRITEBYTECODE=1
ARG PYTHONUNBUFFERED=1

# Create virtual environment for better dependency isolation
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install system dependencies needed for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy requirements first for better layer caching
COPY requirements_minimal.txt .
# Install Python dependencies with specific optimizations
RUN pip install --upgrade pip setuptools wheel && \
pip install --no-cache-dir -r requirements_minimal.txt
# Copy source code for any post-install tasks
COPY . .

# ========================================
# RUNTIME STAGE - Minimal runtime environment
# ========================================
FROM python:3.11-slim as runtime

# Set runtime environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app" \
    PATH="/opt/venv/bin:$PATH" \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install only runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && groupadd -r forecastin && useradd -r -g forecastin forecastin

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Create and set working directory
WORKDIR /app

# Copy application source code
COPY --chown=forecastin:forecastin . .

# Ensure proper permissions for the app user
RUN chmod -R 755 /app && \
    find /app -type f -name "*.py" -exec chmod 644 {} \;

# Switch to non-root user for security
USER forecastin

# Expose port with health check support
EXPOSE 9000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

# Performance optimized startup command with uvicorn optimizations
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000", "--loop", "asyncio", "--http", "httptools", "--access-log", "--log-level", "info", "--workers", "1", "--limit-concurrency", "1000"]
