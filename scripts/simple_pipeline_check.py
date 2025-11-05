#!/usr/bin/env python3
"""
Simple CI/CD Pipeline Validation - Quick Check
"""

import os
import sys
import json
import time
from pathlib import Path

def simple_validation():
    """Simple validation to check if all required files exist"""
    
    print("Starting Simple CI/CD Pipeline Validation")
    print("=" * 50)
    
    # Check if required files exist
    required_files = [
        '.github/workflows/ci-cd-pipeline.yml',
        '.pre-commit-config.yaml',
        'api/tests/test_performance.py',
        'scripts/performance_monitor.py',
        'scripts/db_performance_test.py',
        'scripts/load_test_runner.py',
        'scripts/compliance_evidence_collector.py',
        'api/requirements.txt',
        'frontend/package.json',
        'docker-compose.yml'
    ]
    
    project_root = Path('.')
    results = {
        'total_files': len(required_files),
        'found_files': [],
        'missing_files': [],
        'validation_time': time.time()
    }
    
    print(f"\nChecking {len(required_files)} required files...")
    
    for file_path in required_files:
        full_path = project_root / file_path
        if full_path.exists():
            results['found_files'].append(file_path)
            print(f"[OK] {file_path}")
        else:
            results['missing_files'].append(file_path)
            print(f"[MISSING] {file_path}")
    
    # Summary
    print(f"\nValidation Summary:")
    print(f"   Found: {len(results['found_files'])}/{len(required_files)} files")
    print(f"   Missing: {len(results['missing_files'])} files")
    
    if results['missing_files']:
        print(f"\nMissing Files:")
        for missing in results['missing_files']:
            print(f"   - {missing}")
        return False
    else:
        print(f"\n[SUCCESS] All required files present!")
        return True

def main():
    """Main function"""
    try:
        success = simple_validation()
        
        if success:
            print("\nCI/CD Pipeline Configuration Complete!")
            print("\nNext Steps:")
            print("1. Install dependencies: pip install -r api/requirements.txt")
            print("2. Setup pre-commit: pre-commit install")
            print("3. Run tests: python -m pytest api/tests/")
            print("4. Validate performance: python scripts/performance_monitor.py")
            
            # Save simple results
            with open('simple_pipeline_check.json', 'w') as f:
                json.dump({
                    'status': 'success',
                    'message': 'All CI/CD pipeline files present',
                    'timestamp': time.time(),
                    'validation_complete': True
                }, f, indent=2)
            
            sys.exit(0)
        else:
            print("\nPipeline validation failed - missing files")
            sys.exit(1)
            
    except Exception as e:
        print(f"\nValidation error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()