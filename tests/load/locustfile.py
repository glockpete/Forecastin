"""
Locust load testing configuration for Forecastin API.
Tests API throughput and performance under load.
"""

from locust import HttpUser, task, between


class ForecastinUser(HttpUser):
    """Simulated user for load testing."""

    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    host = "http://localhost:9000"

    @task(3)
    def health_check(self):
        """Test health endpoint (high frequency)."""
        self.client.get("/health")

    @task(2)
    def api_root(self):
        """Test API root endpoint."""
        self.client.get("/")

    @task(1)
    def websocket_info(self):
        """Test WebSocket info endpoint."""
        self.client.get("/ws")

    def on_start(self):
        """Called when a simulated user starts."""
        # Perform any setup here (login, etc.)
        pass
