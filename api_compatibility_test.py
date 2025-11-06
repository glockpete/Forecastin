"""
API Compatibility Test
Verifies frontend and backend API version compatibility
Tests all endpoints used by the Outcomes Dashboard
"""

import requests
import json
import time
from typing import Dict, Any, List

# Test configuration
API_BASE_URL = "http://localhost:9001"
FRONTEND_ENDPOINTS = [
    "/api/opportunities",
    "/api/actions", 
    "/api/stakeholders",
    "/api/evidence",
    "/health"
]

class APICompatibilityTest:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.results = []
        
    def test_endpoint(self, endpoint: str) -> Dict[str, Any]:
        """Test a single endpoint"""
        url = f"{self.base_url}{endpoint}"
        result = {
            "endpoint": endpoint,
            "url": url,
            "status": "unknown",
            "response_time_ms": 0,
            "status_code": None,
            "error": None,
            "data_preview": None
        }
        
        try:
            start_time = time.time()
            response = requests.get(url, timeout=5)
            duration_ms = (time.time() - start_time) * 1000
            
            result["response_time_ms"] = round(duration_ms, 2)
            result["status_code"] = response.status_code
            
            if response.ok:
                result["status"] = "[PASS] SUCCESS"
                data = response.json()
                
                # Get data preview
                if isinstance(data, dict):
                    result["data_preview"] = {
                        "keys": list(data.keys()),
                        "total_items": data.get("total", len(data))
                    }
                
            else:
                result["status"] = "[FAIL] FAILED"
                result["error"] = f"HTTP {response.status_code}: {response.text[:200]}"
                
        except requests.exceptions.ConnectionError:
            result["status"] = "[FAIL] CONNECTION_ERROR"
            result["error"] = "Cannot connect to API server"
        except requests.exceptions.Timeout:
            result["status"] = "[FAIL] TIMEOUT"
            result["error"] = "Request timeout after 5s"
        except Exception as e:
            result["status"] = "[FAIL] ERROR"
            result["error"] = str(e)
            
        return result
    
    def run_all_tests(self) -> List[Dict[str, Any]]:
        """Run tests for all endpoints"""
        print("=" * 80)
        print("API COMPATIBILITY TEST - Frontend vs Backend")
        print("=" * 80)
        print(f"Testing API at: {self.base_url}")
        print(f"Total endpoints: {len(FRONTEND_ENDPOINTS)}")
        print("=" * 80)
        print()
        
        for endpoint in FRONTEND_ENDPOINTS:
            result = self.test_endpoint(endpoint)
            self.results.append(result)
            
            # Print result
            print(f"{result['status']} {endpoint}")
            print(f"   URL: {result['url']}")
            print(f"   Status Code: {result['status_code']}")
            print(f"   Response Time: {result['response_time_ms']}ms")
            
            if result['data_preview']:
                print(f"   Data Preview: {result['data_preview']}")
            
            if result['error']:
                print(f"   Error: {result['error']}")
            
            print()
        
        return self.results
    
    def generate_report(self) -> Dict[str, Any]:
        """Generate summary report"""
        total = len(self.results)
        passed = sum(1 for r in self.results if r['status'] == "[PASS] SUCCESS")
        failed = total - passed
        
        report = {
            "timestamp": time.time(),
            "base_url": self.base_url,
            "summary": {
                "total_tests": total,
                "passed": passed,
                "failed": failed,
                "pass_rate": round((passed / total * 100), 2) if total > 0 else 0
            },
            "results": self.results
        }
        
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Pass Rate: {report['summary']['pass_rate']}%")
        print("=" * 80)
        print()
        
        if failed > 0:
            print("FAILED ENDPOINTS:")
            for result in self.results:
                if result['status'] != "[PASS] SUCCESS":
                    print(f"  - {result['endpoint']}: {result['error']}")
            print()
        
        return report
    
    def save_report(self, filename: str = "api_compatibility_report.json"):
        """Save report to JSON file"""
        report = self.generate_report()
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"Report saved to: {filename}")
        return filename


if __name__ == "__main__":
    tester = APICompatibilityTest(API_BASE_URL)
    tester.run_all_tests()
    tester.save_report()
    
    # Check if all tests passed
    report = tester.generate_report()
    if report['summary']['pass_rate'] == 100:
        print("[PASS] ALL TESTS PASSED - Frontend and Backend are compatible!")
    else:
        print("[FAIL] SOME TESTS FAILED - There may be API version mismatch issues")