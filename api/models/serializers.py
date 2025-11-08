"""
Message Serialization Utilities
Handles safe serialization of WebSocket messages with orjson
"""

import logging
import time
from typing import Dict, Any

import orjson

logger = logging.getLogger(__name__)


def safe_serialize_message(message: Dict[str, Any]) -> str:
    """
    CRITICAL: Safe serialization using orjson for WebSocket payloads
    Handles datetime/dataclass objects that crash standard json.dumps
    Implements serialization error handling to prevent WebSocket connection crashes
    """
    try:
        # Use orjson for efficient and safe serialization
        return orjson.dumps(message, option=orjson.OPT_NON_STR_KEYS).decode('utf-8')
    except Exception as e:
        logger.error(f"Serialization error: {e}")
        # Return structured error message instead of crashing
        error_response = {
            "type": "serialization_error",
            "error": str(e),
            "timestamp": time.time()
        }
        return orjson.dumps(error_response).decode('utf-8')
