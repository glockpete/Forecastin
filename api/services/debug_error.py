"""
Debug the error handling in safe_serialize_message
"""

import json
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from websocket_manager import safe_serialize_message


class BadObject:
    def __getattr__(self, name):
        if name == "__dict__":
            raise Exception("Cannot serialize")
        raise AttributeError(name)

message = BadObject()
result = safe_serialize_message(message)

print("Raw result:", repr(result))
print("Parsed result:", json.loads(result))
