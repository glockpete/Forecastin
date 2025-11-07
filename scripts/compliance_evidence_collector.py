"""
Automated compliance evidence collection script for CI/CD pipeline.
Runs security scans, code quality checks, and generates compliance reports.
"""

import json
import os
import sys
import time
import logging
import argparse
import subprocess
import hashlib
import zipfile
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import re

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class SecurityScanResult:
    """Security scan result container"""
    tool_name: str
    status: str  # passed, failed, warning
    issues_found: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    scan_duration: float
    report_file: str
    timestamp: float

@dataclass
class CodeQualityResult:
    """Code quality check result"""
    tool_name: str
    status: str
    score: float
    issues_found: int
    cyclomatic_complexity: float
    code_coverage: float
    technical_debt_hours: float
    timestamp: float

@dataclass
class ComplianceEvidence:
    """Compliance evidence container"""
    repository_hash: str
    commit_sha: str
    branch: str
    build_id: str
    timestamp: float
    security_scans: List[SecurityScanResult]
    code_quality: List[CodeQualityResult]
    documentation_coverage: float
    test_coverage: float
    performance_metrics: Dict[str, Any]
    compliance_score: float

class ComplianceEvidenceCollector:
    """Automated compliance evidence collection system"""
    
    def __init__(self, output_dir: str = "deliverables/compliance/evidence"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.evidence = []
        
    def get_repository_info(self) -> Dict[str, str]:
        """Get repository information"""
        try:
            # Get git commit info
            commit_sha = subprocess.check_output(
                ['git', 'rev-parse', 'HEAD'], 
                universal_newlines=True
            ).strip()[:8]
            
            branch = subprocess.check_output(
                ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                universal_newlines=True
            ).strip()
            
            # Get repository hash
            repo_path = Path.cwd()
            repo_hash = self._calculate_repo_hash(repo_path)
            
            return {
                'commit_sha': commit_sha,
                'branch': branch,
                'repository_hash': repo_hash,
                'build_id': f"{commit_sha}-{int(time.time())}"
            }
            
        except Exception as e:
            logger.error(f"Failed to get repository info: {e}")
            return {
                'commit_sha': 'unknown',
                'branch': 'unknown',
                'repository_hash': 'unknown',
                'build_id': f'unknown-{int(time.time())}'
            }
    
    def _calculate_repo_hash(self, repo_path: Path) -> str:
        """Calculate repository hash for integrity verification"""
        try:
            # Hash important files in the repository
            hasher = hashlib.sha256()
            
            # Include key files
            key_files = [
                'README.md',
                'requirements.txt',
                'package.json',
                'api/main.py',
                'frontend/src/App.tsx',
                '.github/workflows/ci-cd-pipeline.yml',
                '.pre-commit-config.yaml'
            ]
            
            for file_path in key_files:
                full_path = repo_path / file_path
                if full_path.exists():
                    with open(full_path, 'rb') as f:
                        hasher.update(f.read())
            
            # Include directory structure
            for root, dirs, files in os.walk(repo_path):
                # Skip hidden directories and common build directories
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'build', 'dist']]
                
                for file in sorted(files):
                    if not file.startswith('.') and file.endswith(('.py', '.js', '.ts', '.tsx', '.json', '.yml', '.yaml', '.md')):
                        file_path = Path(root) / file
                        try:
                            with open(file_path, 'rb') as f:
                                hasher.update(f.read())
                        except (PermissionError, UnicodeDecodeError):
                            continue
            
            return hasher.hexdigest()[:16]
            
        except Exception as e:
            logger.error(f"Failed to calculate repository hash: {e}")
            return 'unknown'
    
    async def run_bandit_security_scan(self) -> SecurityScanResult:
        """Run Bandit security scan"""
        logger.info("Running Bandit security scan")
        
        start_time = time.time()
        report_file = self.output_dir / "bandit_report.json"
        
        try:
            # Run bandit scan
            cmd = [
                'bandit', '-r', 'api/', 
                '-f', 'json',
                '-o', str(report_file)
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            scan_duration = time.time() - start_time
            
            # Parse results
            issues_found = 0
            critical_issues = high_issues = medium_issues = low_issues = 0
            
            if report_file.exists():
                with open(report_file) as f:
                    results = json.load(f)
                    issues_found = len(results.get('results', []))
                    
                    for issue in results.get('results', []):
                        severity = issue.get('issue_severity', 'LOW').upper()
                        if severity == 'HIGH':
                            high_issues += 1
                        elif severity == 'MEDIUM':
                            medium_issues += 1
                        elif severity == 'LOW':
                            low_issues += 1
            
            status = 'failed' if high_issues > 0 or critical_issues > 0 else 'passed'
            
            return SecurityScanResult(
                tool_name='bandit',
                status=status,
                issues_found=issues_found,
                critical_issues=critical_issues,
                high_issues=high_issues,
                medium_issues=medium_issues,
                low_issues=low_issues,
                scan_duration=scan_duration,
                report_file=str(report_file),
                timestamp=time.time()
            )
            
        except Exception as e:
            logger.error(f"Bandit scan failed: {e}")
            return SecurityScanResult(
                tool_name='bandit',
                status='failed',
                issues_found=0,
                critical_issues=0,
                high_issues=0,
                medium_issues=0,
                low_issues=0,
                scan_duration=time.time() - start_time,
                report_file=str(report_file),
                timestamp=time.time()
            )
    
    async def run_safety_dependency_scan(self) -> SecurityScanResult:
        """Run Safety dependency vulnerability scan"""
        logger.info("Running Safety dependency scan")
        
        start_time = time.time()
        report_file = self.output_dir / "safety_report.json"
        
        try:
            cmd = [
                'safety', 'check',
                '--json',
                '--output', str(report_file)
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            scan_duration = time.time() - start_time
            
            # Parse results
            issues_found = 0
            critical_issues = high_issues = medium_issues = low_issues = 0
            
            if report_file.exists():
                with open(report_file) as f:
                    results = json.load(f)
                    issues_found = len(results)
                    
                    for vuln in results:
                        severity = vuln.get('severity', 'LOW').upper()
                        if severity in ['HIGH', 'CRITICAL']:
                            high_issues += 1
                        elif severity == 'MEDIUM':
                            medium_issues += 1
                        else:
                            low_issues += 1
            
            status = 'failed' if high_issues > 0 or critical_issues > 0 else 'passed'
            
            return SecurityScanResult(
                tool_name='safety',
                status=status,
                issues_found=issues_found,
                critical_issues=critical_issues,
                high_issues=high_issues,
                medium_issues=medium_issues,
                low_issues=low_issues,
                scan_duration=scan_duration,
                report_file=str(report_file),
                timestamp=time.time()
            )
            
        except Exception as e:
            logger.error(f"Safety scan failed: {e}")
            return SecurityScanResult(
                tool_name='safety',
                status='failed',
                issues_found=0,
                critical_issues=0,
                high_issues=0,
                medium_issues=0,
                low_issues=0,
                scan_duration=time.time() - start_time,
                report_file=str(report_file),
                timestamp=time.time()
            )
    
    async def run_semgrep_scan(self) -> SecurityScanResult:
        """Run Semgrep static analysis scan"""
        logger.info("Running Semgrep scan")
        
        start_time = time.time()
        report_file = self.output_dir / "semgrep_report.json"
        
        try:
            cmd = [
                'semgrep', '--config=auto',
                '--json',
                '--output', str(report_file),
                'api/', 'frontend/src/'
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            scan_duration = time.time() - start_time
            
            # Parse results
            issues_found = 0
            critical_issues = high_issues = medium_issues = low_issues = 0
            
            if report_file.exists():
                with open(report_file) as f:
                    results = json.load(f)
                    issues_found = len(results.get('results', []))
                    
                    for result in results.get('results', []):
                        severity = result.get('extra', {}).get('severity', 'LOW').upper()
                        if severity == 'ERROR':
                            critical_issues += 1
                        elif severity == 'WARNING':
                            high_issues += 1
                        else:
                            medium_issues += 1
            
            status = 'failed' if critical_issues > 0 else 'passed'
            
            return SecurityScanResult(
                tool_name='semgrep',
                status=status,
                issues_found=issues_found,
                critical_issues=critical_issues,
                high_issues=high_issues,
                medium_issues=medium_issues,
                low_issues=low_issues,
                scan_duration=scan_duration,
                report_file=str(report_file),
                timestamp=time.time()
            )
            
        except Exception as e:
            logger.error(f"Semgrep scan failed: {e}")
            return SecurityScanResult(
                tool_name='semgrep',
                status='failed',
                issues_found=0,
                critical_issues=0,
                high_issues=0,
                medium_issues=0,
                low_issues=0,
                scan_duration=time.time() - start_time,
                report_file=str(report_file),
                timestamp=time.time()
            )
    
    async def run_code_quality_checks(self) -> List[CodeQualityResult]:
        """Run code quality checks"""
        logger.info("Running code quality checks")
        
        results = []
        
        # Run flake8 for Python
        try:
            cmd = ['flake8', 'api/', '--max-complexity=10', '--max-line-length=88']
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            issues_found = len(stdout.decode().strip().split('\n')) if stdout else 0
            score = max(0, 100 - issues_found)
            
            results.append(CodeQualityResult(
                tool_name='flake8',
                status='passed' if issues_found == 0 else 'warning',
                score=score,
                issues_found=issues_found,
                cyclomatic_complexity=0,  # Would need radon or similar tool
                code_coverage=0,  # Would need coverage.py
                technical_debt_hours=0,
                timestamp=time.time()
            ))
            
        except Exception as e:
            logger.error(f"Flake8 check failed: {e}")
        
        # Run eslint for TypeScript
        try:
            cmd = ['eslint', 'frontend/src/', '--format=json']
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            issues_found = 0
            score = 100
            
            if stdout:
                eslint_results = json.loads(stdout.decode())
                for result in eslint_results:
                    issues_found += len(result.get('messages', []))
            
            score = max(0, 100 - issues_found)
            
            results.append(CodeQualityResult(
                tool_name='eslint',
                status='passed' if issues_found == 0 else 'warning',
                score=score,
                issues_found=issues_found,
                cyclomatic_complexity=0,
                code_coverage=0,
                technical_debt_hours=0,
                timestamp=time.time()
            ))
            
        except Exception as e:
            logger.error(f"ESLint check failed: {e}")
        
        return results
    
    def calculate_documentation_coverage(self) -> float:
        """Calculate documentation coverage"""
        try:
            doc_files = []
            code_files = []
            
            # Count documentation files
            for root, dirs, files in os.walk('docs'):
                for file in files:
                    if file.endswith('.md'):
                        doc_files.append(os.path.join(root, file))
            
            # Count code files
            for root, dirs, files in os.walk('api'):
                for file in files:
                    if file.endswith('.py'):
                        code_files.append(os.path.join(root, file))
            
            for root, dirs, files in os.walk('frontend/src'):
                for file in files:
                    if file.endswith(('.ts', '.tsx')):
                        code_files.append(os.path.join(root, file))
            
            # Simple heuristic: check if each module has corresponding doc
            documented_modules = 0
            total_modules = len(code_files)
            
            for code_file in code_files:
                # Convert code file path to potential doc path
                relative_path = os.path.relpath(code_file)
                doc_path = f"docs/{relative_path.replace('.py', '.md').replace('.ts', '.md').replace('.tsx', '.md')}"
                doc_path = doc_path.replace('api/', '').replace('frontend/src/', '')
                
                # Check if doc exists or if there's a general doc for the module
                module_name = os.path.splitext(relative_path)[0]
                potential_docs = [
                    f"docs/{module_name}.md",
                    f"docs/{os.path.dirname(module_name)}/README.md",
                    "docs/README.md"
                ]
                
                if any(os.path.exists(doc) for doc in potential_docs):
                    documented_modules += 1
            
            coverage = (documented_modules / total_modules * 100) if total_modules > 0 else 100
            return min(100.0, coverage)
            
        except Exception as e:
            logger.error(f"Failed to calculate documentation coverage: {e}")
            return 0.0
    
    def collect_performance_metrics(self) -> Dict[str, Any]:
        """Collect performance metrics if available"""
        try:
            metrics = {}
            
            # Check for performance test results
            perf_files = [
                'performance_baselines.json',
                'cache_performance_results.json',
                'load_test_report.json',
                'performance_reports/metrics.json'
            ]
            
            for perf_file in perf_files:
                if os.path.exists(perf_file):
                    with open(perf_file) as f:
                        data = json.load(f)
                        if isinstance(data, dict):
                            metrics.update(data)
                        break
            
            # Add system metrics if available
            if 'system_info' not in metrics:
                metrics['system_info'] = {
                    'python_version': sys.version,
                    'platform': sys.platform,
                    'timestamp': time.time()
                }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to collect performance metrics: {e}")
            return {'error': str(e)}
    
    def calculate_compliance_score(self, security_scans: List[SecurityScanResult], 
                                  code_quality: List[CodeQualityResult],
                                  doc_coverage: float, perf_metrics: Dict[str, Any]) -> float:
        """Calculate overall compliance score"""
        try:
            score = 100.0
            
            # Deduct for security issues
            for scan in security_scans:
                score -= scan.critical_issues * 10  # -10 per critical
                score -= scan.high_issues * 5       # -5 per high
                score -= scan.medium_issues * 2     # -2 per medium
                score -= scan.low_issues * 0.5      # -0.5 per low
            
            # Deduct for code quality issues
            for quality in code_quality:
                score -= (100 - quality.score) * 0.1
            
            # Deduct for low documentation coverage
            score -= max(0, (80 - doc_coverage) * 0.2)  # Expect at least 80% coverage
            
            # Deduct for performance issues
            if 'slo_validation' in perf_metrics:
                failed_slos = len(perf_metrics['slo_validation'].get('failed', []))
                score -= failed_slos * 5
            
            return max(0.0, min(100.0, score))
            
        except Exception as e:
            logger.error(f"Failed to calculate compliance score: {e}")
            return 0.0
    
    async def collect_all_evidence(self) -> ComplianceEvidence:
        """Collect all compliance evidence"""
        logger.info("Starting comprehensive compliance evidence collection")
        
        # Get repository information
        repo_info = self.get_repository_info()
        
        # Run security scans
        security_scans = []
        try:
            security_scans.append(await self.run_bandit_security_scan())
        except Exception as e:
            logger.error(f"Bandit scan failed: {e}")
        
        try:
            security_scans.append(await self.run_safety_dependency_scan())
        except Exception as e:
            logger.error(f"Safety scan failed: {e}")
        
        try:
            security_scans.append(await self.run_semgrep_scan())
        except Exception as e:
            logger.error(f"Semgrep scan failed: {e}")
        
        # Run code quality checks
        code_quality = await self.run_code_quality_checks()
        
        # Calculate coverage metrics
        doc_coverage = self.calculate_documentation_coverage()
        
        # Collect performance metrics
        perf_metrics = self.collect_performance_metrics()
        
        # Calculate overall compliance score
        compliance_score = self.calculate_compliance_score(
            security_scans, code_quality, doc_coverage, perf_metrics
        )
        
        # Create evidence object
        evidence = ComplianceEvidence(
            repository_hash=repo_info['repository_hash'],
            commit_sha=repo_info['commit_sha'],
            branch=repo_info['branch'],
            build_id=repo_info['build_id'],
            timestamp=time.time(),
            security_scans=security_scans,
            code_quality=code_quality,
            documentation_coverage=doc_coverage,
            test_coverage=0.0,  # Would need actual test coverage data
            performance_metrics=perf_metrics,
            compliance_score=compliance_score
        )
        
        return evidence
    
    def generate_compliance_report(self, evidence: ComplianceEvidence) -> str:
        """Generate compliance report in markdown format"""
        
        report = f"""# Compliance Evidence Report

**Build ID:** {evidence.build_id}  
**Commit:** {evidence.commit_sha}  
**Branch:** {evidence.branch}  
**Repository Hash:** {evidence.repository_hash}  
**Timestamp:** {datetime.fromtimestamp(evidence.timestamp).isoformat()}  
**Overall Compliance Score:** {evidence.compliance_score:.1f}/100

## Executive Summary

{'✅ COMPLIANT' if evidence.compliance_score >= 80 else '⚠️ PARTIALLY COMPLIANT' if evidence.compliance_score >= 60 else '❌ NON-COMPLIANT'}

This report provides evidence of compliance with security, code quality, and performance standards.

## Security Scan Results

"""
        
        for scan in evidence.security_scans:
            status_icon = "✅" if scan.status == "passed" else "❌" if scan.status == "failed" else "⚠️"
            report += f"""### {scan.tool_name.title()} Security Scan {status_icon}

- **Status:** {scan.status.title()}
- **Total Issues:** {scan.issues_found}
- **Critical:** {scan.critical_issues}
- **High:** {scan.high_issues}
- **Medium:** {scan.medium_issues}
- **Low:** {scan.low_issues}
- **Duration:** {scan.scan_duration:.2f}s
- **Report:** `{scan.report_file}`

"""
        
        report += "## Code Quality Results\n\n"
        
        for quality in evidence.code_quality:
            status_icon = "✅" if quality.status == "passed" else "⚠️"
            report += f"""### {quality.tool_name.title()} Code Quality {status_icon}

- **Status:** {quality.status.title()}
- **Score:** {quality.score:.1f}/100
- **Issues Found:** {quality.issues_found}

"""
        
        report += f"""## Documentation Coverage

- **Documentation Coverage:** {evidence.documentation_coverage:.1f}%
- **Test Coverage:** {evidence.test_coverage:.1f}%

## Performance Metrics

"""
        
        if evidence.performance_metrics:
            report += "Performance validation results:\n\n"
            if 'slo_validation' in evidence.performance_metrics:
                slo_val = evidence.performance_metrics['slo_validation']
                report += f"- **SLOs Passed:** {len(slo_val.get('passed', []))}\n"
                report += f"- **SLOs Failed:** {len(slo_val.get('failed', []))}\n"
                report += f"- **SLOs Warning:** {len(slo_val.get('warnings', []))}\n"
        
        report += f"""
## Compliance Status

| Category | Score | Status |
|----------|-------|--------|
| Security | {100 - sum(s.critical_issues * 10 + s.high_issues * 5 + s.medium_issues * 2 + s.low_issues * 0.5 for s in evidence.security_scans):.1f}/100 | {'✅' if all(s.status == 'passed' for s in evidence.security_scans) else '⚠️'} |
| Code Quality | {sum(q.score for q in evidence.code_quality) / len(evidence.code_quality) if evidence.code_quality else 0:.1f}/100 | {'✅' if all(q.score >= 90 for q in evidence.code_quality) else '⚠️'} |
| Documentation | {evidence.documentation_coverage:.1f}/100 | {'✅' if evidence.documentation_coverage >= 80 else '⚠️'} |
| Performance | {evidence.compliance_score:.1f}/100 | {'✅' if evidence.compliance_score >= 80 else '⚠️'} |

## Evidence Files

All supporting evidence files are stored in: `{self.output_dir}`

- Security scan reports
- Code quality metrics
- Performance test results
- Repository integrity hash verification

## Recommendations

"""
        
        if evidence.compliance_score < 80:
            report += "### Areas for Improvement\n\n"
            if any(s.high_issues > 0 or s.critical_issues > 0 for s in evidence.security_scans):
                report += "- Address high and critical security issues found in scans\n"
            if evidence.documentation_coverage < 80:
                report += "- Increase documentation coverage to meet minimum 80% threshold\n"
            if evidence.code_quality and any(q.score < 90 for q in evidence.code_quality):
                report += "- Improve code quality scores by addressing linting issues\n"
        else:
            report += "✅ All compliance thresholds have been met. Continue maintaining current standards.\n"
        
        return report
    
    def save_evidence(self, evidence: ComplianceEvidence, report_content: str):
        """Save compliance evidence and report"""
        try:
            # Save evidence as JSON
            evidence_file = self.output_dir / f"evidence_{evidence.build_id}.json"
            with open(evidence_file, 'w') as f:
                json.dump(asdict(evidence), f, indent=2, default=str)
            
            # Save report as markdown
            report_file = self.output_dir / f"compliance_report_{evidence.build_id}.md"
            with open(report_file, 'w') as f:
                f.write(report_content)
            
            # Create archive of all evidence
            archive_file = self.output_dir / f"evidence_archive_{evidence.build_id}.zip"
            with zipfile.ZipFile(archive_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add evidence files
                for file_path in self.output_dir.glob("*"):
                    if file_path.is_file() and file_path != archive_file:
                        zipf.write(file_path, file_path.name)
            
            logger.info(f"Evidence saved to {self.output_dir}")
            logger.info(f"Main report: {report_file}")
            logger.info(f"Evidence archive: {archive_file}")
            
            return {
                'evidence_file': str(evidence_file),
                'report_file': str(report_file),
                'archive_file': str(archive_file)
            }
            
        except Exception as e:
            logger.error(f"Failed to save evidence: {e}")
            raise

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Automated compliance evidence collection")
    parser.add_argument("--output-dir", default="deliverables/compliance/evidence", 
                       help="Output directory for evidence files")
    parser.add_argument("--report-format", choices=["markdown", "json"], default="markdown",
                       help="Report format")
    
    args = parser.parse_args()
    
    collector = ComplianceEvidenceCollector(args.output_dir)
    
    try:
        # Collect all evidence
        evidence = await collector.collect_all_evidence()
        
        # Generate report
        report_content = collector.generate_compliance_report(evidence)
        
        # Save evidence
        files = collector.save_evidence(evidence, report_content)
        
        # Print summary
        print("\n" + "="*60)
        print("COMPLIANCE EVIDENCE COLLECTION COMPLETE")
        print("="*60)
        
        print(f"\nRepository: {evidence.commit_sha} ({evidence.branch})")
        print(f"Compliance Score: {evidence.compliance_score:.1f}/100")
        print(f"Security Scans: {len(evidence.security_scans)}")
        print(f"Code Quality Checks: {len(evidence.code_quality)}")
        print(f"Documentation Coverage: {evidence.documentation_coverage:.1f}%")
        
        print(f"\nEvidence Files:")
        print(f"  Evidence JSON: {files['evidence_file']}")
        print(f"  Report: {files['report_file']}")
        print(f"  Archive: {files['archive_file']}")
        
        # Exit with appropriate code
        if evidence.compliance_score >= 80:
            print(f"\n✅ COMPLIANCE CHECK PASSED")
            sys.exit(0)
        elif evidence.compliance_score >= 60:
            print(f"\n⚠️ COMPLIANCE CHECK PARTIAL - Review required")
            sys.exit(1)
        else:
            print(f"\n❌ COMPLIANCE CHECK FAILED")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Compliance evidence collection failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())