#!/usr/bin/env python3
"""
Generate WebSocket Contract JSON Schema from Pydantic Models
Outputs to: contracts/ws.json

Usage:
    python scripts/generate_ws_contract.py
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add api directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'api'))

def generate_ws_contract():
    """Generate WebSocket contract JSON schema from Pydantic models"""
    try:
        from models.websocket_schemas import (
            WebSocketMessage,
            PingMessage,
            PongMessage,
            LayerDataUpdateMessage,
            GPUFilterSyncMessage,
            ErrorMessage,
            EchoMessage,
            LayerDataUpdatePayload,
            GPUFilterSyncPayload,
            MessageType,
            LayerType,
            FilterType,
            FilterStatus,
            BoundingBox,
            GeoJSONFeature,
            FeatureCollection,
            PointGeometry,
            LineStringGeometry,
            PolygonGeometry,
            MultiPolygonGeometry,
            MultiLineStringGeometry
        )

        # Generate JSON schemas for each message type
        schemas = {
            "version": "1.0.0",
            "generated": datetime.now().isoformat(),
            "description": "WebSocket message contracts for Forecastin platform",
            "schemas": {
                # Message types
                "PingMessage": PingMessage.model_json_schema(),
                "PongMessage": PongMessage.model_json_schema(),
                "LayerDataUpdateMessage": LayerDataUpdateMessage.model_json_schema(),
                "GPUFilterSyncMessage": GPUFilterSyncMessage.model_json_schema(),
                "ErrorMessage": ErrorMessage.model_json_schema(),
                "EchoMessage": EchoMessage.model_json_schema(),

                # Payloads
                "LayerDataUpdatePayload": LayerDataUpdatePayload.model_json_schema(),
                "GPUFilterSyncPayload": GPUFilterSyncPayload.model_json_schema(),

                # Geometry types
                "PointGeometry": PointGeometry.model_json_schema(),
                "LineStringGeometry": LineStringGeometry.model_json_schema(),
                "PolygonGeometry": PolygonGeometry.model_json_schema(),
                "MultiPolygonGeometry": MultiPolygonGeometry.model_json_schema(),
                "MultiLineStringGeometry": MultiLineStringGeometry.model_json_schema(),
                "GeoJSONFeature": GeoJSONFeature.model_json_schema(),
                "FeatureCollection": FeatureCollection.model_json_schema(),

                # Base types
                "BoundingBox": BoundingBox.model_json_schema(),
            },
            "enums": {
                "MessageType": {
                    "type": "string",
                    "enum": [e.value for e in MessageType],
                    "description": "WebSocket message types"
                },
                "LayerType": {
                    "type": "string",
                    "enum": [e.value for e in LayerType],
                    "description": "Supported layer types"
                },
                "FilterType": {
                    "type": "string",
                    "enum": [e.value for e in FilterType],
                    "description": "Filter types"
                },
                "FilterStatus": {
                    "type": "string",
                    "enum": [e.value for e in FilterStatus],
                    "description": "Filter status values"
                }
            }
        }

        output_file = Path(__file__).parent.parent / 'contracts' / 'ws.json'

        with open(output_file, 'w') as f:
            json.dump(schemas, f, indent=2)

        print(f"✅ WebSocket contract generated: {output_file}")
        print(f"   Version: {schemas['version']}")
        print(f"   Schemas: {len(schemas['schemas'])}")
        print(f"   Enums: {len(schemas['enums'])}")

        return output_file

    except ImportError as e:
        print(f"❌ Error importing WebSocket schemas: {e}")
        print("   Make sure pydantic is installed:")
        print("   pip install pydantic")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error generating WebSocket contract: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    generate_ws_contract()
