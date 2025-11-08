#!/usr/bin/env python3
"""
Infrastructure Health Monitoring Script
Monitors database, Redis, and frontend service connectivity
Implements the health monitoring patterns specified in AGENTS.md
"""

import asyncio
import logging
import os
import sys
import time
from typing import Dict, Any, List
import aioredis
import asyncpg
import aiohttp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class InfrastructureHealthMonitor:
    """Comprehensive health monitoring for all infrastructure components"""
    
    def __init__(self):
        self.database_url = os.getenv('DATABASE_URL', 'postgresql://forecastin:@localhost:5432/forecastin')
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.api_base_url = os.getenv('API_BASE_URL', 'http://localhost:9000')
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        
        # Health thresholds
        self.db_pool_utilization_threshold = 0.8  # 80% utilization warning
        self.redis_health_check_interval = 30  # seconds
        
        # Connection objects
        self.db_pool = None
        self.redis_client = None
        self.session = None
        
    async def initialize_connections(self):
        """Initialize all service connections"""
        try:
            # Initialize database connection pool
            self.db_pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10,
                command_timeout=30,
                server_settings={
                    'keepalives_idle': '30',
                    'keepalives_interval': '10',
                    'keepalives_count': '5'
                }
            )
            logger.info("Database connection pool initialized")
            
            # Initialize Redis connection
            self.redis_client = aioredis.from_url(
                self.redis_url,
                max_connections=5,
                retry_on_timeout=True,
                health_check_interval=30,
                socket_keepalive=True
            )
            await self.redis_client.ping()
            logger.info("Redis connection established")
            
            # Initialize HTTP session
            self.session = aiohttp.ClientSession()
            logger.info("HTTP session initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize connections: {e}")
            raise
    
    async def close_connections(self):
        """Close all service connections"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        if self.session:
            await self.session.close()
        logger.info("All connections closed")
    
    async def check_database_health(self) -> Dict[str, Any]:
        """Check database health and connection pool status"""
        try:
            if not self.db_pool:
                return {"status": "error", "message": "Database pool not initialized"}
            
            # Test database connectivity
            async with self.db_pool.acquire() as conn:
                await conn.execute("SELECT 1")
            
            # Check pool utilization
            pool_size = self.db_pool.get_size()
            max_size = self.db_pool.get_max_size()
            utilization = pool_size / max_size if max_size > 0 else 0
            
            # Log warning if utilization exceeds threshold
            if utilization >= self.db_pool_utilization_threshold:
                logger.warning(
                    f"Database pool utilization high: {utilization:.1%} "
                    f"({pool_size}/{max_size} connections)"
                )
            
            return {
                "status": "healthy",
                "pool_size": pool_size,
                "max_size": max_size,
                "utilization": utilization,
                "utilization_percentage": f"{utilization:.1%}"
            }
            
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def check_redis_health(self) -> Dict[str, Any]:
        """Check Redis health and connection status"""
        try:
            if not self.redis_client:
                return {"status": "error", "message": "Redis client not initialized"}
            
            # Test Redis connectivity
            await self.redis_client.ping()
            
            # Get Redis info
            info = await self.redis_client.info()
            connected_clients = info.get('connected_clients', 0)
            used_memory = info.get('used_memory_human', 'N/A')
            
            return {
                "status": "healthy",
                "connected_clients": connected_clients,
                "used_memory": used_memory
            }
            
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def check_api_health(self) -> Dict[str, Any]:
        """Check API service health"""
        try:
            if not self.session:
                return {"status": "error", "message": "HTTP session not initialized"}
            
            # Test API health endpoint
            async with self.session.get(f"{self.api_base_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        "status": "healthy",
                        "response": data
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"API returned status {response.status}"
                    }
                    
        except Exception as e:
            logger.error(f"API health check failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def check_frontend_health(self) -> Dict[str, Any]:
        """Check frontend service health"""
        try:
            if not self.session:
                return {"status": "error", "message": "HTTP session not initialized"}
            
            # Test frontend health endpoint
            async with self.session.get(f"{self.frontend_url}/health") as response:
                if response.status == 200:
                    text = await response.text()
                    return {
                        "status": "healthy",
                        "response": text.strip()
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"Frontend returned status {response.status}"
                    }
                    
        except Exception as e:
            logger.error(f"Frontend health check failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def check_websocket_health(self) -> Dict[str, Any]:
        """Check WebSocket connectivity"""
        try:
            if not self.session:
                return {"status": "error", "message": "HTTP session not initialized"}
            
            # Test WebSocket upgrade capability
            async with self.session.ws_connect(f"{self.api_base_url.replace('http', 'ws')}/ws") as ws:
                # Send ping message
                await ws.send_str('{"type": "ping"}')
                
                # Wait for pong response
                msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = msg.data
                    return {
                        "status": "healthy",
                        "websocket_response": data
                    }
                else:
                    return {
                        "status": "error",
                        "message": f"Unexpected WebSocket message type: {msg.type}"
                    }
                    
        except asyncio.TimeoutError:
            logger.error("WebSocket health check timed out")
            return {"status": "error", "message": "WebSocket connection timed out"}
        except Exception as e:
            logger.error(f"WebSocket health check failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def run_health_checks(self) -> Dict[str, Any]:
        """Run all health checks and return consolidated results"""
        results = {
            "timestamp": time.time(),
            "database": await self.check_database_health(),
            "redis": await self.check_redis_health(),
            "api": await self.check_api_health(),
            "frontend": await self.check_frontend_health(),
            "websocket": await self.check_websocket_health()
        }
        
        # Determine overall status
        all_healthy = all(result.get("status") == "healthy" for result in results.values() 
                         if isinstance(result, dict) and "status" in result)
        results["overall_status"] = "healthy" if all_healthy else "degraded"
        
        return results
    
    async def monitor_continuously(self, interval: int = 30):
        """Continuously monitor infrastructure health"""
        logger.info(f"Starting continuous health monitoring (interval: {interval}s)")
        
        try:
            await self.initialize_connections()
            
            while True:
                results = await self.run_health_checks()
                
                # Log results
                logger.info(f"Health check results: {results['overall_status']}")
                
                if results["overall_status"] == "healthy":
                    logger.info("✅ All services are healthy")
                else:
                    logger.warning("⚠️  Some services are degraded")
                    for service, status in results.items():
                        if isinstance(status, dict) and status.get("status") != "healthy":
                            logger.warning(f"  {service}: {status}")
                
                # Wait before next check
                await asyncio.sleep(interval)
                
        except KeyboardInterrupt:
            logger.info("Health monitoring stopped by user")
        except Exception as e:
            logger.error(f"Health monitoring error: {e}")
        finally:
            await self.close_connections()

async def main():
    """Main entry point"""
    monitor = InfrastructureHealthMonitor()
    
    if len(sys.argv) > 1 and sys.argv[1] == "--continuous":
        # Run continuous monitoring
        await monitor.monitor_continuously()
    else:
        # Run single health check
        try:
            await monitor.initialize_connections()
            results = await monitor.run_health_checks()
            print(f"Health Check Results: {results}")
            await monitor.close_connections()
            
            # Exit with error code if any service is unhealthy
            if results["overall_status"] != "healthy":
                sys.exit(1)
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())