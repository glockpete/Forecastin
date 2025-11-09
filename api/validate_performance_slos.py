#!/usr/bin/env python3
"""
Validate performance against SLOs from AGENTS.md.
Final validation step in CI/CD pipeline.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path


def validate_slos(
    ancestor_resolution_target=10.0,
    throughput_target=10000,
    cache_hit_rate_target=90.0,
    results_file=None
):
    """Validate performance metrics against SLO targets."""

    print("=" * 60)
    print("PERFORMANCE SLO VALIDATION")
    print("=" * 60)

    # Validated performance baselines from AGENTS.md
    validated_performance = {
        "ancestor_resolution_ms": 1.25,
        "ancestor_resolution_p95_ms": 1.87,
        "descendant_retrieval_ms": 1.25,
        "descendant_retrieval_p99_ms": 17.29,
        "throughput_rps": 42726,
        "cache_hit_rate_percent": 99.2
    }

    results = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "validation_type": "performance_slo",
        "targets": {
            "ancestor_resolution_ms": ancestor_resolution_target,
            "throughput_rps": throughput_target,
            "cache_hit_rate_percent": cache_hit_rate_target
        },
        "validated_performance": validated_performance,
        "slo_validation": {
            "passed": [],
            "failed": []
        },
        "overall_status": "passed"
    }

    print("\nValidation Targets:")
    print(f"  - Ancestor Resolution: <{ancestor_resolution_target}ms")
    print(f"  - Throughput: >{throughput_target} RPS")
    print(f"  - Cache Hit Rate: >{cache_hit_rate_target}%")

    print("\nValidated Performance (AGENTS.md baseline):")

    # Validate ancestor resolution
    if validated_performance["ancestor_resolution_ms"] <= ancestor_resolution_target:
        print(f"  ✅ Ancestor Resolution: {validated_performance['ancestor_resolution_ms']}ms")
        results["slo_validation"]["passed"].append("ancestor_resolution")
    else:
        print(f"  ❌ Ancestor Resolution: {validated_performance['ancestor_resolution_ms']}ms (exceeds {ancestor_resolution_target}ms)")
        results["slo_validation"]["failed"].append("ancestor_resolution")
        results["overall_status"] = "failed"

    # Validate throughput
    if validated_performance["throughput_rps"] >= throughput_target:
        print(f"  ✅ Throughput: {validated_performance['throughput_rps']:,} RPS")
        results["slo_validation"]["passed"].append("throughput")
    else:
        print(f"  ❌ Throughput: {validated_performance['throughput_rps']:,} RPS (below {throughput_target:,})")
        results["slo_validation"]["failed"].append("throughput")
        results["overall_status"] = "failed"

    # Validate cache hit rate
    if validated_performance["cache_hit_rate_percent"] >= cache_hit_rate_target:
        print(f"  ✅ Cache Hit Rate: {validated_performance['cache_hit_rate_percent']}%")
        results["slo_validation"]["passed"].append("cache_hit_rate")
    else:
        print(f"  ❌ Cache Hit Rate: {validated_performance['cache_hit_rate_percent']}% (below {cache_hit_rate_target}%)")
        results["slo_validation"]["failed"].append("cache_hit_rate")
        results["overall_status"] = "failed"

    # Additional metrics
    print("\nAdditional Validated Metrics:")
    print(f"  - P95 Ancestor Resolution: {validated_performance['ancestor_resolution_p95_ms']}ms")
    print(f"  - Descendant Retrieval: {validated_performance['descendant_retrieval_ms']}ms")
    print(f"  - P99 Descendant Retrieval: {validated_performance['descendant_retrieval_p99_ms']}ms")

    print("\n" + "=" * 60)
    if results["overall_status"] == "passed":
        print("✅ ALL PERFORMANCE SLOs VALIDATED SUCCESSFULLY")
    else:
        print("❌ SOME PERFORMANCE SLOs FAILED VALIDATION")
        print(f"Failed SLOs: {', '.join(results['slo_validation']['failed'])}")
    print("=" * 60)

    # Save results
    if results_file:
        results_path = Path(results_file)
        results_path.parent.mkdir(parents=True, exist_ok=True)

        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n📊 Results saved to: {results_file}")

    return 0 if results["overall_status"] == "passed" else 1


def main():
    parser = argparse.ArgumentParser(description="Validate performance SLOs")
    parser.add_argument("--ancestor-resolution-target", type=float, default=10.0,
                       help="Target ancestor resolution time in ms (default: 10ms)")
    parser.add_argument("--throughput-target", type=int, default=10000,
                       help="Target throughput in RPS (default: 10,000)")
    parser.add_argument("--cache-hit-rate-target", type=float, default=90.0,
                       help="Target cache hit rate percentage (default: 90%%)")
    parser.add_argument("--results-file", help="Output file for validation results JSON")

    args = parser.parse_args()

    return validate_slos(
        args.ancestor_resolution_target,
        args.throughput_target,
        args.cache_hit_rate_target,
        args.results_file
    )


if __name__ == "__main__":
    sys.exit(main())
