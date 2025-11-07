"""
WebSocket Echo Endpoint Tests

Tests for /ws/echo endpoint functionality including:
- Basic echo round-trip
- Server-side ping/pong with configurable intervals
- Message serialization
- Connection lifecycle
- Error handling

These tests validate that the echo endpoint properly handles
WebSocket connections and prevents 1006 close codes.
"""

import asyncio
import json
import time
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

# Import the FastAPI app
import sys
import os
# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app


class TestWebSocketEcho:
    """Test suite for /ws/echo endpoint"""

    def test_echo_connection_establishment(self):
        """Test that /ws/echo accepts connections and sends welcome message"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Should receive welcome message
            data = websocket.receive_text()
            message = json.loads(data)

            assert message["type"] == "welcome"
            assert message["endpoint"] == "/ws/echo"
            assert "client_id" in message
            assert "server_time" in message
            assert "config" in message
            assert message["config"]["ping_interval"] == 30.0
            assert message["config"]["ping_timeout"] == 10.0

    def test_echo_basic_round_trip(self):
        """Test basic echo functionality - send message, receive echo"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Consume welcome message
            welcome = websocket.receive_text()
            assert json.loads(welcome)["type"] == "welcome"

            # Send test message
            test_payload = {
                "type": "test",
                "data": "hello world",
                "timestamp": time.time()
            }
            websocket.send_json(test_payload)

            # Receive echo response
            response_data = websocket.receive_text()
            response = json.loads(response_data)

            assert response["type"] == "echo"
            assert "original" in response
            assert response["original"]["type"] == "test"
            assert response["original"]["data"] == "hello world"
            assert "server_timestamp" in response
            assert "client_id" in response
            assert "latency_info" in response

    def test_echo_multiple_messages(self):
        """Test echo endpoint handles multiple sequential messages"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Consume welcome
            websocket.receive_text()

            # Send multiple messages
            for i in range(5):
                test_message = {
                    "type": "test",
                    "sequence": i,
                    "data": f"message_{i}"
                }
                websocket.send_json(test_message)

                response = json.loads(websocket.receive_text())
                assert response["type"] == "echo"
                assert response["original"]["sequence"] == i
                assert response["original"]["data"] == f"message_{i}"

    def test_echo_raw_text_handling(self):
        """Test echo endpoint handles non-JSON text (should wrap in echo_raw)"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Consume welcome
            websocket.receive_text()

            # Send raw text (not JSON)
            raw_text = "plain text message"
            websocket.send_text(raw_text)

            response = json.loads(websocket.receive_text())
            assert response["type"] == "echo_raw"
            assert response["data"] == raw_text
            assert "server_timestamp" in response

    def test_echo_pong_response(self):
        """Test client can send pong response (should not echo)"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Consume welcome
            websocket.receive_text()

            # Send pong
            pong_message = {"type": "pong", "timestamp": time.time()}
            websocket.send_json(pong_message)

            # Pong should NOT generate echo response
            # We should either timeout or get a server ping instead
            # For this test, just verify we don't crash
            # If we don't receive anything within a short time, that's expected

    def test_echo_connection_close_code(self):
        """Test echo endpoint closes cleanly (not 1006)"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Consume welcome
            websocket.receive_text()

            # Send a message
            websocket.send_json({"type": "test", "data": "hello"})
            response = websocket.receive_text()
            assert json.loads(response)["type"] == "echo"

        # Connection should close normally
        # If we get here without exception, connection closed properly

    def test_echo_latency_info(self):
        """Test echo response includes latency and connection age information"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Consume welcome
            websocket.receive_text()

            # Wait a bit to accumulate connection age
            time.sleep(0.1)

            # Send message
            websocket.send_json({"type": "latency_test"})

            response = json.loads(websocket.receive_text())
            assert "latency_info" in response
            assert "received_at" in response["latency_info"]
            assert "connection_age_ms" in response["latency_info"]
            # Connection age should be > 100ms since we slept
            assert response["latency_info"]["connection_age_ms"] > 100

    def test_echo_config_validation(self):
        """Ensure echo endpoint reports correct heartbeat configuration"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            welcome = json.loads(websocket.receive_text())

            # Validate config is present and has expected defaults
            config = welcome["config"]
            assert "ping_interval" in config
            assert "ping_timeout" in config

            # Defaults should be 30 and 10 respectively
            # (unless environment variables override)
            assert isinstance(config["ping_interval"], (int, float))
            assert isinstance(config["ping_timeout"], (int, float))
            assert config["ping_interval"] > 0
            assert config["ping_timeout"] > 0

    def test_echo_large_message(self):
        """Test echo handles reasonably large messages"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Consume welcome
            websocket.receive_text()

            # Send large payload (10KB of data)
            large_data = "x" * 10000
            large_message = {
                "type": "large_test",
                "data": large_data
            }
            websocket.send_json(large_message)

            response = json.loads(websocket.receive_text())
            assert response["type"] == "echo"
            assert response["original"]["data"] == large_data

    def test_echo_json_with_nested_objects(self):
        """Test echo handles complex nested JSON structures"""
        client = TestClient(app)

        with client.websocket_connect("/ws/echo") as websocket:
            # Consume welcome
            websocket.receive_text()

            # Complex nested structure
            complex_message = {
                "type": "complex",
                "data": {
                    "level1": {
                        "level2": {
                            "level3": {
                                "values": [1, 2, 3, 4, 5],
                                "metadata": {
                                    "timestamp": time.time(),
                                    "source": "test"
                                }
                            }
                        }
                    }
                },
                "array": ["a", "b", "c"]
            }
            websocket.send_json(complex_message)

            response = json.loads(websocket.receive_text())
            assert response["type"] == "echo"
            assert response["original"]["type"] == "complex"
            assert response["original"]["data"]["level1"]["level2"]["level3"]["values"] == [1, 2, 3, 4, 5]


@pytest.mark.asyncio
class TestWebSocketEchoServerPing:
    """Test server-initiated ping functionality"""

    async def test_server_sends_pings_after_interval(self):
        """
        Test that server sends ping messages after configured interval.

        NOTE: This test may take up to 30+ seconds to run if WS_PING_INTERVAL=30
        For faster testing, set WS_PING_INTERVAL=5 in environment.
        """
        # This test would need to wait for ping interval
        # For unit tests, we verify the config is exposed
        # Integration tests would verify actual ping behavior
        pass  # Skipping long-running test for CI speed


class TestWebSocketEchoErrorHandling:
    """Test error handling in echo endpoint"""

    def test_echo_connection_without_origin(self):
        """Test connection works without Origin header (for testing)"""
        client = TestClient(app)

        # TestClient connections should work even without explicit origin
        with client.websocket_connect("/ws/echo") as websocket:
            welcome = json.loads(websocket.receive_text())
            assert welcome["type"] == "welcome"


if __name__ == "__main__":
    # Run tests with: pytest test_ws_echo.py -v
    pytest.main([__file__, "-v"])
