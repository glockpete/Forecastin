#!/usr/bin/env python3
"""
Connection Recovery Mechanism
Implements automatic retry and recovery for database, Redis, and WebSocket connections
"""

import asyncio
import logging
import time
from typing import Dict, Any, Callable, Optional
import aioredis
import asyncpg
import aiohttp
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ConnectionRecoveryManager:
    """Manages connection recovery with automatic retry mechanisms"""
    
    def __init__(self):
        self.database_url = "postgresql://forecastin:forecastin_password@localhost:5432/forecastin"
        self.redis_url = "redis://localhost:6379/0"
        self.api_base_url = "http://localhost:9000"
        
        # Recovery configuration
        self.max_retry_attempts = 5
        self.base_retry_delay = 1  # seconds
        self.max_retry_delay = 60  # seconds
        self.exponential_backoff_factor = 2
        
        # Connection objects
        self.db_pool = None
        self.redis_client = None
        self.session = None
        
        # Recovery callbacks
        self.recovery_callbacks = []
        
        # Connection status tracking
        self.connection_status = {
            "database": {"connected": False, "last_attempt": None, "failures": 0},
            "redis": {"connected": False, "last_attempt": None, "failures": 0},
            "websocket": {"connected": False, "last_attempt": None, "failures": 0}
        }
    
    def register_recovery_callback(self, callback: Callable):
        """Register a callback to be called when connections are recovered"""
        self.recovery_callbacks.append(callback)
        logger.info(f"Registered recovery callback: {callback.__name__}")
    
    async def _calculate_retry_delay(self, attempt: int) -> float:
        """Calculate retry delay with exponential backoff and jitter"""
        delay = min(
            self.base_retry_delay * (self.exponential_backoff_factor ** attempt),
            self.max_retry_delay
        )
        # Add jitter to prevent thundering herd
        jitter = 0.1 * delay * (0.5 - asyncio.get_event_loop().time() % 1)
        return max(0, delay + jitter)
    
    async def _attempt_database_connection(self) -> bool:
        """Attempt to establish database connection"""
        try:
            if self.db_pool:
                # Test existing connection
                async with self.db_pool.acquire() as conn:
                    await conn.execute("SELECT 1")
                return True
            
            # Create new connection pool
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
            
            # Test the new connection
            async with self.db_pool.acquire() as conn:
                await conn.execute("SELECT 1")
            
            logger.info("✅ Database connection established")
            return True
            
        except Exception as e:
            logger.error(f"Database connection attempt failed: {e}")
            if self.db_pool:
                try:
                    await self.db_pool.close()
                except:
                    pass
                self.db_pool = None
            return False
    
    async def _attempt_redis_connection(self) -> bool:
        """Attempt to establish Redis connection"""
        try:
            if self.redis_client:
                # Test existing connection
                await self.redis_client.ping()
                return True
            
            # Create new connection
            self.redis_client = aioredis.from_url(
                self.redis_url,
                max_connections=10,
                retry_on_timeout=True,
                health_check_interval=30,
                socket_keepalive=True,
                socket_keepalive_options={
                    'keepalives_idle': 30,
                    'keepalives_interval': 10,
                    'keepalives_count': 5
                }
            )
            
            # Test the new connection
            await self.redis_client.ping()
            
            logger.info("✅ Redis connection established")
            return True
            
        except Exception as e:
            logger.error(f"Redis connection attempt failed: {e}")
            if self.redis_client:
                try:
                    await self.redis_client.close()
                except:
                    pass
                self.redis_client = None
            return False
    
    async def _attempt_websocket_connection(self) -> bool:
        """Attempt to establish WebSocket connection"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            # Test WebSocket upgrade capability
            async with self.session.ws_connect(f"{self.api_base_url.replace('http', 'ws')}/ws") as ws:
                # Send ping message
                await ws.send_str('{"type": "ping"}')
                
                # Wait for pong response
                msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
                if msg.type == aiohttp.WSMsgType.TEXT:
                    logger.info("✅ WebSocket connection established")
                    return True
                else:
                    raise Exception(f"Unexpected WebSocket message type: {msg.type}")
                    
        except Exception as e:
            logger.error(f"WebSocket connection attempt failed: {e}")
            return False
    
    async def recover_database_connection(self) -> bool:
        """Recover database connection with exponential backoff retry"""
        logger.info("Attempting database connection recovery...")
        
        for attempt in range(self.max_retry_attempts):
            self.connection_status["database"]["last_attempt"] = time.time()
            
            if await self._attempt_database_connection():
                self.connection_status["database"]["connected"] = True
                self.connection_status["database"]["failures"] = 0
                logger.info("✅ Database connection recovered successfully")
                
                # Call recovery callbacks
                for callback in self.recovery_callbacks:
                    try:
                        await callback("database")
                    except Exception as e:
                        logger.warning(f"Recovery callback failed: {e}")
                
                return True
            
            self.connection_status["database"]["failures"] += 1
            
            if attempt < self.max_retry_attempts - 1:
                delay = await self._calculate_retry_delay(attempt)
                logger.info(f"Database connection attempt {attempt + 1} failed, retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
            else:
                logger.error("❌ Database connection recovery failed after all attempts")
                self.connection_status["database"]["connected"] = False
                return False
        
        return False
    
    async def recover_redis_connection(self) -> bool:
        """Recover Redis connection with exponential backoff retry"""
        logger.info("Attempting Redis connection recovery...")
        
        for attempt in range(self.max_retry_attempts):
            self.connection_status["redis"]["last_attempt"] = time.time()
            
            if await self._attempt_redis_connection():
                self.connection_status["redis"]["connected"] = True
                self.connection_status["redis"]["failures"] = 0
                logger.info("✅ Redis connection recovered successfully")
                
                # Call recovery callbacks
                for callback in self.recovery_callbacks:
                    try:
                        await callback("redis")
                    except Exception as e:
                        logger.warning(f"Recovery callback failed: {e}")
                
                return True
            
            self.connection_status["redis"]["failures"] += 1
            
            if attempt < self.max_retry_attempts - 1:
                delay = await self._calculate_retry_delay(attempt)
                logger.info(f"Redis connection attempt {attempt + 1} failed, retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
            else:
                logger.error("❌ Redis connection recovery failed after all attempts")
                self.connection_status["redis"]["connected"] = False
                return False
        
        return False
    
    async def recover_websocket_connection(self) -> bool:
        """Recover WebSocket connection with exponential backoff retry"""
        logger.info("Attempting WebSocket connection recovery...")
        
        for attempt in range(self.max_retry_attempts):
            self.connection_status["websocket"]["last_attempt"] = time.time()
            
            if await self._attempt_websocket_connection():
                self.connection_status["websocket"]["connected"] = True
                self.connection_status["websocket"]["failures"] = 0
                logger.info("✅ WebSocket connection recovered successfully")
                
                # Call recovery callbacks
                for callback in self.recovery_callbacks:
                    try:
                        await callback("websocket")
                    except Exception as e:
                        logger.warning(f"Recovery callback failed: {e}")
                
                return True
            
            self.connection_status["websocket"]["failures"] += 1
            
            if attempt < self.max_retry_attempts - 1:
                delay = await self._calculate_retry_delay(attempt)
                logger.info(f"WebSocket connection attempt {attempt + 1} failed, retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
            else:
                logger.error("❌ WebSocket connection recovery failed after all attempts")
                self.connection_status["websocket"]["connected"] = False
                return False
        
        return False
    
    async def monitor_and_recover_connections(self):
        """Continuously monitor connections and recover when needed"""
        logger.info("Starting connection recovery monitoring...")
        
        while True:
            try:
                # Check database connection
                if self.db_pool:
                    try:
                        async with self.db_pool.acquire() as conn:
                            await conn.execute("SELECT 1")
                        self.connection_status["database"]["connected"] = True
                    except Exception as e:
                        logger.warning(f"Database connection lost: {e}")
                        self.connection_status["database"]["connected"] = False
                        await self.recover_database_connection()
                else:
                    await self.recover_database_connection()
                
                # Check Redis connection
                if self.redis_client:
                    try:
                        await self.redis_client.ping()
                        self.connection_status["redis"]["connected"] = True
                    except Exception as e:
                        logger.warning(f"Redis connection lost: {e}")
                        self.connection_status["redis"]["connected"] = False
                        await self.recover_redis_connection()
                else:
                    await self.recover_redis_connection()
                
                # Wait before next check
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except asyncio.CancelledError:
                logger.info("Connection recovery monitoring cancelled")
                break
            except Exception as e:
                logger.error(f"Connection recovery monitoring error: {e}")
                await asyncio.sleep(10)  # Wait before retrying
    
    async def get_connection_status(self) -> Dict[str, Any]:
        """Get current connection status"""
        return {
            "timestamp": time.time(),
            "connections": self.connection_status.copy(),
            "overall_healthy": all(status["connected"] for status in self.connection_status.values())
        }
    
    @asynccontextmanager
    async def get_database_connection(self):
        """Get a database connection with automatic recovery"""
        if not self.connection_status["database"]["connected"]:
            await self.recover_database_connection()
        
        if self.db_pool:
            try:
                async with self.db_pool.acquire() as conn:
                    yield conn
            except Exception as e:
                logger.error(f"Database operation failed: {e}")
                self.connection_status["database"]["connected"] = False
                raise
        else:
            raise Exception("No database connection available")
    
    @asynccontextmanager
    async def get_redis_connection(self):
        """Get a Redis connection with automatic recovery"""
        if not self.connection_status["redis"]["connected"]:
            await self.recover_redis_connection()
        
        if self.redis_client:
            try:
                yield self.redis_client
            except Exception as e:
                logger.error(f"Redis operation failed: {e}")
                self.connection_status["redis"]["connected"] = False
                raise
        else:
            raise Exception("No Redis connection available")
    
    async def close_all_connections(self):
        """Close all connections"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        if self.session:
            await self.session.close()
        logger.info("All connections closed")

# Global connection recovery manager instance
connection_manager = ConnectionRecoveryManager()

# Example recovery callback
async def on_connection_recovered(service_name: str):
    """Example callback for when a connection is recovered"""
    logger.info(f"Service {service_name} has been recovered and is now available")

# Register the callback
connection_manager.register_recovery_callback(on_connection_recovered)

async def main():
    """Main entry point for testing"""
    try:
        # Start monitoring
        monitor_task = asyncio.create_task(connection_manager.monitor_and_recover_connections())
        
        # Let it run for a while
        await asyncio.sleep(60)
        
        # Cancel monitoring
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass
            
    except KeyboardInterrupt:
        logger.info("Connection recovery stopped by user")
    finally:
        await connection_manager.close_all_connections()

if __name__ == "__main__":
    asyncio.run(main())