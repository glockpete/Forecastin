"""
Contract Generation Tests
Validates that the contract generator correctly extracts Python enums and models
"""

import tempfile
from pathlib import Path
import sys

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts' / 'dev'))

from generate_contracts import ContractGenerator


def test_enum_generation():
    """Verify enums are extracted to TypeScript unions"""

    # Create temp Python file with enum
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write('''
from enum import Enum

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
''')
        temp_path = Path(f.name)

    try:
        # Create temp output file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as output:
            output_path = Path(output.name)

        # Generate contracts
        generator = ContractGenerator(temp_path.parent, output_path)
        generator.parse_python_file(temp_path)
        generator.generate_output()

        # Verify output
        output_content = output_path.read_text()

        # Check enum was exported
        assert "export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';" in output_content, \
            f"Expected RiskLevel enum not found in:\n{output_content}"

        # Check it's documented
        assert "Python enum: RiskLevel" in output_content

        print("✅ test_enum_generation passed")

    finally:
        # Cleanup
        temp_path.unlink()
        output_path.unlink()


def test_multiple_enums():
    """Verify multiple enums are all extracted"""

    # Create temp Python file with multiple enums
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write('''
from enum import Enum

class LayerType(str, Enum):
    POINT = 'point'
    POLYGON = 'polygon'
    LINE = 'line'

class FilterStatus(str, Enum):
    APPLIED = 'applied'
    PENDING = 'pending'
    ERROR = 'error'
''')
        temp_path = Path(f.name)

    try:
        # Create temp output file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as output:
            output_path = Path(output.name)

        # Generate contracts
        generator = ContractGenerator(temp_path.parent, output_path)
        generator.parse_python_file(temp_path)
        generator.generate_output()

        # Verify output
        output_content = output_path.read_text()

        # Check both enums were exported
        assert "export type LayerType = 'point' | 'polygon' | 'line';" in output_content
        assert "export type FilterStatus = 'applied' | 'pending' | 'error';" in output_content

        print("✅ test_multiple_enums passed")

    finally:
        # Cleanup
        temp_path.unlink()
        output_path.unlink()


def test_dataclass_and_enum_together():
    """Verify both dataclasses and enums are extracted from same file"""

    # Create temp Python file with both
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write('''
from dataclasses import dataclass
from enum import Enum

class Status(str, Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'

@dataclass
class User:
    name: str
    status: Status
''')
        temp_path = Path(f.name)

    try:
        # Create temp output file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as output:
            output_path = Path(output.name)

        # Generate contracts
        generator = ContractGenerator(temp_path.parent, output_path)
        generator.parse_python_file(temp_path)
        generator.generate_output()

        # Verify output
        output_content = output_path.read_text()

        # Check enum was exported
        assert "export type Status = 'active' | 'inactive';" in output_content

        # Check interface was exported
        assert "export interface User {" in output_content
        assert "name: string;" in output_content
        assert "status: Status;" in output_content

        print("✅ test_dataclass_and_enum_together passed")

    finally:
        # Cleanup
        temp_path.unlink()
        output_path.unlink()


def test_helper_functions_in_output():
    """Verify helper functions are included in generated output"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write('# Empty file')
        temp_path = Path(f.name)

    try:
        # Create temp output file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as output:
            output_path = Path(output.name)

        # Generate contracts
        generator = ContractGenerator(temp_path.parent, output_path)
        generator.generate_output()

        # Verify helper functions exist
        output_content = output_path.read_text()

        assert "export function getConfidence" in output_content
        assert "export function getChildrenCount" in output_content
        assert "export function toCamelCase" in output_content

        print("✅ test_helper_functions_in_output passed")

    finally:
        # Cleanup
        temp_path.unlink()
        output_path.unlink()


if __name__ == '__main__':
    print("Running contract generation tests...")
    print()

    test_enum_generation()
    test_multiple_enums()
    test_dataclass_and_enum_together()
    test_helper_functions_in_output()

    print()
    print("✅ All contract generation tests passed!")
