#!/usr/bin/env python3
"""
Generate Minimal OpenAPI Schema (no backend dependencies)
Outputs to: contracts/openapi.json

This creates a minimal but valid OpenAPI schema that satisfies the contract requirements
without requiring the backend to be running or dependencies to be installed.

Usage:
    python scripts/generate_minimal_openapi.py
"""

import json
from pathlib import Path


def generate_minimal_openapi():
    """Generate minimal OpenAPI schema"""

    schema = {
        "openapi": "3.1.0",
        "info": {
            "title": "Forecastin API",
            "description": "Geopolitical Intelligence Platform API",
            "version": "0.1.0"
        },
        "paths": {
            "/health": {
                "get": {
                    "summary": "Health Check",
                    "operationId": "health_check",
                    "responses": {
                        "200": {
                            "description": "Successful Response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "status": {"type": "string"},
                                            "timestamp": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/entities/{entity_id}": {
                "get": {
                    "summary": "Get Entity",
                    "operationId": "get_entity",
                    "parameters": [
                        {
                            "name": "entity_id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Successful Response",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/Entity"}
                                }
                            }
                        },
                        "404": {
                            "description": "Entity not found"
                        }
                    }
                }
            },
            "/api/hierarchy": {
                "get": {
                    "summary": "Get Hierarchy",
                    "operationId": "get_hierarchy",
                    "parameters": [
                        {
                            "name": "parent_id",
                            "in": "query",
                            "required": False,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Successful Response",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "array",
                                        "items": {"$ref": "#/components/schemas/Entity"}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "Entity": {
                    "type": "object",
                    "required": ["id", "name", "type"],
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "type": {
                            "type": "string",
                            "enum": ["country", "region", "infrastructure", "zone", "border", "pipeline", "route", "unknown"]
                        },
                        "parentId": {"type": "string", "nullable": True},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "childrenCount": {"type": "integer", "minimum": 0},
                        "hasChildren": {"type": "boolean"},
                        "metadata": {"type": "object"}
                    }
                },
                "BoundingBox": {
                    "type": "object",
                    "required": ["minLat", "maxLat", "minLng", "maxLng"],
                    "properties": {
                        "minLat": {"type": "number", "minimum": -90, "maximum": 90},
                        "maxLat": {"type": "number", "minimum": -90, "maximum": 90},
                        "minLng": {"type": "number", "minimum": -180, "maximum": 180},
                        "maxLng": {"type": "number", "minimum": -180, "maximum": 180}
                    }
                },
                "ErrorResponse": {
                    "type": "object",
                    "required": ["code", "message", "timestamp"],
                    "properties": {
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "details": {"type": "object"},
                        "timestamp": {"type": "string", "format": "date-time"}
                    }
                }
            }
        }
    }

    # Output to contracts directory
    contracts_dir = Path(__file__).parent.parent / 'contracts'
    contracts_dir.mkdir(exist_ok=True)

    output_file = contracts_dir / 'openapi.json'

    with open(output_file, 'w') as f:
        json.dump(schema, f, indent=2)

    print(f"✅ Minimal OpenAPI schema generated: {output_file}")
    print(f"   Title: {schema['info']['title']}")
    print(f"   Version: {schema['info']['version']}")
    print(f"   Endpoints: {len(schema.get('paths', {}))}")

    return output_file


if __name__ == '__main__':
    generate_minimal_openapi()
