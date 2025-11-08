#!/usr/bin/env python3
"""
Generate OpenAPI Schema from FastAPI Application (Minimal Version)
Outputs to: contracts/openapi.json

This version attempts to generate the schema with minimal dependencies.
If full app import fails, it generates a minimal schema structure.

Usage:
    python scripts/generate_openapi_minimal.py
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Add api directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'api'))

def generate_minimal_openapi():
    """Generate a minimal OpenAPI schema when full app cannot be imported"""
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Forecastin Geopolitical Intelligence Platform API",
            "version": "1.0.0",
            "description": "FastAPI backend for geopolitical forecasting with STEEP analysis framework",
            "contact": {
                "name": "Forecastin Team"
            }
        },
        "servers": [
            {
                "url": "http://localhost:8000",
                "description": "Local development server"
            },
            {
                "url": "https://api.forecastin.app",
                "description": "Production server"
            }
        ],
        "paths": {
            "/health": {
                "get": {
                    "summary": "Health Check",
                    "description": "Check if the API is running",
                    "responses": {
                        "200": {
                            "description": "API is healthy",
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
                    },
                    "tags": ["health"]
                }
            },
            "/api/v3/steep": {
                "get": {
                    "summary": "Get STEEP Analysis Context",
                    "description": "Retrieve STEEP analysis context for an entity path",
                    "parameters": [
                        {
                            "name": "path",
                            "in": "query",
                            "required": True,
                            "schema": {"type": "string"},
                            "description": "Entity path (LTREE format)"
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "STEEP analysis context",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "factors": {"type": "array"},
                                            "confidence": {"type": "number"}
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "tags": ["steep"]
                }
            },
            "/api/v3/scenarios/{path}/analysis": {
                "get": {
                    "summary": "Get Multi-Factor Analysis",
                    "description": "Get multi-factor analysis for a scenario",
                    "parameters": [
                        {
                            "name": "path",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"},
                            "description": "Scenario path"
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Analysis results",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object"
                                    }
                                }
                            }
                        }
                    },
                    "tags": ["scenarios"]
                }
            },
            "/api/v6/scenarios": {
                "post": {
                    "summary": "Create Scenario",
                    "description": "Create a new scenario with confidence scoring",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "title": {"type": "string"},
                                        "description": {"type": "string"},
                                        "factors": {"type": "array"}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "Scenario created",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object"
                                    }
                                }
                            }
                        }
                    },
                    "tags": ["scenarios"]
                }
            },
            "/api/hierarchy/breadcrumbs": {
                "get": {
                    "summary": "Get Breadcrumbs",
                    "description": "Get breadcrumb navigation for an entity path",
                    "parameters": [
                        {
                            "name": "path",
                            "in": "query",
                            "required": True,
                            "schema": {"type": "string"},
                            "description": "Entity path"
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Breadcrumb items",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "label": {"type": "string"},
                                                "path": {"type": "string"},
                                                "entityId": {"type": "string"}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "tags": ["hierarchy"]
                }
            },
            "/ws": {
                "get": {
                    "summary": "WebSocket Connection",
                    "description": "Establish WebSocket connection for real-time updates",
                    "responses": {
                        "101": {
                            "description": "WebSocket connection established"
                        }
                    },
                    "tags": ["websocket"]
                }
            }
        },
        "components": {
            "schemas": {},
            "securitySchemes": {}
        },
        "tags": [
            {"name": "health", "description": "Health check endpoints"},
            {"name": "steep", "description": "STEEP analysis framework"},
            {"name": "scenarios", "description": "Scenario planning workbench"},
            {"name": "hierarchy", "description": "Hierarchical navigation"},
            {"name": "websocket", "description": "Real-time WebSocket updates"}
        ]
    }

def generate_openapi_schema():
    """Generate OpenAPI schema from FastAPI app or minimal fallback"""
    output_file = Path(__file__).parent.parent / 'contracts' / 'openapi.json'

    try:
        # Try to import the full FastAPI app
        from main import app

        schema = app.openapi()
        source = "FastAPI app"

    except Exception as e:
        print(f"ℹ️  Could not import full FastAPI app: {e}")
        print(f"   Generating minimal OpenAPI schema instead...")

        schema = generate_minimal_openapi()
        source = "minimal schema generator"

    # Add metadata
    schema['info']['x-generated'] = {
        'timestamp': datetime.now().isoformat(),
        'source': source
    }

    with open(output_file, 'w') as f:
        json.dump(schema, f, indent=2)

    print(f"✅ OpenAPI schema generated: {output_file}")
    print(f"   Title: {schema['info']['title']}")
    print(f"   Version: {schema['info']['version']}")
    print(f"   Endpoints: {len(schema.get('paths', {}))}")
    print(f"   Source: {source}")

    return output_file

if __name__ == '__main__':
    generate_openapi_schema()
