"""
Database Manager with connection pooling and context manager support.

Implements thread-safe database connection management with RLock synchronization,
TCP keepalives, exponential backoff retry mechanism, and connection pool health monitoring
following the patterns specified in AGENTS.md.
"""

import asyncio
import logging
import threading
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

import asyncpg
from asyncpg import Pool, Connection
from asyncpg.pool import PoolAcquireContext


logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Thread-safe database manager with connection pooling and context manager support.
    
    Key features:
    - Uses threading.RLock for re-entrant locking (not standard Lock)
    - TCP keepalives to prevent firewall drops
    - Connection pool health monitoring with 80% utilization warning
    - Exponential backoff retry mechanism for transient failures
    - Context manager protocol for automatic connection management
    """
    
    def __init__(
        self,
        database_url: str,
        min_connections: int = 5,
        max_connections: int = 20,
        command_timeout: int = 60,
        server_settings: Optional[Dict[str, str]] = None,
    ):
        """
        Initialize DatabaseManager with connection pooling.
        
        Args:
            database_url: PostgreSQL connection URL
            min_connections: Minimum number of connections in pool
            max_connections: Maximum number of connections in pool
            command_timeout: Command timeout in seconds
            server_settings: PostgreSQL server settings
        """
        self.database_url = database_url
        self.min_connections = min_connections
        self.max_connections = max_connections
        self.command_timeout = command_timeout
        self.server_settings = server_settings or {}
        
        # Use RLock instead of standard Lock for thread safety
        self._lock = threading.RLock()
        self._pool: Optional[Pool] = None
        self._health_monitor_running = False
        self._health_monitor_thread: Optional[threading.Thread] = None
        
        # Connection retry configuration
        self._retry_attempts = 3
        self._retry_delays = [0.5, 1.0, 2.0]  # Exponential backoff
        
        # TCP keepalive settings to prevent firewall drops
        self._keepalive_settings = {
            "keepalives_idle": "30",
            "keepalives_interval": "10", 
            "keepalives_count": "5"
        }
        
        # Merge server settings with keepalive settings
        self._server_settings = {**self._keepalive_settings, **self.server_settings}
        
        # Health monitoring
        self._pool_utilization_warning_threshold = 0.8  # 80% utilization warning
        self._health_check_interval = 30  # Check every 30 seconds
    
    async def initialize(self) -> None:
        """Initialize the database connection pool."""
        async with self._lock:
            if self._pool is not None:
                return
                
            try:
                # Validate database URL
                parsed_url = urlparse(self.database_url)
                if not parsed_url.scheme or not parsed_url.hostname:
                    raise ValueError(f"Invalid database URL: {self.database_url}")
                
                self._pool = await asyncpg.create_pool(
                    self.database_url,
                    min_size=self.min_connections,
                    max_size=self.max_connections,
                    command_timeout=self.command_timeout,
                    server_settings=self._server_settings,
                    pool_pre_ping=True,  # Test connection health before use
                )
                
                logger.info(
                    f"Database pool initialized with {self.min_connections}-{self.max_connections} connections"
                )
                
                # Start health monitoring
                self._start_health_monitoring()
                
            except Exception as e:
                logger.error(f"Failed to initialize database pool: {e}")
                raise
    
    async def close(self) -> None:
        """Close the database connection pool and stop health monitoring."""
        async with self._lock:
            # Stop health monitoring
            self._health_monitor_running = False
            if self._health_monitor_thread and self._health_monitor_thread.is_alive():
                self._health_monitor_thread.join(timeout=5)
            
            # Close pool
            if self._pool:
                await self._pool.close()
                self._pool = None
                logger.info("Database pool closed")
    
    @asynccontextmanager
    async def get_connection(self) -> Connection:
        """
        Get a database connection from the pool with retry logic.
        
        Yields:
            Database connection
            
        Raises:
            Exception: If connection cannot be acquired after retries
        """
        if not self._pool:
            await self.initialize()
        
        # Try to acquire connection with exponential backoff retry
        for attempt in range(self._retry_attempts):
            try:
                async with self._pool.acquire() as connection:
                    # Test connection health
                    await connection.execute("SELECT 1")
                    yield connection
                    return
                    
            except Exception as e:
                logger.warning(
                    f"Database connection attempt {attempt + 1} failed: {e}"
                )
                
                if attempt == self._retry_attempts - 1:
                    # Last attempt failed, raise exception
                    logger.error("All database connection attempts failed")
                    raise
                
                # Wait before retry (exponential backoff)
                await asyncio.sleep(self._retry_delays[attempt])
    
    async def execute(self, query: str, *args) -> str:
        """
        Execute a query on the database.
        
        Args:
            query: SQL query to execute
            *args: Query parameters
            
        Returns:
            Query result status
        """
        async with self.get_connection() as conn:
            return await conn.execute(query, *args)
    
    async def fetch(self, query: str, *args) -> list:
        """
        Fetch multiple rows from the database.
        
        Args:
            query: SQL query to execute
            *args: Query parameters
            
        Returns:
            List of fetched rows
        """
        async with self.get_connection() as conn:
            return await conn.fetch(query, *args)
    
    async def fetchrow(self, query: str, *args) -> Optional[dict]:
        """
        Fetch a single row from the database.
        
        Args:
            query: SQL query to execute
            *args: Query parameters
            
        Returns:
            Single row or None if no rows returned
        """
        async with self.get_connection() as conn:
            return await conn.fetchrow(query, *args)
    
    async def fetchval(self, query: str, *args) -> Any:
        """
        Fetch a single value from the database.
        
        Args:
            query: SQL query to execute
            *args: Query parameters
            
        Returns:
            Single value
        """
        async with self.get_connection() as conn:
            return await conn.fetchval(query, *args)
    
    async def refresh_hierarchy_views(self) -> None:
        """
        Refresh materialized views for hierarchy operations.
        
        This is required after hierarchy modifications as materialized views
        do not refresh automatically like regular views.
        """
        async with self.get_connection() as conn:
            # Refresh materialized views for hierarchy performance
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors")
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts")
            
            logger.info("Hierarchy materialized views refreshed")
    
    def _start_health_monitoring(self) -> None:
        """Start background thread for connection pool health monitoring."""
        if self._health_monitor_running:
            return
            
        self._health_monitor_running = True
        self._health_monitor_thread = threading.Thread(
            target=self._health_monitor_loop,
            daemon=True
        )
        self._health_monitor_thread.start()
    
    def _health_monitor_loop(self) -> None:
        """Background health monitoring loop."""
        logger.info("Starting database pool health monitoring")
        
        while self._health_monitor_running and self._pool:
            try:
                time.sleep(self._health_check_interval)
                
                if not self._pool:
                    break
                
                # Check pool utilization
                pool_size = self._pool.get_size()
                max_size = self._pool.get_max_size()
                utilization = pool_size / max_size if max_size > 0 else 0
                
                # Log warning if utilization exceeds threshold
                if utilization >= self._pool_utilization_warning_threshold:
                    logger.warning(
                        f"Database pool utilization high: {utilization:.1%} "
                        f"({pool_size}/{max_size} connections)"
                    )
                
                # Test pool health by trying to acquire a connection
                # This will trigger pool_pre_ping and detect dead connections
                try:
                    asyncio.run_coroutine_threadsafe(
                        self._pool.health_check(), 
                        asyncio.get_event_loop()
                    )
                except Exception as e:
                    logger.warning(f"Pool health check failed: {e}")
                    
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")
        
        logger.info("Database pool health monitoring stopped")
    
    async def __aenter__(self) -> "DatabaseManager":
        """Async context manager entry."""
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close()
    
    @property
    def pool(self) -> Optional[Pool]:
        """Get the current connection pool."""
        return self._pool
    
    @property 
    def pool_size(self) -> int:
        """Get current pool size."""
        if not self._pool:
            return 0
        return self._pool.get_size()
    
    @property
    def max_pool_size(self) -> int:
        """Get maximum pool size."""
        return self.max_connections
    
    @property
    def pool_utilization(self) -> float:
        """Get current pool utilization as percentage."""
        if not self._pool:
            return 0.0
        return self.pool_size / self.max_pool_size