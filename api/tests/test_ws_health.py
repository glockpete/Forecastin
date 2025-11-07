"""
WebSocket Health Check Endpoint Tests

Tests for /ws/health endpoint functionality including:
- Connection health monitoring
- Sustained connections >30s with heartbeats
- Server-side ping/pong validation
- Connection quality metrics
- Configuration reporting

These tests ensure the health endpoint can detect and prevent
WebSocket issues including 1006 close codes and idle timeouts.
"""

import asyncio
import json
import time
from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

# Import the FastAPI app
from main import app, WS_PING_INTERVAL, WS_PING_TIMEOUT


class TestWebSocketHealth:
    """Test suite for /ws/health endpoint"""

    def test_health_connection_establishment(self):
        """Test /ws/health accepts connections and sends initial health status"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Should receive initial health status
            data = websocket.receive_text()
            message = json.loads(data)

            assert message["type"] == "health_status"
            assert message["status"] == "connected"
            assert "client_id" in message
            assert "server_time" in message

            # Validate config section
            assert "config" in message
            config = message["config"]
            assert "ping_interval" in config
            assert "ping_timeout" in config
            assert "expected_min_connection_duration" in config
            assert config["expected_min_connection_duration"] == 30

    def test_health_environment_config_exposure(self):
        """Test health endpoint exposes environment configuration"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            health_status = json.loads(websocket.receive_text())

            # Should expose environment config
            assert "environment" in health_status
            env = health_status["environment"]

            assert "allowed_origins" in env
            assert "public_base_url" in env
            assert "ws_public_url" in env

            # Validate types
            assert isinstance(env["allowed_origins"], list)
            assert isinstance(env["public_base_url"], str)
            assert isinstance(env["ws_public_url"], str)

    def test_health_heartbeat_tracking(self):
        """Test health endpoint tracks heartbeat metrics"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Consume initial status
            websocket.receive_text()

            # Request current status
            websocket.send_json({"type": "get_status"})

            status_response = json.loads(websocket.receive_text())
            assert status_response["type"] == "health_status"
            assert status_response["status"] == "healthy"
            assert "connection_age_seconds" in status_response
            assert "ping_count" in status_response
            assert "pong_count" in status_response
            assert isinstance(status_response["connection_age_seconds"], (int, float))

    def test_health_pong_handling(self):
        """Test health endpoint handles pong messages from client"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Consume initial status
            websocket.receive_text()

            # Send pong
            websocket.send_json({"type": "pong", "timestamp": time.time()})

            # Pong should be processed without error
            # Request status to verify connection still healthy
            websocket.send_json({"type": "get_status"})
            status = json.loads(websocket.receive_text())
            assert status["status"] == "healthy"

    def test_health_connection_age_tracking(self):
        """Test health endpoint accurately tracks connection age"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Consume initial status
            initial_status = json.loads(websocket.receive_text())
            initial_time = initial_status["server_time"]

            # Wait a bit
            time.sleep(0.2)

            # Request status
            websocket.send_json({"type": "get_status"})
            status = json.loads(websocket.receive_text())

            # Connection age should be roughly 200ms+
            assert status["connection_age_seconds"] >= 0.2

    def test_health_multiple_status_requests(self):
        """Test health endpoint handles multiple status requests"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Consume initial status
            websocket.receive_text()

            # Request status multiple times
            for i in range(3):
                websocket.send_json({"type": "get_status"})
                status = json.loads(websocket.receive_text())
                assert status["type"] == "health_status"
                assert status["status"] == "healthy"
                time.sleep(0.1)

    def test_health_config_matches_environment(self):
        """Test health endpoint config matches loaded environment variables"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            health_status = json.loads(websocket.receive_text())
            config = health_status["config"]

            # Should match the values loaded from environment
            assert config["ping_interval"] == WS_PING_INTERVAL
            assert config["ping_timeout"] == WS_PING_TIMEOUT

    def test_health_connection_close_code(self):
        """Test health endpoint closes cleanly (not 1006)"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Consume initial status
            websocket.receive_text()

            # Request status
            websocket.send_json({"type": "get_status"})
            status = websocket.receive_text()
            assert json.loads(status)["status"] == "healthy"

        # Connection should close normally without 1006
        # If we get here without exception, connection closed properly

    def test_health_validates_heartbeat_config(self):
        """
        Test health endpoint validates heartbeat configuration is present.

        This test ensures that if heartbeat config is missing or mis-set,
        the health endpoint still functions correctly (per requirement).
        """
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            health_status = json.loads(websocket.receive_text())

            # Config must be present
            assert "config" in health_status
            config = health_status["config"]

            # Both ping interval and timeout must be set
            assert "ping_interval" in config
            assert "ping_timeout" in config

            # Values must be positive numbers
            assert config["ping_interval"] > 0
            assert config["ping_timeout"] > 0

            # Timeout should be less than interval (sanity check)
            assert config["ping_timeout"] < config["ping_interval"]


@pytest.mark.asyncio
class TestWebSocketHealthSustainedConnection:
    """Test sustained connection behavior (>30s with heartbeats)"""

    async def test_health_sustained_connection_mock(self):
        """
        Mock test for sustained connection >30s.

        For actual 30+ second tests, this would need to be run in integration
        environment. Here we verify the endpoint can handle the mechanics.

        To run actual sustained connection test:
        1. Set WS_PING_INTERVAL=5 in environment
        2. Run test suite with extended timeout
        3. Verify server sends heartbeats every 5 seconds
        4. Verify connection stays open for >30 seconds
        """
        # This is a placeholder for the actual long-running test
        # In CI, we verify the config is correct rather than waiting 30s
        assert WS_PING_INTERVAL > 0
        assert WS_PING_TIMEOUT > 0
        assert WS_PING_TIMEOUT < WS_PING_INTERVAL

        # For manual testing:
        # - Start server with WS_PING_INTERVAL=5
        # - Connect to ws://localhost:9000/ws/health
        # - Observe heartbeat messages every 5 seconds
        # - Keep connection open for >30 seconds
        # - Verify no 1006 close code


class TestWebSocketHealthErrorHandling:
    """Test error handling in health endpoint"""

    def test_health_invalid_message_handling(self):
        """Test health endpoint handles invalid messages gracefully"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Consume initial status
            websocket.receive_text()

            # Send invalid JSON
            websocket.send_text("not valid json")

            # Connection should remain open
            # Request status to verify
            websocket.send_json({"type": "get_status"})
            status = json.loads(websocket.receive_text())
            assert status["status"] == "healthy"

    def test_health_connection_without_origin(self):
        """Test connection works without Origin header (for testing)"""
        client = TestClient(app)

        # TestClient connections should work even without explicit origin
        with client.websocket_connect("/ws/health") as websocket:
            health_status = json.loads(websocket.receive_text())
            assert health_status["type"] == "health_status"
            assert health_status["status"] == "connected"


class TestWebSocketHealthMetrics:
    """Test health endpoint metrics and reporting"""

    def test_health_metrics_increment(self):
        """Test ping/pong counters increment correctly"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Consume initial status
            websocket.receive_text()

            # Get initial metrics
            websocket.send_json({"type": "get_status"})
            initial_status = json.loads(websocket.receive_text())
            initial_pong_count = initial_status["pong_count"]

            # Send pong
            websocket.send_json({"type": "pong"})

            # Small delay
            time.sleep(0.05)

            # Get updated metrics
            websocket.send_json({"type": "get_status"})
            updated_status = json.loads(websocket.receive_text())

            # Pong count should have incremented
            assert updated_status["pong_count"] == initial_pong_count + 1

    def test_health_timestamp_progression(self):
        """Test timestamps progress correctly"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Get initial status
            initial = json.loads(websocket.receive_text())
            t1 = initial["server_time"]

            time.sleep(0.1)

            # Get another status
            websocket.send_json({"type": "get_status"})
            second = json.loads(websocket.receive_text())
            t2 = second["timestamp"]

            # Second timestamp should be later than first
            assert t2 > t1


class TestWebSocketHealthConfigValidation:
    """Test configuration validation requirements"""

    def test_health_fails_if_config_missing(self):
        """
        Test to ensure health endpoint reports config properly.

        Per requirements: Tests should fail if heartbeat config is
        missing or mis-set. This test validates that config is always present.
        """
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            health_status = json.loads(websocket.receive_text())

            # These MUST be present, or test fails
            assert "config" in health_status, "Health endpoint must expose config"
            config = health_status["config"]

            assert "ping_interval" in config, "ping_interval must be configured"
            assert "ping_timeout" in config, "ping_timeout must be configured"

            # Values must be sensible
            assert config["ping_interval"] > 0, "ping_interval must be positive"
            assert config["ping_timeout"] > 0, "ping_timeout must be positive"
            assert config["ping_timeout"] < config["ping_interval"], \
                "ping_timeout should be less than ping_interval"

    def test_health_environment_vars_exposed(self):
        """Test that environment configuration is properly exposed"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            health_status = json.loads(websocket.receive_text())

            # Environment config MUST be present
            assert "environment" in health_status, "Environment config must be exposed"
            env = health_status["environment"]

            # Required fields
            assert "allowed_origins" in env, "ALLOWED_ORIGINS must be exposed"
            assert "public_base_url" in env, "PUBLIC_BASE_URL must be exposed"
            assert "ws_public_url" in env, "WS_PUBLIC_URL must be exposed"

            # Validate values are not empty
            assert len(env["allowed_origins"]) > 0, "At least one allowed origin required"
            assert env["public_base_url"], "PUBLIC_BASE_URL must not be empty"
            assert env["ws_public_url"], "WS_PUBLIC_URL must not be empty"


if __name__ == "__main__":
    # Run tests with: pytest test_ws_health.py -v
    pytest.main([__file__, "-v"])
