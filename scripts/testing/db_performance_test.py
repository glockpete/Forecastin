"""
Database performance testing script for CI/CD pipeline.
Tests LTREE materialized views, connection pools, and query optimization.
"""

import asyncio
import json
import time
import logging
import argparse
import sys
import statistics
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
import psycopg2
from psycopg2 import pool, OperationalError
import asyncpg
import threading
from concurrent.futures import ThreadPoolExecutor
import random
import string

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class QueryPerformance:
    """Query performance metrics"""
    query_type: str
    execution_time: float
    rows_affected: int
    cache_hit: bool
    timestamp: float

@dataclass
class ConnectionPoolMetrics:
    """Connection pool performance metrics"""
    pool_size: int
    checked_out: int
    idle: int
    overflow: int
    wait_time: float
    timestamp: float

@dataclass
class MaterializedViewMetrics:
    """Materialized view performance metrics"""
    view_name: str
    refresh_time: float
    row_count: int
    size_mb: float
    last_refresh: float
    valid: bool

@dataclass
class DatabasePerformanceReport:
    """Comprehensive database performance report"""
    connection_pool: ConnectionPoolMetrics
    query_performance: List[QueryPerformance]
    materialized_views: List[MaterializedViewMetrics]
    ltree_performance: Dict[str, float]
    slo_validation: Dict[str, Any]
    timestamp: float

class DatabasePerformanceTester:
    """Database performance testing system"""
    
    def __init__(self, db_url: str, test_data_size: str = "medium"):
        self.db_url = db_url
        self.test_data_size = test_data_size
        self.connection_pool = None
        self.test_results = []
        
        # Test data sizes
        self.data_sizes = {
            "small": 1000,
            "medium": 10000,
            "large": 100000,
            "xlarge": 1000000
        }
        
    async def setup(self):
        """Setup database connection and test environment"""
        try:
            # Create connection pool
            self.connection_pool = await asyncpg.create_pool(
                self.db_url,
                min_size=5,
                max_size=20,
                command_timeout=30
            )
            
            # Ensure extensions are available
            await self._setup_extensions()
            
            # Load test data if needed
            if self.test_data_size != "minimal":
                await self._load_test_data()
                
            logger.info("Database performance test environment setup complete")
            
        except Exception as e:
            logger.error(f"Failed to setup database environment: {e}")
            raise
    
    async def _setup_extensions(self):
        """Setup required database extensions"""
        async with self.connection_pool.acquire() as conn:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS ltree;")
            await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    
    async def _load_test_data(self):
        """Load test data for performance testing"""
        data_size = self.data_sizes[self.test_data_size]
        
        async with self.connection_pool.acquire() as conn:
            # Create entities table with hierarchy
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS test_entities (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    parent_id INTEGER REFERENCES test_entities(id),
                    hierarchy_path LTREE,
                    path_depth INTEGER DEFAULT 0,
                    path_hash VARCHAR(64),
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """)
            
            # Create indexes for performance
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_entities_parent ON test_entities(parent_id);")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_entities_hierarchy ON test_entities USING GIST(hierarchy_path);")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_entities_depth ON test_entities(path_depth, hierarchy_path);")
            
            # Clear existing test data
            await conn.execute("DELETE FROM test_entities;")
            
            # Insert hierarchical test data
            await self._insert_hierarchical_data(conn, data_size)
            
            # Refresh materialized views
            await self._refresh_materialized_views(conn)
    
    async def _insert_hierarchical_data(self, conn, count: int):
        """Insert hierarchical test data"""
        logger.info(f"Inserting {count} hierarchical test entities")
        
        # Clear table and reset sequence
        await conn.execute("TRUNCATE test_entities RESTART IDENTITY CASCADE;")
        
        # Insert root entity
        await conn.execute("""
            INSERT INTO test_entities (name, hierarchy_path, path_depth, path_hash)
            VALUES ('root', 'root', 0, 'root');
        """)
        
        # Insert child entities with hierarchical relationships
        batch_size = 1000
        for batch_start in range(1, count, batch_size):
            batch_end = min(batch_start + batch_size, count)
            
            values = []
            for i in range(batch_start, batch_end):
                # Create parent-child relationships
                if i == 1:
                    parent_id = 1  # root
                else:
                    parent_id = random.randint(1, i - 1)
                
                # Generate hierarchical path
                path_depth = min(random.randint(1, 10), 10)  # Max depth 10
                path_components = ['root'] + [f'level{j}' for j in range(path_depth)]
                hierarchy_path = '.'.join(path_components)
                
                # Calculate path hash
                path_hash = hash(hierarchy_path) % (2**32)
                
                values.append(f"('entity_{i}', {parent_id}, '{hierarchy_path}', {path_depth}, {path_hash})")
            
            # Batch insert
            if values:
                query = f"""
                    INSERT INTO test_entities (name, parent_id, hierarchy_path, path_depth, path_hash)
                    VALUES {','.join(values)};
                """
                await conn.execute(query)
        
        logger.info("Test data insertion complete")
    
    async def _refresh_materialized_views(self, conn):
        """Refresh materialized views for performance testing"""
        # Create materialized views if they don't exist
        await conn.execute("""
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_entity_ancestors AS
            SELECT DISTINCT
                e.id,
                e.name,
                e.hierarchy_path,
                e.path_depth,
                array_agg(a.name) as ancestor_names
            FROM test_entities e
            LEFT JOIN test_entities a ON a.hierarchy_path @> e.hierarchy_path
            GROUP BY e.id, e.name, e.hierarchy_path, e.path_depth;
        """)
        
        await conn.execute("""
            CREATE MATERIALIZED VIEW IF NOT EXISTS mv_descendant_counts AS
            SELECT
                e.id,
                e.name,
                COUNT(d.id) as descendant_count
            FROM test_entities e
            LEFT JOIN test_entities d ON d.hierarchy_path @> e.hierarchy_path
            GROUP BY e.id, e.name;
        """)
        
        # Refresh materialized views
        await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;")
        await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts;")
    
    async def test_hierarchy_performance(self) -> Dict[str, float]:
        """Test hierarchy query performance"""
        logger.info("Testing hierarchy query performance")
        
        async with self.connection_pool.acquire() as conn:
            performance_results = {}
            
            # Test 1: Ancestor resolution using materialized view
            start_time = time.time()
            result = await conn.fetch("""
                SELECT ancestor_names
                FROM mv_entity_ancestors
                WHERE id = $1
                LIMIT 1;
            """, random.randint(1, self.data_sizes[self.test_data_size]))
            mv_ancestor_time = (time.time() - start_time) * 1000
            
            # Test 2: Ancestor resolution using LTREE direct
            start_time = time.time()
            result = await conn.fetch("""
                SELECT name
                FROM test_entities
                WHERE hierarchy_path @> (
                    SELECT hierarchy_path FROM test_entities WHERE id = $1
                )
                ORDER BY path_depth;
            """, random.randint(1, self.data_sizes[self.test_data_size]))
            ltree_ancestor_time = (time.time() - start_time) * 1000
            
            # Test 3: Descendant counting using materialized view
            start_time = time.time()
            result = await conn.fetch("""
                SELECT descendant_count
                FROM mv_descendant_counts
                WHERE id = $1;
            """, random.randint(1, self.data_sizes[self.test_data_size]))
            mv_descendant_time = (time.time() - start_time) * 1000
            
            # Test 4: Descendant counting using LTREE direct
            start_time = time.time()
            result = await conn.fetch("""
                SELECT COUNT(*)
                FROM test_entities
                WHERE hierarchy_path @> (
                    SELECT hierarchy_path FROM test_entities WHERE id = $1
                );
            """, random.randint(1, self.data_sizes[self.test_data_size]))
            ltree_descendant_time = (time.time() - start_time) * 1000
            
            # Test 5: Path depth query optimization
            start_time = time.time()
            result = await conn.fetch("""
                SELECT * FROM test_entities
                WHERE path_depth <= $1
                ORDER BY path_depth
                LIMIT 100;
            """, 5)
            path_depth_time = (time.time() - start_time) * 1000
            
            performance_results = {
                "mv_ancestor_resolution_ms": mv_ancestor_time,
                "ltree_ancestor_resolution_ms": ltree_ancestor_time,
                "mv_descendant_counting_ms": mv_descendant_time,
                "ltree_descendant_counting_ms": ltree_descendant_time,
                "path_depth_optimization_ms": path_depth_time
            }
            
            logger.info("Hierarchy performance results:")
            for test, time_ms in performance_results.items():
                logger.info(f"  {test}: {time_ms:.2f}ms")
            
            return performance_results
    
    async def test_connection_pool_performance(self) -> ConnectionPoolMetrics:
        """Test connection pool performance"""
        logger.info("Testing connection pool performance")
        
        async with self.connection_pool.acquire() as conn:
            # Test concurrent connections
            concurrent_tasks = []
            wait_times = []
            
            async def test_connection():
                start_time = time.time()
                async with self.connection_pool.acquire() as temp_conn:
                    await temp_conn.fetch("SELECT 1;")
                    wait_time = time.time() - start_time
                    wait_times.append(wait_time)
            
            # Create concurrent tasks
            for _ in range(15):  # More than pool size to test overflow
                task = asyncio.create_task(test_connection())
                concurrent_tasks.append(task)
            
            # Wait for all tasks
            start_wait = time.time()
            await asyncio.gather(*concurrent_tasks)
            total_wait_time = time.time() - start_wait
            
            return ConnectionPoolMetrics(
                pool_size=20,
                checked_out=len([wt for wt in wait_times if wt > 0.1]),
                idle=20 - len([wt for wt in wait_times if wt > 0.1]),
                overflow=max(0, len(wait_times) - 20),
                wait_time=total_wait_time,
                timestamp=time.time()
            )
    
    async def test_query_performance(self, iterations: int = 100) -> List[QueryPerformance]:
        """Test various query performance patterns"""
        logger.info(f"Testing query performance with {iterations} iterations")
        
        query_performance = []
        
        async with self.connection_pool.acquire() as conn:
            # Test different query types
            queries = [
                ("simple_select", "SELECT id, name FROM test_entities WHERE id = $1;", [1]),
                ("hierarchy_query", """
                    SELECT name FROM test_entities 
                    WHERE hierarchy_path @> (SELECT hierarchy_path FROM test_entities WHERE id = $1)
                    ORDER BY path_depth;
                """, [random.randint(1, self.data_sizes[self.test_data_size])]),
                ("materialized_view", """
                    SELECT ancestor_names FROM mv_entity_ancestors WHERE id = $1;
                """, [random.randint(1, self.data_sizes[self.test_data_size])]),
                ("aggregation", """
                    SELECT path_depth, COUNT(*) 
                    FROM test_entities 
                    GROUP BY path_depth 
                    ORDER BY path_depth;
                """, []),
                ("join_query", """
                    SELECT e.name, p.name as parent_name
                    FROM test_entities e
                    LEFT JOIN test_entities p ON e.parent_id = p.id
                    WHERE e.path_depth <= $1;
                """, [5])
            ]
            
            for query_type, query, params in queries:
                times = []
                for _ in range(iterations):
                    start_time = time.time()
                    try:
                        result = await conn.fetch(query, *params)
                        execution_time = time.time() - start_time
                        times.append(execution_time)
                        
                        query_performance.append(QueryPerformance(
                            query_type=query_type,
                            execution_time=execution_time * 1000,  # Convert to ms
                            rows_affected=len(result),
                            cache_hit=False,  # Would need actual cache analysis
                            timestamp=time.time()
                        ))
                    except Exception as e:
                        logger.warning(f"Query {query_type} failed: {e}")
                
                if times:
                    avg_time = statistics.mean(times) * 1000
                    logger.info(f"  {query_type}: avg {avg_time:.2f}ms ({len(times)} successful)")
        
        return query_performance
    
    async def test_materialized_views(self) -> List[MaterializedViewMetrics]:
        """Test materialized view performance"""
        logger.info("Testing materialized view performance")
        
        materialized_views = []
        
        async with self.connection_pool.acquire() as conn:
            # Test mv_entity_ancestors
            start_time = time.time()
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_ancestors;")
            refresh_time = time.time() - start_time
            
            row_count = await conn.fetchval("SELECT COUNT(*) FROM mv_entity_ancestors;")
            size_result = await conn.fetchrow("""
                SELECT pg_size_pretty(pg_total_relation_size('mv_entity_ancestors')) as size;
            """)
            
            materialized_views.append(MaterializedViewMetrics(
                view_name="mv_entity_ancestors",
                refresh_time=refresh_time,
                row_count=row_count,
                size_mb=float(size_result['size'].replace('MB', '')) if 'MB' in size_result['size'] else 0.1,
                last_refresh=time.time(),
                valid=True
            ))
            
            # Test mv_descendant_counts
            start_time = time.time()
            await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_descendant_counts;")
            refresh_time = time.time() - start_time
            
            row_count = await conn.fetchval("SELECT COUNT(*) FROM mv_descendant_counts;")
            size_result = await conn.fetchrow("""
                SELECT pg_size_pretty(pg_total_relation_size('mv_descendant_counts')) as size;
            """)
            
            materialized_views.append(MaterializedViewMetrics(
                view_name="mv_descendant_counts",
                refresh_time=refresh_time,
                row_count=row_count,
                size_mb=float(size_result['size'].replace('MB', '')) if 'MB' in size_result['size'] else 0.1,
                last_refresh=time.time(),
                valid=True
            ))
        
        return materialized_views
    
    def validate_database_slos(self, report: DatabasePerformanceReport) -> Dict[str, Any]:
        """Validate database performance against SLOs"""
        slos = {
            "hierarchy_resolution": {
                "p95_target_ms": 10,
                "p99_target_ms": 50
            },
            "materialized_view_refresh": {
                "max_refresh_time_ms": 1000,
                "max_size_mb": 100
            },
            "connection_pool": {
                "max_wait_time_ms": 100,
                "max_overflow": 5
            },
            "query_performance": {
                "simple_query_target_ms": 1,
                "complex_query_target_ms": 10
            }
        }
        
        validation_results = {
            "passed": [],
            "failed": [],
            "warnings": [],
            "details": {}
        }
        
        # Validate hierarchy performance
        hierarchy_perf = report.ltree_performance
        
        if hierarchy_perf.get("mv_ancestor_resolution_ms", 0) < slos["hierarchy_resolution"]["p95_target_ms"]:
            validation_results["passed"].append("mv_ancestor_resolution")
        else:
            validation_results["failed"].append("mv_ancestor_resolution")
        
        if hierarchy_perf.get("ltree_ancestor_resolution_ms", 0) < slos["hierarchy_resolution"]["p99_target_ms"]:
            validation_results["passed"].append("ltree_ancestor_resolution")
        else:
            validation_results["failed"].append("ltree_ancestor_resolution")
        
        # Validate materialized views
        for mv in report.materialized_views:
            if mv.refresh_time < slos["materialized_view_refresh"]["max_refresh_time_ms"] / 1000:
                validation_results["passed"].append(f"{mv.view_name}_refresh_time")
            else:
                validation_results["failed"].append(f"{mv.view_name}_refresh_time")
            
            if mv.size_mb < slos["materialized_view_refresh"]["max_size_mb"]:
                validation_results["passed"].append(f"{mv.view_name}_size")
            else:
                validation_results["warnings"].append(f"{mv.view_name}_size")
        
        # Validate connection pool
        pool_metrics = report.connection_pool
        if pool_metrics.wait_time < slos["connection_pool"]["max_wait_time_ms"] / 1000:
            validation_results["passed"].append("connection_pool_wait")
        else:
            validation_results["failed"].append("connection_pool_wait")
        
        if pool_metrics.overflow <= slos["connection_pool"]["max_overflow"]:
            validation_results["passed"].append("connection_pool_overflow")
        else:
            validation_results["warnings"].append("connection_pool_overflow")
        
        # Validate query performance
        query_times = [qp.execution_time for qp in report.query_performance if qp.query_type == "simple_select"]
        if query_times and statistics.mean(query_times) < slos["query_performance"]["simple_query_target_ms"]:
            validation_results["passed"].append("simple_query_performance")
        else:
            validation_results["failed"].append("simple_query_performance")
        
        # Store details
        validation_results["details"] = {
            "hierarchy_performance": hierarchy_perf,
            "materialized_view_refresh_times": {mv.view_name: mv.refresh_time * 1000 for mv in report.materialized_views},
            "connection_pool_wait_time_ms": pool_metrics.wait_time * 1000,
            "average_simple_query_time_ms": statistics.mean(query_times) if query_times else 0
        }
        
        return validation_results
    
    async def run_comprehensive_test(self) -> DatabasePerformanceReport:
        """Run comprehensive database performance test"""
        logger.info("Starting comprehensive database performance test")
        
        await self.setup()
        
        try:
            # Run all performance tests
            hierarchy_performance = await self.test_hierarchy_performance()
            connection_pool_metrics = await self.test_connection_pool_performance()
            query_performance = await self.test_query_performance()
            materialized_view_metrics = await self.test_materialized_views()
            
            # Create comprehensive report
            report = DatabasePerformanceReport(
                connection_pool=connection_pool_metrics,
                query_performance=query_performance,
                materialized_views=materialized_view_metrics,
                ltree_performance=hierarchy_performance,
                slo_validation={},  # Will be filled by validate_database_slos
                timestamp=time.time()
            )
            
            # Validate against SLOs
            report.slo_validation = self.validate_database_slos(report)
            
            return report
            
        finally:
            if self.connection_pool:
                await self.connection_pool.close()
    
    def print_report(self, report: DatabasePerformanceReport):
        """Print database performance report"""
        print("\n" + "="*60)
        print("DATABASE PERFORMANCE TEST REPORT")
        print("="*60)
        
        print("\n--- HIERARCHY PERFORMANCE ---")
        for test, time_ms in report.ltree_performance.items():
            print(f"{test}: {time_ms:.2f}ms")
        
        print("\n--- CONNECTION POOL METRICS ---")
        pool = report.connection_pool
        print(f"Pool Size: {pool.pool_size}")
        print(f"Checked Out: {pool.checked_out}")
        print(f"Idle: {pool.idle}")
        print(f"Overflow: {pool.overflow}")
        print(f"Wait Time: {pool.wait_time * 1000:.2f}ms")
        
        print("\n--- MATERIALIZED VIEWS ---")
        for mv in report.materialized_views:
            print(f"{mv.view_name}:")
            print(f"  Refresh Time: {mv.refresh_time * 1000:.2f}ms")
            print(f"  Row Count: {mv.row_count}")
            print(f"  Size: {mv.size_mb:.2f}MB")
        
        print("\n--- QUERY PERFORMANCE ---")
        query_stats = {}
        for qp in report.query_performance:
            if qp.query_type not in query_stats:
                query_stats[qp.query_type] = []
            query_stats[qp.query_type].append(qp.execution_time)
        
        for query_type, times in query_stats.items():
            avg_time = statistics.mean(times)
            print(f"{query_type}: {avg_time:.2f}ms (avg over {len(times)} runs)")
        
        print("\n--- SLO VALIDATION ---")
        validation = report.slo_validation
        print(f"Passed: {len(validation['passed'])}")
        print(f"Failed: {len(validation['failed'])}")
        print(f"Warnings: {len(validation['warnings'])}")
        
        if validation['failed']:
            print(f"\n❌ FAILED SLOs: {validation['failed']}")
        if validation['warnings']:
            print(f"\n⚠️ WARNINGS: {validation['warnings']}")
        if validation['passed'] and not validation['failed']:
            print("\n✅ All database SLOs validated successfully!")
        
        print("="*60)

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Database performance testing")
    parser.add_argument("--db-url", required=True, help="Database connection URL")
    parser.add_argument("--test-data-size", choices=["small", "medium", "large", "xlarge"], 
                       default="medium", help="Test data size")
    parser.add_argument("--output", help="Output file for performance report")
    
    args = parser.parse_args()
    
    tester = DatabasePerformanceTester(args.db_url, args.test_data_size)
    
    try:
        report = await tester.run_comprehensive_test()
        tester.print_report(report)
        
        if args.output:
            report_dict = asdict(report)
            with open(args.output, 'w') as f:
                json.dump(report_dict, f, indent=2, default=str)
            print(f"\nReport saved to {args.output}")
        
        if report.slo_validation['failed']:
            print(f"\n❌ Database performance validation FAILED: {report.slo_validation['failed']}")
            sys.exit(1)
        else:
            print(f"\n✅ Database performance validation PASSED")
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Database performance test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())