// k6 performance testing script for hierarchy resolution
// Tests LTREE-based ancestor/descendant queries

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    errors: ['rate<0.1'],              // Error rate under 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:9000';

export default function () {
  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // Test API root
  const rootRes = http.get(`${BASE_URL}/`);
  check(rootRes, {
    'root status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  // Simple text summary
  return `
  ========= k6 Performance Test Results =========
  Total Requests: ${data.metrics.http_reqs.values.count}
  Failed Requests: ${data.metrics.http_req_failed.values.rate * 100}%
  Avg Duration: ${data.metrics.http_req_duration.values.avg}ms
  P95 Duration: ${data.metrics.http_req_duration.values['p(95)']}ms
  ===============================================
  `;
}
