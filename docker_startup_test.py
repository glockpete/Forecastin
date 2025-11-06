#!/usr/bin/env python3
"""
Docker-Compose Startup Comprehensive Test Suite
Tests all services, endpoints, and connectivity for Forecastin platform
"""

import json
import time
import subprocess
import requests
from datetime import datetime
from typing import Dict, List, Any

class DockerStartupTester:
    def __init__(self):
        self.results = {
            "test_timestamp": datetime.utcnow().isoformat(),
            "service_status": {},
            "api_tests": {},
            "database_tests": {},
            "redis_tests": {},
            "frontend_tests": {},
            "websocket_tests": {},
            "critical_issues": [],
            "warnings": [],
            "recommendations": []
        }
        
    def run_command(self, cmd: List[str]) -> Dict[str, Any]:
        """Execute shell command and return result"""
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def test_service_status(self):
        """Test docker-compose service status"""
        print("Testing service status...")
        result = self.run_command(["docker-compose", "ps"])
        
        if result["success"]:
            output = result["stdout"]
            services = ["postgres", "redis", "api", "frontend"]
            
            for service in services:
                status = "unknown"
                if service in output:
                    if "Up" in output and "(healthy)" in output:
                        status = "healthy"
                    elif "Up" in output and "(unhealthy)" in output:
                        status = "unhealthy"
                    elif "Up" in output:
                        status = "running"
                    elif "Exit" in output:
                        status = "exited"
                
                self.results["service_status"][service] = {
                    "status": status,
                    "raw_output": output
                }
                
                if status in ["exited", "unknown"]:
                    self.results["critical_issues"].append(
                        f"Service {service} is not running (status: {status})"
                    )
                elif status == "unhealthy":
                    self.results["warnings"].append(
                        f"Service {service} is unhealthy"
                    )
        else:
            self.results["critical_issues"].append(
                f"Failed to check service status: {result.get('error', 'Unknown error')}"
            )
    
    def test_api_health(self):
        """Test API health endpoint"""
        print("Testing API health endpoint...")
        try:
            response = requests.get("http://localhost:9000/health", timeout=10)
            data = response.json()
            
            self.results["api_tests"]["health_endpoint"] = {
                "status_code": response.status_code,
                "response": data,
                "success": response.status_code == 200
            }
            
            # Check specific service health
            if "services" in data:
                for service, status in data["services"].items():
                    if "unhealthy" in str(status).lower():
                        self.results["warnings"].append(
                            f"API service '{service}' reported unhealthy: {status}"
                        )
            
            # Check performance metrics
            if "performance_metrics" in data:
                metrics = data["performance_metrics"]
                if metrics.get("ancestor_resolution_ms", 0) > 10:
                    self.results["warnings"].append(
                        f"Ancestor resolution slow: {metrics['ancestor_resolution_ms']}ms (target: <10ms)"
                    )
                if metrics.get("cache_hit_rate", 0) < 0.9:
                    self.results["warnings"].append(
                        f"Cache hit rate low: {metrics['cache_hit_rate']:.2%} (target: >90%)"
                    )
                    
        except Exception as e:
            self.results["api_tests"]["health_endpoint"] = {
                "success": False,
                "error": str(e)
            }
            self.results["critical_issues"].append(
                f"API health endpoint failed: {str(e)}"
            )
    
    def test_database_connectivity(self):
        """Test database connectivity"""
        print("Testing database connectivity...")
        
        # Test PostgreSQL connection
        result = self.run_command([
            "docker-compose", "exec", "-T", "postgres",
            "psql", "-U", "forecastin", "-d", "forecastin", 
            "-c", "SELECT version();"
        ])
        
        self.results["database_tests"]["connectivity"] = {
            "success": result["success"],
            "output": result.get("stdout", result.get("error", ""))
        }
        
        if not result["success"]:
            self.results["critical_issues"].append(
                "PostgreSQL connectivity test failed"
            )
        
        # Test LTREE extension
        ltree_result = self.run_command([
            "docker-compose", "exec", "-T", "postgres",
            "psql", "-U", "forecastin", "-d", "forecastin",
            "-c", "SELECT extname FROM pg_extension WHERE extname = 'ltree';"
        ])
        
        self.results["database_tests"]["ltree_extension"] = {
            "success": ltree_result["success"] and "ltree" in ltree_result.get("stdout", ""),
            "output": ltree_result.get("stdout", "")
        }
        
        if not (ltree_result["success"] and "ltree" in ltree_result.get("stdout", "")):
            self.results["critical_issues"].append(
                "LTREE extension not installed in database"
            )
    
    def test_redis_connectivity(self):
        """Test Redis connectivity"""
        print("Testing Redis connectivity...")
        
        result = self.run_command([
            "docker-compose", "exec", "-T", "redis",
            "redis-cli", "ping"
        ])
        
        self.results["redis_tests"]["connectivity"] = {
            "success": result["success"] and "PONG" in result.get("stdout", ""),
            "output": result.get("stdout", result.get("error", ""))
        }
        
        if not (result["success"] and "PONG" in result.get("stdout", "")):
            self.results["critical_issues"].append(
                "Redis connectivity test failed"
            )
    
    def test_frontend_accessibility(self):
        """Test frontend accessibility"""
        print("Testing frontend accessibility...")
        
        try:
            response = requests.get("http://localhost:3000", timeout=10)
            self.results["frontend_tests"]["accessibility"] = {
                "status_code": response.status_code,
                "success": response.status_code == 200,
                "content_type": response.headers.get("content-type", "")
            }
            
            if response.status_code != 200:
                self.results["warnings"].append(
                    f"Frontend returned status code {response.status_code}"
                )
        except Exception as e:
            self.results["frontend_tests"]["accessibility"] = {
                "success": False,
                "error": str(e)
            }
            self.results["critical_issues"].append(
                f"Frontend accessibility test failed: {str(e)}"
            )
        
        # Check nginx logs for permission issues
        logs_result = self.run_command([
            "docker-compose", "logs", "--tail=20", "frontend"
        ])
        
        if "Permission denied" in logs_result.get("stdout", ""):
            self.results["critical_issues"].append(
                "Frontend nginx has permission issues - cannot write PID file"
            )
            self.results["recommendations"].append(
                "Fix nginx.conf to use unprivileged user or adjust Dockerfile permissions"
            )
    
    def test_websocket_connectivity(self):
        """Test WebSocket connectivity"""
        print("Testing WebSocket connectivity...")
        
        # Check if WebSocket endpoint is accessible
        try:
            # Try HTTP upgrade endpoint
            response = requests.get("http://localhost:9000/ws", timeout=5, 
                                   headers={"Upgrade": "websocket"})
            
            self.results["websocket_tests"]["endpoint"] = {
                "status_code": response.status_code,
                "accessible": response.status_code in [101, 426, 400]  # WebSocket upgrade codes
            }
            
            if response.status_code not in [101, 426, 400]:
                self.results["warnings"].append(
                    f"WebSocket endpoint returned unexpected status: {response.status_code}"
                )
        except Exception as e:
            self.results["websocket_tests"]["endpoint"] = {
                "success": False,
                "error": str(e)
            }
            self.results["warnings"].append(
                f"WebSocket endpoint test inconclusive: {str(e)}"
            )
    
    def analyze_api_logs(self):
        """Analyze API logs for critical issues"""
        print("Analyzing API logs...")
        
        result = self.run_command([
            "docker-compose", "logs", "--tail=100", "api"
        ])
        
        if result["success"]:
            logs = result["stdout"]
            
            # Check for critical issues
            if "No module named 'psycopg2'" in logs:
                self.results["critical_issues"].append(
                    "Missing psycopg2 dependency in API container"
                )
                self.results["recommendations"].append(
                    "Add psycopg2-binary to api/requirements.txt"
                )
            
            if "attached to a different loop" in logs:
                self.results["critical_issues"].append(
                    "Asyncio event loop misconfiguration in database pool health checks"
                )
                self.results["recommendations"].append(
                    "Fix DatabaseManager._test_pool_connection() to use proper asyncio patterns"
                )
            
            if "Redis not available" in logs:
                self.results["warnings"].append(
                    "L2 cache (Redis) disabled - performance degraded"
                )
            
            if "psycopg2 not available" in logs:
                self.results["warnings"].append(
                    "L3 cache (Database) disabled - performance degraded"
                )
    
    def generate_summary(self):
        """Generate test summary"""
        total_tests = sum([
            len(self.results["api_tests"]),
            len(self.results["database_tests"]),
            len(self.results["redis_tests"]),
            len(self.results["frontend_tests"]),
            len(self.results["websocket_tests"])
        ])
        
        passed_tests = sum([
            sum(1 for v in self.results["api_tests"].values() if v.get("success", False)),
            sum(1 for v in self.results["database_tests"].values() if v.get("success", False)),
            sum(1 for v in self.results["redis_tests"].values() if v.get("success", False)),
            sum(1 for v in self.results["frontend_tests"].values() if v.get("success", False)),
            sum(1 for v in self.results["websocket_tests"].values() if v.get("success", False))
        ])
        
        self.results["summary"] = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "critical_issues_count": len(self.results["critical_issues"]),
            "warnings_count": len(self.results["warnings"]),
            "overall_status": "CRITICAL" if len(self.results["critical_issues"]) > 0 
                            else "WARNING" if len(self.results["warnings"]) > 0 
                            else "HEALTHY"
        }
    
    def run_all_tests(self):
        """Run all tests"""
        print("=" * 80)
        print("Docker-Compose Startup Comprehensive Test Suite")
        print("=" * 80)
        print()
        
        self.test_service_status()
        self.test_api_health()
        self.test_database_connectivity()
        self.test_redis_connectivity()
        self.test_frontend_accessibility()
        self.test_websocket_connectivity()
        self.analyze_api_logs()
        self.generate_summary()
        
        # Save results to file
        timestamp = int(time.time())
        filename = f"docker_startup_test_report_{timestamp}.json"
        
        with open(filename, "w") as f:
            json.dump(self.results, f, indent=2)
        
        print()
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Overall Status: {self.results['summary']['overall_status']}")
        print(f"Total Tests: {self.results['summary']['total_tests']}")
        print(f"Passed: {self.results['summary']['passed_tests']}")
        print(f"Failed: {self.results['summary']['failed_tests']}")
        print(f"Critical Issues: {self.results['summary']['critical_issues_count']}")
        print(f"Warnings: {self.results['summary']['warnings_count']}")
        print()
        
        if self.results["critical_issues"]:
            print("CRITICAL ISSUES:")
            for issue in self.results["critical_issues"]:
                print(f"  ❌ {issue}")
            print()
        
        if self.results["warnings"]:
            print("WARNINGS:")
            for warning in self.results["warnings"]:
                print(f"  ⚠️  {warning}")
            print()
        
        if self.results["recommendations"]:
            print("RECOMMENDATIONS:")
            for rec in self.results["recommendations"]:
                print(f"  💡 {rec}")
            print()
        
        print(f"Full report saved to: {filename}")
        print("=" * 80)
        
        return self.results

if __name__ == "__main__":
    tester = DockerStartupTester()
    results = tester.run_all_tests()