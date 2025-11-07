#!/usr/bin/env python3
"""
Startup Validation Script
Verifies that all services (database, Redis, frontend) are properly connected
before starting the application.
"""

import asyncio
import logging
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

class StartupValidator:
    """Validates service connectivity at startup"""
    
    def __init__(self, max_retries: int = 5, retry_delay: int = 5):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.database_url = "postgresql://forecastin:forecastin_password@localhost:5432/forecastin"
        self.redis_url = "redis://localhost:6379/0"
        self.api_base_url = "http://localhost:9000"
        self.frontend_url = "http://localhost:3000"
        
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
            logger.info("✅ Database connection pool initialized")
            
            # Initialize Redis connection
            self.redis_client = aioredis.from_url(
                self.redis_url,
                max_connections=5,
                retry_on_timeout=True,
                health_check_interval=30,
                socket_keepalive=True
            )
            await self.redis_client.ping()
            logger.info("✅ Redis connection established")
            
            # Initialize HTTP session
            self.session = aiohttp.ClientSession()
            logger.info("✅ HTTP session initialized")
            
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
    
    async def validate_database_connection(self) -> bool:
        """Validate database connectivity with retries"""
        for attempt in range(self.max_retries):
            try:
                if not self.db_pool:
                    raise Exception("Database pool not initialized")
                
                # Test database connectivity
                async with self.db_pool.acquire() as conn:
                    await conn.execute("SELECT 1")
                
                logger.info("✅ Database connection validated")
                return True
                
            except Exception as e:
                logger.warning(f"Database connection attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retries - 1:
                    logger.info(f"Retrying in {self.retry_delay} seconds...")
                    await asyncio.sleep(self.retry_delay)
                else:
                    logger.error("❌ Database connection validation failed after all retries")
                    return False
        
        return False
    
    async def validate_redis_connection(self) -> bool:
        """Validate Redis connectivity with retries"""
        for attempt in range(self.max_retries):
            try:
                if not self.redis_client:
                    raise Exception("Redis client not initialized")
                
                # Test Redis connectivity
                await self.redis_client.ping()
                
                logger.info("✅ Redis connection validated")
                return True
                
            except Exception as e:
                logger.warning(f"Redis connection attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retries - 1:
                    logger.info(f"Retrying in {self.retry_delay} seconds...")
                    await asyncio.sleep(self.retry_delay)
                else:
                    logger.error("❌ Redis connection validation failed after all retries")
                    return False
        
        return False
    
    async def validate_api_service(self) -> bool:
        """Validate API service availability with retries"""
        for attempt in range(self.max_retries):
            try:
                if not self.session:
                    raise Exception("HTTP session not initialized")
                
                # Test API health endpoint
                async with self.session.get(f"{self.api_base_url}/health") as response:
                    if response.status == 200:
                        logger.info("✅ API service is available")
                        return True
                    else:
                        raise Exception(f"API returned status {response.status}")
                
            except Exception as e:
                logger.warning(f"API service attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retries - 1:
                    logger.info(f"Retrying in {self.retry_delay} seconds...")
                    await asyncio.sleep(self.retry_delay)
                else:
                    logger.error("❌ API service validation failed after all retries")
                    return False
        
        return False
    
    async def validate_frontend_service(self) -> bool:
        """Validate frontend service availability with retries"""
        for attempt in range(self.max_retries):
            try:
                if not self.session:
                    raise Exception("HTTP session not initialized")
                
                # Test frontend health endpoint
                async with self.session.get(f"{self.frontend_url}/health") as response:
                    if response.status == 200:
                        logger.info("✅ Frontend service is available")
                        return True
                    else:
                        raise Exception(f"Frontend returned status {response.status}")
                
            except Exception as e:
                logger.warning(f"Frontend service attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retries - 1:
                    logger.info(f"Retrying in {self.retry_delay} seconds...")
                    await asyncio.sleep(self.retry_delay)
                else:
                    logger.error("❌ Frontend service validation failed after all retries")
                    return False
        
        return False
    
    async def validate_websocket_connection(self) -> bool:
        """Validate WebSocket connectivity with retries"""
        for attempt in range(self.max_retries):
            try:
                if not self.session:
                    raise Exception("HTTP session not initialized")
                
                # Test WebSocket upgrade capability
                async with self.session.ws_connect(f"{self.api_base_url.replace('http', 'ws')}/ws") as ws:
                    # Send ping message
                    await ws.send_str('{"type": "ping"}')
                    
                    # Wait for pong response
                    msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        logger.info("✅ WebSocket connection validated")
                        return True
                    else:
                        raise Exception(f"Unexpected WebSocket message type: {msg.type}")
                
            except asyncio.TimeoutError:
                logger.warning(f"WebSocket connection attempt {attempt + 1} timed out")
                if attempt < self.max_retries - 1:
                    logger.info(f"Retrying in {self.retry_delay} seconds...")
                    await asyncio.sleep(self.retry_delay)
                else:
                    logger.error("❌ WebSocket connection validation failed after all retries (timeout)")
                    return False
            except Exception as e:
                logger.warning(f"WebSocket connection attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retries - 1:
                    logger.info(f"Retrying in {self.retry_delay} seconds...")
                    await asyncio.sleep(self.retry_delay)
                else:
                    logger.error("❌ WebSocket connection validation failed after all retries")
                    return False
        
        return False
    
    async def run_validations(self) -> bool:
        """Run all validations and return overall success status"""
        logger.info("Starting service connectivity validation...")
        
        try:
            await self.initialize_connections()
            
            # Run all validations
            validations = [
                ("Database", self.validate_database_connection()),
                ("Redis", self.validate_redis_connection()),
                ("API Service", self.validate_api_service()),
                ("Frontend Service", self.validate_frontend_service()),
                ("WebSocket", self.validate_websocket_connection())
            ]
            
            results = []
            for name, validation in validations:
                logger.info(f"Validating {name} connectivity...")
                result = await validation
                results.append((name, result))
            
            # Close connections
            await self.close_connections()
            
            # Check overall results
            all_passed = all(result for _, result in results)
            
            # Log summary
            logger.info("\n" + "="*50)
            logger.info("VALIDATION SUMMARY")
            logger.info("="*50)
            for name, result in results:
                status = "✅ PASS" if result else "❌ FAIL"
                logger.info(f"{name:20} {status}")
            logger.info("="*50)
            
            if all_passed:
                logger.info("🎉 All services validated successfully!")
                return True
            else:
                failed_services = [name for name, result in results if not result]
                logger.error(f"❌ Validation failed for services: {', '.join(failed_services)}")
                return False
                
        except Exception as e:
            logger.error(f"Validation process failed: {e}")
            return False

async def main():
    """Main entry point"""
    validator = StartupValidator()
    
    try:
        success = await validator.run_validations()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Startup validation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())