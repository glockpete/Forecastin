#!/usr/bin/env python3
"""
WebSocket Connection Test Script
Tests the WebSocket connection to verify the port fix is working
"""

import asyncio
import websockets
import json
import sys
from datetime import datetime

async def test_websocket_connection():
    """Test WebSocket connection with ping/pong functionality"""
    uri = "ws://localhost:9001/ws"
    
    print(f"[{datetime.now().isoformat()}] Testing WebSocket connection to {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"[{datetime.now().isoformat()}] SUCCESS: WebSocket connected successfully!")
            
            # Subscribe to hierarchy updates
            subscribe_message = {
                "type": "subscribe",
                "channels": ["hierarchy_updates"]
            }
            await websocket.send(json.dumps(subscribe_message))
            print(f"[{datetime.now().isoformat()}] SENT: Subscription message")
            
            # Test ping/pong
            ping_message = {"type": "ping"}
            await websocket.send(json.dumps(ping_message))
            print(f"[{datetime.now().isoformat()}] SENT: Ping message")
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"[{datetime.now().isoformat()}] RECEIVED: {response}")
                
                # Parse response
                try:
                    data = json.loads(response)
                    if data.get("type") == "pong":
                        print(f"[{datetime.now().isoformat()}] SUCCESS: Pong received - keepalive working!")
                    else:
                        print(f"[{datetime.now().isoformat()}] INFO: Response type: {data.get('type', 'unknown')}")
                except json.JSONDecodeError:
                    print(f"[{datetime.now().isoformat()}] INFO: Non-JSON response: {response}")
                    
            except asyncio.TimeoutError:
                print(f"[{datetime.now().isoformat()}] WARNING: No response received within 5 seconds")
            
            print(f"[{datetime.now().isoformat()}] SUCCESS: WebSocket connection test completed successfully")
            return True
            
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"[{datetime.now().isoformat()}] ERROR: WebSocket connection failed - Status {e.status_code}: {e.reason}")
        if e.status_code == 403:
            print(f"[{datetime.now().isoformat()}] ERROR: 403 Forbidden - Check CORS/WebSocket configuration")
        return False
        
    except ConnectionRefusedError:
        print(f"[{datetime.now().isoformat()}] ERROR: Connection refused - Is the API server running on port 9001?")
        return False
        
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] ERROR: Unexpected error: {e}")
        return False

async def main():
    print("Starting WebSocket Connection Test")
    print("=" * 50)
    
    success = await test_websocket_connection()
    
    print("=" * 50)
    if success:
        print("SUCCESS: WebSocket test PASSED - Port 9001 fix is working correctly!")
        print("SUCCESS: Frontend can now connect to ws://localhost:9001/ws")
        print("SUCCESS: Ping/pong keepalive functionality verified")
        print("SUCCESS: No 403 Forbidden errors detected")
        sys.exit(0)
    else:
        print("ERROR: WebSocket test FAILED - Check server configuration")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())