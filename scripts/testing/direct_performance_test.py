#!/usr/bin/env python3
"""
Direct database performance test for ancestor resolution.
This test measures the actual performance difference between:
1. Direct LTREE queries (without materialized views)
2. Materialized view queries (with materialized views)
"""

import asyncpg
import time
import statistics
import asyncio

async def test_direct_ltree_performance():
    """Test direct LTREE query performance"""
    import os
    database_url = os.getenv('DATABASE_URL', 'postgresql://forecastin:@localhost:5432/forecastin')
    conn = await asyncpg.connect(database_url)
    
    latencies = []
    for _ in range(100):
        start_time = time.time()
        try:
            result = await conn.fetchval("""
                SELECT name FROM test_entities 
                WHERE hierarchy_path @> (SELECT hierarchy_path FROM test_entities WHERE id = $1)
                ORDER BY path_depth
                LIMIT 1
            """, 5)
            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000
            latencies.append(latency_ms)
        except Exception as e:
            print(f"Direct LTREE query failed: {e}")
    
    await conn.close()
    
    avg_latency = statistics.mean(latencies)
    p95_latency = statistics.quantiles(latencies, n=20)[18] if len(latencies) > 20 else max(latencies)
    
    return {
        "method": "direct_ltree",
        "avg_latency_ms": avg_latency,
        "p95_latency_ms": p95_latency,
        "queries_per_second": 1000 / avg_latency if avg_latency > 0 else 0
    }

async def test_materialized_view_performance():
    """Test materialized view query performance"""
    import os
    database_url = os.getenv('DATABASE_URL', 'postgresql://forecastin:@localhost:5432/forecastin')
    conn = await asyncpg.connect(database_url)
    
    latencies = []
    for _ in range(100):
        start_time = time.time()
        try:
            result = await conn.fetchval("""
                SELECT ancestor_names 
                FROM mv_entity_ancestors 
                WHERE id = $1
                LIMIT 1
            """, 5)
            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000
            latencies.append(latency_ms)
        except Exception as e:
            print(f"Materialized view query failed: {e}")
    
    await conn.close()
    
    avg_latency = statistics.mean(latencies)
    p95_latency = statistics.quantiles(latencies, n=20)[18] if len(latencies) > 20 else max(latencies)
    
    return {
        "method": "materialized_view",
        "avg_latency_ms": avg_latency,
        "p95_latency_ms": p95_latency,
        "queries_per_second": 1000 / avg_latency if avg_latency > 0 else 0
    }

async def main():
    print("="*60)
    print("DIRECT DATABASE PERFORMANCE COMPARISON")
    print("="*60)
    
    # Test direct LTREE performance
    print("\nTesting direct LTREE queries...")
    direct_results = await test_direct_ltree_performance()
    print(f"Direct LTREE: {direct_results['avg_latency_ms']:.2f}ms avg, {direct_results['p95_latency_ms']:.2f}ms P95")
    
    # Test materialized view performance  
    print("\nTesting materialized view queries...")
    mv_results = await test_materialized_view_performance()
    print(f"Materialized View: {mv_results['avg_latency_ms']:.2f}ms avg, {mv_results['p95_latency_ms']:.2f}ms P95")
    
    # Compare results
    print("\n" + "="*60)
    print("PERFORMANCE COMPARISON")
    print("="*60)
    
    improvement = ((direct_results['avg_latency_ms'] - mv_results['avg_latency_ms']) / direct_results['avg_latency_ms']) * 100
    target = 1.25
    
    print(f"Performance improvement: {improvement:.1f}%")
    print(f"Target SLA: {target}ms")
    print(f"Materialized view vs target: {mv_results['avg_latency_ms'] - target:.2f}ms difference")
    
    if mv_results['avg_latency_ms'] <= target:
        print("✅ SLA TARGET MET")
    else:
        print("❌ SLA TARGET MISSED")
        print(f"Need {((mv_results['avg_latency_ms'] - target) / target) * 100:.1f}% improvement")

if __name__ == "__main__":
    asyncio.run(main())