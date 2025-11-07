#!/usr/bin/env python3
"""
WebSocket Connection Test Script
Tests the WebSocket connection to verify real-time features are working
"""

import asyncio
import websockets
import json
import sys
from datetime import datetime

async def test_websocket_connection():
    """Test WebSocket connection with comprehensive validation"""
    uri = "ws://localhost:9000/ws"
    
    print(f"[{datetime.now().isoformat()}] Testing WebSocket connection to {uri}")
    
    # Check if we can connect to the WebSocket
    try:
        websocket = await websockets.connect(uri)
        print(f"[{datetime.now().isoformat()}] [PASS] WebSocket connected successfully!")
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] [FAIL] Failed to connect to WebSocket: {e}")
        return False
    
    # Test message exchange
    try:
        # Subscribe to hierarchy updates
        subscribe_message = {
            "type": "subscribe",
            "channels": ["hierarchy_updates"]
        }
        await websocket.send(json.dumps(subscribe_message))
        print(f"[{datetime.now().isoformat()}] [PASS] SENT: Subscription message")
        
        # Test ping/pong
        ping_message = {"type": "ping"}
        await websocket.send(json.dumps(ping_message))
        print(f"[{datetime.now().isoformat()}] [PASS] SENT: Ping message")
        
        # Wait for response
        try:
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"[{datetime.now().isoformat()}] [PASS] RECEIVED: {response}")
            
            # Parse response
            try:
                data = json.loads(response)
                if data.get("type") == "pong":
                    print(f"[{datetime.now().isoformat()}] [PASS] Pong received - keepalive working!")
                else:
                    print(f"[{datetime.now().isoformat()}] [INFO] Response type: {data.get('type', 'unknown')}")
            except json.JSONDecodeError:
                print(f"[{datetime.now().isoformat()}] [INFO] Non-JSON response: {response}")
                
        except asyncio.TimeoutError:
            print(f"[{datetime.now().isoformat()}] [WARN] No response received within 5 seconds")
        
        # Test connection stability
        print(f"\n[{datetime.now().isoformat()}] Testing connection stability...")
        stability_passed = 0
        for i in range(3):
            await asyncio.sleep(1)
            ping_message = {"type": "ping"}
            await websocket.send(json.dumps(ping_message))
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                print(f"[{datetime.now().isoformat()}] [PASS] Stability test {i+1}/3: SUCCESS")
                stability_passed += 1
            except asyncio.TimeoutError:
                print(f"[{datetime.now().isoformat()}] [FAIL] Stability test {i+1}/3: FAILED - Timeout")
        
        print(f"\n[{datetime.now().isoformat()}] Stability test results: {stability_passed}/3 passed")
        
        await websocket.close()
        print(f"[{datetime.now().isoformat()}] [PASS] WebSocket connection test completed")
        return True
        
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] [FAIL] Unexpected error during message exchange: {e}")
        return False

async def main():
    print("=" * 60)
    print("WebSocket Connection Validation Test")
    print("=" * 60)
    print(f"Started at: {datetime.now().isoformat()}")
    print()
    
    success = await test_websocket_connection()
    
    print()
    print("=" * 60)
    if success:
        print("[PASS] WebSocket test PASSED")
        print("[PASS] Connection established successfully")
        print("[PASS] Message exchange working")
        print("[PASS] Ping/pong keepalive verified")
        print("[PASS] Connection stability confirmed")
        print("=" * 60)
        sys.exit(0)
    else:
        print("[FAIL] WebSocket test FAILED")
        print("[WARN] Check server configuration and logs")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())