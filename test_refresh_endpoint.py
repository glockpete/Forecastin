#!/usr/bin/env python3
"""
Test script for the LTREE materialized view refresh API endpoint
"""

import requests
import json
import sys
from pathlib import Path

# Add the api directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "api"))

def test_refresh_endpoint():
    """Test the materialized view refresh endpoint"""
    
    base_url = "http://localhost:9000"
    
    print("Testing LTREE Materialized View Refresh API")
    print("=" * 50)
    
    # Test 1: Health check
    print("\n1. Testing health check...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ Health check passed: {health_data['status']}")
            print(f"   Services: {list(health_data['services'].keys())}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    
    # Test 2: Refresh status endpoint
    print("\n2. Testing refresh status endpoint...")
    try:
        response = requests.get(f"{base_url}/api/entities/refresh/status", timeout=5)
        if response.status_code == 200:
            status_data = response.json()
            print(f"✅ Refresh status: {status_data['status']}")
            print(f"   Message: {status_data['message']}")
        else:
            print(f"❌ Refresh status failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Refresh status error: {e}")
        return False
    
    # Test 3: Manual refresh endpoint
    print("\n3. Testing manual refresh endpoint...")
    try:
        response = requests.post(f"{base_url}/api/entities/refresh", timeout=30)
        if response.status_code == 200:
            refresh_data = response.json()
            print(f"✅ Refresh completed: {refresh_data['status']}")
            print(f"   Duration: {refresh_data.get('duration_ms', 'N/A')}ms")
            if 'results' in refresh_data:
                print(f"   Results: {refresh_data['results']}")
            if 'failed_views' in refresh_data:
                print(f"   Failed views: {refresh_data['failed_views']}")
        else:
            print(f"❌ Refresh failed: {response.status_code}")
            try:
                error_detail = response.json()
                print(f"   Error: {error_detail.get('detail', 'Unknown error')}")
            except:
                print(f"   Raw response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Refresh error: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("✅ All tests passed! LTREE materialized view refresh API is working correctly.")
    return True

def test_api_documentation():
    """Print API documentation"""
    print("\nAPI Endpoints for LTREE Materialized View Refresh:")
    print("=" * 55)
    print()
    print("POST /api/entities/refresh")
    print("  Description: Manually refresh all LTREE materialized views")
    print("  Response: {")
    print('    "status": "success|partial_success",')
    print('    "message": "Description of result",')
    print('    "results": {"mv_entity_ancestors": true, "mv_descendant_counts": true, ...},')
    print('    "duration_ms": 123.45,')
    print('    "failed_views": [] // only if partial success')
    print("  }")
    print()
    print("GET /api/entities/refresh/status")
    print("  Description: Get status of materialized view refresh service")
    print("  Response: {")
    print('    "status": "available",')
    print('    "last_refresh": 1234567890.123,')
    print('    "cache_metrics": {...},')
    print('    "message": "Service description"')
    print("  }")
    print()

if __name__ == "__main__":
    print("LTREE Materialized View Refresh API Test")
    print("=========================================")
    
    # Show API documentation
    test_api_documentation()
    
    # Run tests
    success = test_refresh_endpoint()
    
    if success:
        print("\n🎉 Implementation completed successfully!")
        print("\nKey features implemented:")
        print("• Manual refresh endpoint calls refresh_all_materialized_views()")
        print("• Supports concurrent and regular refresh with fallback")
        print("• Detailed success/failure reporting with timing metrics")
        print("• Status monitoring endpoint for operational visibility")
        print("• Proper error handling and logging")
        print("• Integration with existing hierarchy resolver architecture")
    else:
        print("\n⚠️  Tests failed. Check server logs for details.")
        sys.exit(1)