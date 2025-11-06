#!/usr/bin/env python3
"""
Test script to validate WebSocket UI wiring for layer updates and GPU filter sync.

This script sends valid WebSocket messages to test the frontend handlers:
- layer_data_update with FeatureCollection payloads
- gpu_filter_sync when filters change

Messages follow the documented schemas from docs/WEBSOCKET_LAYER_MESSAGES.md
"""

import asyncio
import websockets
import json
import time
from typing import Dict, Any


async def send_layer_data_update(websocket) -> None:
    """Send a layer_data_update message with sample point data."""
    message = {
        "type": "layer_data_update",
        "data": {
            "layer_id": "test-point-layer-001",
            "layer_type": "point",
            "layer_data": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [139.6917, 35.6895]  # Tokyo
                        },
                        "properties": {
                            "name": "Tokyo Headquarters",
                            "type": "headquarters",
                            "population": 13960000,
                            "confidence": 0.95,
                            "status": "active"
                        }
                    },
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [126.9780, 37.5665]  # Seoul
                        },
                        "properties": {
                            "name": "Seoul Office",
                            "type": "office",
                            "population": 9776000,
                            "confidence": 0.87,
                            "status": "active"
                        }
                    }
                ]
            },
            "bbox": {
                "minLat": 35.0,
                "maxLat": 38.0,
                "minLng": 126.0,
                "maxLng": 140.0
            },
            "changed_at": time.time()
        },
        "timestamp": time.time()
    }
    
    await websocket.send(json.dumps(message))
    print(f"Sent layer_data_update message: {message['data']['layer_id']}")
    print(f"  Features: {len(message['data']['layer_data']['features'])}")
    print(f"  BBox: {message['data']['bbox']}")


async def send_polygon_layer_data_update(websocket) -> None:
    """Send a layer_data_update message with sample polygon data."""
    message = {
        "type": "layer_data_update",
        "data": {
            "layer_id": "test-polygon-layer-001",
            "layer_type": "polygon",
            "layer_data": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[
                                [139.0, 35.0],
                                [140.0, 35.0],
                                [140.0, 36.0],
                                [139.0, 36.0],
                                [139.0, 35.0]
                            ]]
                        },
                        "properties": {
                            "name": "Tokyo Metropolitan Area",
                            "type": "metropolitan",
                            "area_km2": 13400,
                            "confidence": 0.92,
                            "population": 37000000
                        }
                    }
                ]
            },
            "bbox": {
                "minLat": 35.0,
                "maxLat": 36.0,
                "minLng": 139.0,
                "maxLng": 140.0
            },
            "changed_at": time.time()
        },
        "timestamp": time.time()
    }
    
    await websocket.send(json.dumps(message))
    print(f"Sent polygon layer_data_update message: {message['data']['layer_id']}")


async def send_gpu_filter_sync(websocket) -> None:
    """Send a gpu_filter_sync message with sample filter data."""
    message = {
        "type": "gpu_filter_sync",
        "data": {
            "filter_id": "test-spatial-filter-001",
            "filter_type": "spatial",
            "filter_params": {
                "bounds": {
                    "minLat": 35.5,
                    "maxLat": 36.0,
                    "minLng": 139.5,
                    "maxLng": 140.0
                },
                "filterMode": "inclusive"
            },
            "affected_layers": [
                "test-point-layer-001",
                "test-polygon-layer-001"
            ],
            "status": "applied",
            "changed_at": time.time()
        },
        "timestamp": time.time()
    }
    
    await websocket.send(json.dumps(message))
    print(f"Sent gpu_filter_sync message: {message['data']['filter_id']}")
    print(f"  Type: {message['data']['filter_type']}")
    print(f"  Status: {message['data']['status']}")
    print(f"  Affected layers: {message['data']['affected_layers']}")


async def send_clear_filter(websocket) -> None:
    """Send a gpu_filter_sync message to clear a filter."""
    message = {
        "type": "gpu_filter_sync",
        "data": {
            "filter_id": "test-spatial-filter-001",
            "filter_type": "spatial",
            "filter_params": {},
            "affected_layers": [
                "test-point-layer-001"
            ],
            "status": "cleared",
            "changed_at": time.time()
        },
        "timestamp": time.time()
    }
    
    await websocket.send(json.dumps(message))
    print(f"Sent filter clear message: {message['data']['filter_id']}")


async def test_websocket_messages():
    """Test WebSocket message emission to validate UI wiring."""
    uri = "ws://localhost:9000/ws"
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"Connected to WebSocket at {uri}")
            
            # Send a layer data update message
            await send_layer_data_update(websocket)
            await asyncio.sleep(1)  # Wait a moment between messages
            
            # Send a polygon layer data update message
            await send_polygon_layer_data_update(websocket)
            await asyncio.sleep(1)
            
            # Send a GPU filter sync message
            await send_gpu_filter_sync(websocket)
            await asyncio.sleep(1)
            
            # Send a filter clear message
            await send_clear_filter(websocket)
            await asyncio.sleep(1)
            
            print("\nAll test messages sent successfully!")
            print("Check the browser console to verify frontend handler processing.")
            
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"WebSocket connection closed unexpectedly: {e}")
    except websockets.exceptions.InvalidURI as e:
        print(f"Invalid WebSocket URI: {e}")
    except Exception as e:
        print(f"Error during WebSocket communication: {e}")


if __name__ == "__main__":
    print("Forecastin WebSocket UI Wiring Test")
    print("=" * 40)
    print("This script sends test messages to validate WebSocket -> UI integration")
    print()
    
    asyncio.run(test_websocket_messages())