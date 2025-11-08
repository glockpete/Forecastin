#!/usr/bin/env python3
"""
Generate OpenAPI Schema from FastAPI Application
Outputs to: openapi.json

Usage:
    python scripts/generate_openapi.py
"""

import json
import sys
from pathlib import Path

# Add api directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'api'))

def generate_openapi_schema():
    """Generate OpenAPI schema from FastAPI app"""
    try:
        from main import app

        schema = app.openapi()

        output_file = Path(__file__).parent.parent / 'openapi.json'

        with open(output_file, 'w') as f:
            json.dump(schema, f, indent=2)

        print(f"✅ OpenAPI schema generated: {output_file}")
        print(f"   Title: {schema['info']['title']}")
        print(f"   Version: {schema['info']['version']}")
        print(f"   Endpoints: {len(schema.get('paths', {}))}")

        return output_file

    except ImportError as e:
        print(f"❌ Error importing FastAPI app: {e}")
        print("   Make sure all dependencies are installed:")
        print("   pip install fastapi uvicorn")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error generating schema: {e}")
        sys.exit(1)

if __name__ == '__main__':
    generate_openapi_schema()
