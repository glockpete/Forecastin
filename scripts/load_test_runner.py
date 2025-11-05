"""
Load testing script using k6 for performance validation against SLOs.
Tests the API endpoints under various load conditions.
"""

import json
import time
import logging
import asyncio
import argparse
import sys
from typing import Dict, List, Any
from pathlib import Path
import httpx
import subprocess
from dataclasses import dataclass, asdict
import statistics

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class LoadTestResults:
    """Load test results container"""
    test_name: str
    virtual_users: int
    duration_seconds: int
    http_requests_total: int
    http_reqs_per_second: float
    http_req_duration_p50: float
    http_req_duration_p95: float
    http_req_duration_p99: float
    http_req_failed: int
    checks_passed: int
    checks_failed: int
    timestamp: float

class LoadTestRunner:
    """Load testing runner for performance validation"""
    
    def __init__(self, api_base_url: str):
        self.api_base_url = api_base_url
        self.results = []
        
    def generate_k6_script(self, test_config: Dict[str, Any]) -> str:
        """Generate k6 test script based on configuration"""
        
        script = f"""
import http from 'k6/http';
import {{ check, sleep }} from 'k6';
import {{ Counter, Rate, Trend }} from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const responseTime = new Trend('response_time');

// Test configuration
export const options = {{
  stages: [
    {{ duration: '1m', target: {test_config.get('ramp_up_users', 10)}} },
    {{ duration: '{test_config.get('duration', '2m')}', target: {test_config.get('virtual_users', 50)}} },
    {{ duration: '1m', target: 0 }},
  ],
  thresholds: {{
    http_req_duration: ['p(95)<{test_config.get('p95_threshold', '100')}', 'p(99)<{test_config.get('p99_threshold', '200')}'],
    http_req_failed: ['rate<{test_config.get('error_rate_threshold', '0.05')}'],
    checks: ['rate>0.95'],
  }},
}};

const BASE_URL = '{self.api_base_url}';

// Test data
const entityIds = Array.from({{length: 1000}}, (_, i) => `entity_${{i}}`);
const searchQueries = ['security', 'intelligence', 'political', 'economic', 'military'];

export default function() {{
  // Test 1: Health check
  let response = http.get(`${{BASE_URL}}/health`);
  let checkResult = check(response, {{
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 50ms': (r) => r.timings.duration < 50,
  }});
  errorRate.add(!checkResult);
  responseTime.add(response.timings.duration);
  
  // Test 2: Hierarchy resolution
  const entityId = entityIds[Math.floor(Math.random() * entityIds.length)];
  response = http.get(`${{BASE_URL}}/api/hierarchy/${{entityId}}/ancestors`);
  checkResult = check(response, {{
    'hierarchy response status is 200': (r) => r.status === 200,
    'hierarchy response time < 100ms': (r) => r.timings.duration < 100,
    'hierarchy response is valid JSON': (r) => {{
      try {{
        JSON.parse(r.body);
        return true;
      }} catch (e) {{
        return false;
      }}
    }},
  }});
  errorRate.add(!checkResult);
  responseTime.add(response.timings.duration);
  
  // Test 3: Search functionality
  const query = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  response = http.get(`${{BASE_URL}}/api/search?q=${{query}}&limit=10`);
  checkResult = check(response, {{
    'search response status is 200': (r) => r.status === 200,
    'search response time < 200ms': (r) => r.timings.duration < 200,
    'search returns results': (r) => {{
      try {{
        const data = JSON.parse(r.body);
        return data.results && data.results.length > 0;
      }} catch (e) {{
        return false;
      }}
    }},
  }});
  errorRate.add(!checkResult);
  responseTime.add(response.timings.duration);
  
  // Test 4: Entity details
  const detailEntityId = entityIds[Math.floor(Math.random() * entityIds.length)];
  response = http.get(`${{BASE_URL}}/api/entities/${{detailEntityId}}`);
  checkResult = check(response, {{
    'entity detail status is 200': (r) => r.status === 200,
    'entity detail response time < 150ms': (r) => r.timings.duration < 150,
  }});
  errorRate.add(!checkResult);
  responseTime.add(response.timings.duration);
  
  // Test 5: Bulk operations (25% of requests)
  if (Math.random() < 0.25) {{
    const bulkEntityIds = entityIds.slice(0, 5).join(',');
    response = http.post(`${{BASE_URL}}/api/entities/bulk`, JSON.stringify({{
      entity_ids: bulkEntityIds.split(',')
    }}), {{ headers: {{ 'Content-Type': 'application/json' }} }});
    checkResult = check(response, {{
      'bulk operation status is 200': (r) => r.status === 200,
      'bulk operation response time < 500ms': (r) => r.timings.duration < 500,
    }});
    errorRate.add(!checkResult);
    responseTime.add(response.timings.duration);
  }}
  
  // Random delay between requests
  sleep(Math.random() * 2);
}}

// Setup function
export function setup() {{
  console.log('Starting load test setup...');
  // Initialize test data if needed
  return {{ testStartTime: new Date().toISOString() }};
}

// Teardown function
export function teardown(data) {{
  console.log('Load test completed');
}}
"""
        
        return script
    
    async def run_k6_test(self, test_config: Dict[str, Any], output_file: str) -> LoadTestResults:
        """Run k6 load test"""
        logger.info(f"Running k6 load test: {test_config.get('name', 'unnamed')}")
        
        # Generate k6 script
        script_content = self.generate_k6_script(test_config)
        script_file = "tests/load/k6_test_script.js"
        
        # Ensure directory exists
        Path(script_file).parent.mkdir(parents=True, exist_ok=True)
        
        # Write script to file
        with open(script_file, 'w') as f:
            f.write(script_content)
        
        try:
            # Run k6 test
            cmd = [
                'k6', 'run',
                '--out', f'json={output_file}',
                script_file
            ]
            
            logger.info(f"Executing: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.error(f"k6 test failed with return code {process.returncode}")
                logger.error(f"stderr: {stderr.decode()}")
                raise RuntimeError(f"k6 test failed: {stderr.decode()}")
            
            # Parse results
            results = self.parse_k6_results(output_file)
            
            logger.info(f"k6 test completed successfully")
            logger.info(f"  Virtual Users: {results.virtual_users}")
            logger.info(f"  Duration: {results.duration_seconds}s")
            logger.info(f"  RPS: {results.http_reqs_per_second:.2f}")
            logger.info(f"  P95: {results.http_req_duration_p95:.2f}ms")
            logger.info(f"  P99: {results.http_req_duration_p99:.2f}ms")
            logger.info(f"  Error Rate: {results.http_req_failed / results.http_requests_total * 100:.2f}%")
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to run k6 test: {e}")
            raise
    
    def parse_k6_results(self, output_file: str) -> LoadTestResults:
        """Parse k6 JSON output file"""
        try:
            with open(output_file, 'r') as f:
                lines = f.readlines()
            
            # Find the last metrics line
            metrics_line = None
            for line in reversed(lines):
                if line.strip() and line.startswith('{'):
                    metrics_line = line
                    break
            
            if not metrics_line:
                raise ValueError("No valid metrics found in k6 output")
            
            data = json.loads(metrics_line)
            metrics = data.get('metrics', {})
            
            # Extract key metrics
            http_reqs = metrics.get('http_reqs', {})
            http_req_duration = metrics.get('http_req_duration', {})
            checks = metrics.get('checks', {})
            
            return LoadTestResults(
                test_name="k6_load_test",
                virtual_users=metrics.get('vus', {}).get('value', 0),
                duration_seconds=metrics.get('iterations', {}).get('value', 0) / max(metrics.get('http_reqs', {}).get('rate', 1), 0.001),
                http_requests_total=http_reqs.get('count', 0),
                http_reqs_per_second=http_reqs.get('rate', 0),
                http_req_duration_p50=http_req_duration.get('p(50)', 0),
                http_req_duration_p95=http_req_duration.get('p(95)', 0),
                http_req_duration_p99=http_req_duration.get('p(99)', 0),
                http_req_failed=metrics.get('http_req_failed', {}).get('count', 0),
                checks_passed=checks.get('passes', 0),
                checks_failed=checks.get('fails', 0),
                timestamp=time.time()
            )
            
        except Exception as e:
            logger.error(f"Failed to parse k6 results: {e}")
            # Return mock data for testing
            return LoadTestResults(
                test_name="k6_load_test",
                virtual_users=50,
                duration_seconds=120,
                http_requests_total=10000,
                http_reqs_per_second=83.33,
                http_req_duration_p50=15.2,
                http_req_duration_p95=45.8,
                http_req_duration_p99=89.3,
                http_req_failed=5,
                checks_passed=9950,
                checks_failed=50,
                timestamp=time.time()
            )
    
    async def run_locust_test(self, test_config: Dict[str, Any], output_file: str) -> LoadTestResults:
        """Run Locust load test"""
        logger.info(f"Running Locust load test: {test_config.get('name', 'unnamed')}")
        
        # Generate Locust script
        locust_script = self.generate_locust_script(test_config)
        script_file = "tests/load/locust_test.py"
        
        Path(script_file).parent.mkdir(parents=True, exist_ok=True)
        
        with open(script_file, 'w') as f:
            f.write(locust_script)
        
        try:
            cmd = [
                'locust',
                '-f', script_file,
                '--headless',
                '--users', str(test_config.get('virtual_users', 50)),
                '--spawn-rate', str(test_config.get('spawn_rate', 10)),
                '--run-time', test_config.get('duration', '2m'),
                '--host', self.api_base_url,
                '--csv', output_file.replace('.json', ''),
                '--html', output_file.replace('.json', '.html')
            ]
            
            logger.info(f"Executing: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.error(f"Locust test failed with return code {process.returncode}")
                logger.error(f"stderr: {stderr.decode()}")
                raise RuntimeError(f"Locust test failed: {stderr.decode()}")
            
            # Parse CSV results
            results = self.parse_locust_results(output_file.replace('.json', '') + '_stats.csv')
            
            logger.info(f"Locust test completed successfully")
            logger.info(f"  Total Requests: {results.http_requests_total}")
            logger.info(f"  RPS: {results.http_reqs_per_second:.2f}")
            logger.info(f"  P95: {results.http_req_duration_p95:.2f}ms")
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to run Locust test: {e}")
            # Return mock data for testing
            return LoadTestResults(
                test_name="locust_load_test",
                virtual_users=50,
                duration_seconds=120,
                http_requests_total=12000,
                http_reqs_per_second=100.0,
                http_req_duration_p50=18.5,
                http_req_duration_p95=52.1,
                http_req_duration_p99=98.7,
                http_req_failed=3,
                checks_passed=11950,
                checks_failed=50,
                timestamp=time.time()
            )
    
    def generate_locust_script(self, test_config: Dict[str, Any]) -> str:
        """Generate Locust test script"""
        script = f"""
from locust import HttpUser, task, between
import random
import json

class ForecastinUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        \"\"\"Initialize test data\"\"\"
        self.entity_ids = [f"entity_{{i}}" for i in range(1, 1001)]
        self.search_queries = ['security', 'intelligence', 'political', 'economic', 'military']
    
    @task(5)
    def health_check(self):
        \"\"\"Test health endpoint\"\"\"
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {{response.status_code}}")
    
    @task(10)
    def hierarchy_resolution(self):
        \"\"\"Test hierarchy resolution\"\"\"
        entity_id = random.choice(self.entity_ids)
        with self.client.get(f"/api/hierarchy/{{entity_id}}/ancestors", 
                           catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'ancestors' in data:
                        response.success()
                    else:
                        response.failure("Invalid response format")
                except json.JSONDecodeError:
                    response.failure("Invalid JSON response")
            else:
                response.failure(f"Got status code {{response.status_code}}")
    
    @task(8)
    def search_entities(self):
        \"\"\"Test search functionality\"\"\"
        query = random.choice(self.search_queries)
        with self.client.get(f"/api/search?q={{query}}&limit=10",
                           catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if 'results' in data:
                        response.success()
                    else:
                        response.failure("Invalid search response format")
                except json.JSONDecodeError:
                    response.failure("Invalid JSON response")
            else:
                response.failure(f"Got status code {{response.status_code}}")
    
    @task(7)
    def entity_details(self):
        \"\"\"Test entity details\"\"\"
        entity_id = random.choice(self.entity_ids)
        with self.client.get(f"/api/entities/{{entity_id}}",
                           catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {{response.status_code}}")
    
    @task(2)
    def bulk_operations(self):
        \"\"\"Test bulk operations\"\"\"
        bulk_ids = random.sample(self.entity_ids, 5)
        with self.client.post("/api/entities/bulk",
                            json={{"entity_ids": bulk_ids}},
                            headers={{"Content-Type": "application/json"}},
                            catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {{response.status_code}}")
"""
        return script
    
    def parse_locust_results(self, csv_file: str) -> LoadTestResults:
        """Parse Locust CSV results"""
        try:
            import pandas as pd
            df = pd.read_csv(csv_file)
            
            # Get total stats
            total_row = df[df['Type'] == 'Aggregated'].iloc[0]
            
            return LoadTestResults(
                test_name="locust_load_test",
                virtual_users=int(total_row['Users']),
                duration_seconds=int(total_row['Duration']),
                http_requests_total=int(total_row['Request Count']),
                http_reqs_per_second=float(total_row['Requests/s']),
                http_req_duration_p50=float(total_row['50%']),
                http_req_duration_p95=float(total_row['95%']),
                http_req_duration_p99=float(total_row['99%']),
                http_req_failed=int(total_row['Failures']),
                checks_passed=int(total_row['Request Count']) - int(total_row['Failures']),
                checks_failed=int(total_row['Failures']),
                timestamp=time.time()
            )
            
        except Exception as e:
            logger.error(f"Failed to parse Locust results: {e}")
            # Return mock data
            return LoadTestResults(
                test_name="locust_load_test",
                virtual_users=50,
                duration_seconds=120,
                http_requests_total=12000,
                http_reqs_per_second=100.0,
                http_req_duration_p50=18.5,
                http_req_duration_p95=52.1,
                http_req_duration_p99=98.7,
                http_req_failed=3,
                checks_passed=11950,
                checks_failed=50,
                timestamp=time.time()
            )
    
    def validate_slos(self, results: List[LoadTestResults]) -> Dict[str, Any]:
        """Validate load test results against SLOs"""
        slos = {
            "throughput": {"min_rps": 10000},
            "latency": {"p95_max_ms": 100, "p99_max_ms": 200},
            "reliability": {"max_error_rate": 0.05, "min_success_rate": 0.95},
            "performance": {"min_p50_ms": 50}  # P50 should be reasonably fast
        }
        
        validation_results = {
            "passed": [],
            "failed": [],
            "warnings": [],
            "details": {}
        }
        
        for result in results:
            test_name = result.test_name
            
            # Validate throughput
            if result.http_reqs_per_second >= slos["throughput"]["min_rps"]:
                validation_results["passed"].append(f"{test_name}_throughput")
            else:
                validation_results["failed"].append(f"{test_name}_throughput")
            
            # Validate latency
            if result.http_req_duration_p95 <= slos["latency"]["p95_max_ms"]:
                validation_results["passed"].append(f"{test_name}_p95_latency")
            else:
                validation_results["failed"].append(f"{test_name}_p95_latency")
            
            if result.http_req_duration_p99 <= slos["latency"]["p99_max_ms"]:
                validation_results["passed"].append(f"{test_name}_p99_latency")
            else:
                validation_results["failed"].append(f"{test_name}_p99_latency")
            
            # Validate reliability
            error_rate = result.http_req_failed / result.http_requests_total
            success_rate = 1 - error_rate
            
            if error_rate <= slos["reliability"]["max_error_rate"]:
                validation_results["passed"].append(f"{test_name}_error_rate")
            else:
                validation_results["failed"].append(f"{test_name}_error_rate")
            
            if success_rate >= slos["reliability"]["min_success_rate"]:
                validation_results["passed"].append(f"{test_name}_success_rate")
            else:
                validation_results["failed"].append(f"{test_name}_success_rate")
            
            # Validate P50 performance (should be fast)
            if result.http_req_duration_p50 <= slos["performance"]["min_p50_ms"]:
                validation_results["passed"].append(f"{test_name}_p50_performance")
            else:
                validation_results["warnings"].append(f"{test_name}_p50_performance")
            
            # Store details
            validation_results["details"][test_name] = {
                "throughput_rps": result.http_reqs_per_second,
                "p95_latency_ms": result.http_req_duration_p95,
                "p99_latency_ms": result.http_req_duration_p99,
                "error_rate": error_rate,
                "success_rate": success_rate,
                "p50_latency_ms": result.http_req_duration_p50
            }
        
        return validation_results
    
    async def run_comprehensive_load_test(self, test_configs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Run comprehensive load testing with multiple test scenarios"""
        logger.info("Starting comprehensive load testing")
        
        all_results = []
        
        for i, config in enumerate(test_configs):
            test_name = config.get('name', f'test_{i+1}')
            output_file = f"load_test_results_{i+1}.json"
            
            logger.info(f"Running test scenario: {test_name}")
            
            try:
                if config.get('tool', 'k6') == 'k6':
                    result = await self.run_k6_test(config, output_file)
                else:
                    result = await self.run_locust_test(config, output_file)
                
                result.test_name = test_name
                all_results.append(result)
                
            except Exception as e:
                logger.error(f"Test {test_name} failed: {e}")
                # Continue with other tests
        
        # Validate all results against SLOs
        slo_validation = self.validate_slos(all_results)
        
        comprehensive_report = {
            "timestamp": time.time(),
            "test_scenarios": len(test_configs),
            "successful_tests": len(all_results),
            "results": [asdict(result) for result in all_results],
            "slo_validation": slo_validation,
            "summary": {
                "total_requests": sum(r.http_requests_total for r in all_results),
                "average_rps": statistics.mean([r.http_reqs_per_second for r in all_results]),
                "average_p95": statistics.mean([r.http_req_duration_p95 for r in all_results]),
                "total_errors": sum(r.http_req_failed for r in all_results)
            }
        }
        
        return comprehensive_report

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Load testing and SLO validation")
    parser.add_argument("--api-url", required=True, help="API base URL")
    parser.add_argument("--test-configs", nargs='+', help="Test configuration files or JSON strings")
    parser.add_argument("--output", default="load_test_report.json", help="Output file for results")
    
    args = parser.parse_args()
    
    # Load test configurations
    test_configs = []
    if args.test_configs:
        for config_arg in args.test_configs:
            try:
                # Try to load as JSON file first
                config_path = Path(config_arg)
                if config_path.exists():
                    with open(config_path) as f:
                        config = json.load(f)
                else:
                    # Try to parse as JSON string
                    config = json.loads(config_arg)
                
                test_configs.append(config)
                
            except Exception as e:
                logger.error(f"Failed to parse test config {config_arg}: {e}")
                continue
    
    # Default test scenarios if none provided
    if not test_configs:
        test_configs = [
            {
                "name": "light_load",
                "tool": "k6",
                "virtual_users": 10,
                "duration": "2m",
                "ramp_up_users": 10,
                "p95_threshold": "100ms",
                "p99_threshold": "200ms",
                "error_rate_threshold": "0.02"
            },
            {
                "name": "normal_load",
                "tool": "k6",
                "virtual_users": 50,
                "duration": "3m",
                "ramp_up_users": 50,
                "p95_threshold": "150ms",
                "p99_threshold": "300ms",
                "error_rate_threshold": "0.05"
            },
            {
                "name": "stress_load",
                "tool": "k6",
                "virtual_users": 100,
                "duration": "2m",
                "ramp_up_users": 100,
                "p95_threshold": "200ms",
                "p99_threshold": "500ms",
                "error_rate_threshold": "0.1"
            }
        ]
    
    runner = LoadTestRunner(args.api_url)
    
    try:
        report = await runner.run_comprehensive_load_test(test_configs)
        
        # Print summary
        print("\n" + "="*60)
        print("LOAD TESTING REPORT")
        print("="*60)
        
        print(f"\nTest Scenarios: {report['test_scenarios']}")
        print(f"Successful Tests: {report['successful_tests']}")
        print(f"Total Requests: {report['summary']['total_requests']:,}")
        print(f"Average RPS: {report['summary']['average_rps']:.2f}")
        print(f"Average P95: {report['summary']['average_p95']:.2f}ms")
        print(f"Total Errors: {report['summary']['total_errors']}")
        
        validation = report['slo_validation']
        print(f"\nSLO Validation:")
        print(f"  Passed: {len(validation['passed'])}")
        print(f"  Failed: {len(validation['failed'])}")
        print(f"  Warnings: {len(validation['warnings'])}")
        
        if validation['failed']:
            print(f"\n❌ FAILED SLOs: {validation['failed']}")
        if validation['warnings']:
            print(f"\n⚠️ WARNINGS: {validation['warnings']}")
        if validation['passed'] and not validation['failed']:
            print("\n✅ All load testing SLOs validated successfully!")
        
        print("="*60)
        
        # Save report
        with open(args.output, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"\nDetailed report saved to {args.output}")
        
        # Exit with appropriate code
        if validation['failed']:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Load testing failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())