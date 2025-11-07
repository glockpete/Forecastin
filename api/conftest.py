"""
Pytest configuration for WebSocket and API tests

This file ensures proper Python path setup for all tests.
"""

import sys
from pathlib import Path

# Add the api directory to Python path to enable imports
api_dir = Path(__file__).parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))
