#!/usr/bin/env python3
"""
WebSocket connectivity test for Forecastin Docker networking fix.
Tests the corrected WebSocket URL from frontend to backend.
"""

import asyncio
import websockets
import json
import time
import sys
from datetime import datetime

async def test_websocket_connection():
    """Test WebSocket connection with corrected Docker networking"""
    
    # Test the original problematic URL (should fail)
    problematic_url = "ws://localhost:9000/ws/test-client"
    print(f"Testing problematic URL (should fail): {problematic_url}")
    
    try:
        async with websockets.connect(problematic_url) as websocket:
            print("ERROR: Connection should have failed but succeeded!")
            return False
    except Exception as e:
        print(f"Expected failure: {str(e)[:100]}...")
    
    # Test the correct Docker network URL
    correct_url = "ws://localhost:9000/ws/test-client"
    print(f"\nTesting correct URL (should succeed): {correct_url}")
    
    try:
        start_time = time.time()
        async with websockets.connect(correct_url, timeout=10) as websocket:
            connection_time = (time.time() - start_time) * 1000
            print(f"WebSocket connection successful! Time: {connection_time:.2f}ms")
            
            # Send test message
            test_message = {
                "type": "connection_test",
                "timestamp": datetime.now().isoformat(),
                "client_id": "test-script"
            }
            
            await websocket.send(json.dumps(test_message))
            print(f"Sent message: {test_message}")
            
            # Receive echo response
            response = await websocket.recv()
            response_data = json.loads(response)
            print(f"Received response: {response_data}")
            
            # Verify response structure
            if response_data.get("type") == "echo":
                print("Echo response received correctly")
                return True
            else:
                print(f"Unexpected response type: {response_data.get('type')}")
                return False
                
    except Exception as e:
        print(f"Connection failed: {str(e)}")
        return False

async def test_websocket_statistics():
    """Test WebSocket statistics endpoint"""
    print(f"\nTesting WebSocket statistics...")
    
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:9000/health") as response:
                health_data = await response.json()
                
                websocket_stats = health_data.get("services", {}).get("websocket", "")
                print(f"WebSocket stats: {websocket_stats}")
                
                # Check if WebSocket service is active
                if "active:" in websocket_stats:
                    active_connections = websocket_stats.split("active: ")[1]
                    print(f"Active WebSocket connections: {active_connections}")
                    return True
                else:
                    print("WebSocket service not responding correctly")
                    return False
                    
    except Exception as e:
        print(f"Stats request failed: {str(e)}")
        return False

async def main():
    """Main test execution"""
    print("Testing Forecastin WebSocket Connectivity")
    print("=" * 50)
    
    # Test 1: WebSocket connection
    connection_test = await test_websocket_connection()
    
    # Test 2: WebSocket statistics
    stats_test = await test_websocket_statistics()
    
    print("\n" + "=" * 50)
    print("TEST RESULTS SUMMARY:")
    print(f"   WebSocket Connection: {'PASS' if connection_test else 'FAIL'}")
    print(f"   WebSocket Statistics: {'PASS' if stats_test else 'FAIL'}")
    
    if connection_test and stats_test:
        print("\nALL TESTS PASSED! WebSocket connectivity is working correctly.")
        print("   Docker networking fix successful")
        print("   Frontend-to-backend WebSocket communication established")
        return True
    else:
        print("\nSOME TESTS FAILED! Check the output above for details.")
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nTest failed with exception: {e}")
        sys.exit(1)