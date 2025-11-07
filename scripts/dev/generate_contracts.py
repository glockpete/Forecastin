#!/usr/bin/env python3
"""
Contract Generation Script
Generates TypeScript interfaces from Python Pydantic models and dataclasses

Usage:
    python scripts/dev/generate_contracts.py

Output:
    types/contracts.generated.ts

Requirements:
    pip install ast typing-inspect
"""

import ast
import re
from pathlib import Path
from typing import Dict, List, Set
from datetime import datetime


class ContractGenerator:
    """Generates TypeScript interfaces from Python type definitions"""

    # Python → TypeScript type mapping
    TYPE_MAP = {
        'str': 'string',
        'int': 'number',
        'float': 'number',
        'bool': 'boolean',
        'dict': 'Record<string, any>',
        'list': 'any[]',
        'Dict': 'Record<string, any>',
        'List': 'Array',
        'Optional': '| null',
        'UUID': 'string',
        'datetime': 'string',  # ISO 8601 string
        'Decimal': 'number',
        'Any': 'any',
    }

    def __init__(self, backend_dir: Path, output_file: Path):
        self.backend_dir = backend_dir
        self.output_file = output_file
        self.interfaces: List[str] = []
        self.processed_classes: Set[str] = set()

    def parse_python_file(self, file_path: Path) -> None:
        """Parse a Python file and extract dataclasses and Pydantic models"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                tree = ast.parse(f.read(), filename=str(file_path))

            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    # Check if it's a dataclass or Pydantic model
                    if self._is_dataclass_or_model(node):
                        interface = self._generate_interface(node, file_path)
                        if interface and node.name not in self.processed_classes:
                            self.interfaces.append(interface)
                            self.processed_classes.add(node.name)

        except Exception as e:
            print(f"Warning: Failed to parse {file_path}: {e}")

    def _is_dataclass_or_model(self, node: ast.ClassDef) -> bool:
        """Check if a class is a dataclass or Pydantic BaseModel"""
        # Check decorators for @dataclass
        for decorator in node.decorator_list:
            if isinstance(decorator, ast.Name) and decorator.id == 'dataclass':
                return True
            if isinstance(decorator, ast.Attribute):
                if decorator.attr == 'dataclass':
                    return True

        # Check if it inherits from BaseModel (Pydantic)
        for base in node.bases:
            if isinstance(base, ast.Name) and base.id == 'BaseModel':
                return True

        return False

    def _generate_interface(self, node: ast.ClassDef, source_file: Path) -> str:
        """Generate TypeScript interface from Python class"""
        interface_lines = [
            f"/**",
            f" * Generated from: {source_file.relative_to(self.backend_dir)}",
            f" * Python class: {node.name}",
            f" */",
            f"export interface {node.name} {{",
        ]

        # Extract fields from class body
        for item in node.body:
            if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                field_name = item.target.id
                field_type = self._convert_type(item.annotation)

                # Convert snake_case to camelCase
                ts_field_name = self._to_camel_case(field_name)

                # Check if field has default value (makes it optional)
                is_optional = item.value is not None or 'Optional' in ast.dump(item.annotation)

                optional_suffix = '?' if is_optional else ''

                interface_lines.append(f"  {ts_field_name}{optional_suffix}: {field_type};")

        interface_lines.append("}")
        interface_lines.append("")  # Blank line between interfaces

        return "\n".join(interface_lines)

    def _convert_type(self, annotation: ast.expr) -> str:
        """Convert Python type annotation to TypeScript type"""
        if isinstance(annotation, ast.Name):
            return self.TYPE_MAP.get(annotation.id, annotation.id)

        if isinstance(annotation, ast.Subscript):
            # Handle List[T], Dict[K, V], Optional[T], etc.
            value = annotation.value

            if isinstance(value, ast.Name):
                base_type = value.id

                if base_type == 'List':
                    element_type = self._convert_type(annotation.slice)
                    return f"{element_type}[]"

                if base_type == 'Dict':
                    if isinstance(annotation.slice, ast.Tuple):
                        key_type = self._convert_type(annotation.slice.elts[0])
                        value_type = self._convert_type(annotation.slice.elts[1])
                        return f"Record<{key_type}, {value_type}>"
                    return "Record<string, any>"

                if base_type == 'Optional':
                    inner_type = self._convert_type(annotation.slice)
                    return f"{inner_type} | null"

        if isinstance(annotation, ast.Constant):
            # Handle literal types (e.g., Literal['high', 'low'])
            return f"'{annotation.value}'"

        if isinstance(annotation, ast.BinOp):
            # Handle Union types (e.g., str | int)
            if isinstance(annotation.op, ast.BitOr):
                left = self._convert_type(annotation.left)
                right = self._convert_type(annotation.right)
                return f"{left} | {right}"

        # Fallback
        return "any"

    def _to_camel_case(self, snake_str: str) -> str:
        """Convert snake_case to camelCase"""
        components = snake_str.split('_')
        return components[0] + ''.join(x.title() for x in components[1:])

    def scan_backend_directory(self) -> None:
        """Recursively scan backend directory for Python files"""
        service_files = [
            self.backend_dir / 'api' / 'services' / 'feature_flag_service.py',
            self.backend_dir / 'api' / 'services' / 'scenario_service.py',
            self.backend_dir / 'api' / 'services' / 'hierarchical_forecast_service.py',
            self.backend_dir / 'api' / 'main.py',
        ]

        for file_path in service_files:
            if file_path.exists():
                print(f"Parsing: {file_path}")
                self.parse_python_file(file_path)
            else:
                print(f"Warning: File not found: {file_path}")

    def generate_output(self) -> None:
        """Generate the final TypeScript file"""
        header = f'''/**
 * AUTO-GENERATED TypeScript Interfaces from Backend Pydantic Models
 * Generated: {datetime.now().isoformat()}
 *
 * DO NOT EDIT MANUALLY - Regenerate using: npm run generate:contracts
 *
 * Source: scripts/dev/generate_contracts.py
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

'''

        footer = '''
/**
 * Utility: Convert snake_case to camelCase
 * Use this for runtime object key transformation if backend sends snake_case
 */
export function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}
'''

        content = header + "\n".join(self.interfaces) + footer

        self.output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.output_file, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"\n✅ Generated {len(self.interfaces)} interfaces in {self.output_file}")


def main():
    """Main entry point"""
    # Determine project root (assumes script is in scripts/dev/)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent

    backend_dir = project_root
    output_file = project_root / 'types' / 'contracts.generated.ts'

    print("=== Contract Generation Starting ===")
    print(f"Backend directory: {backend_dir}")
    print(f"Output file: {output_file}")
    print()

    generator = ContractGenerator(backend_dir, output_file)
    generator.scan_backend_directory()
    generator.generate_output()

    print("\n=== Contract Generation Complete ===")
    print("Next steps:")
    print("1. Review the generated file for correctness")
    print("2. Run: npm run type-check")
    print("3. Run: npm test -- contract_drift.spec.ts")


if __name__ == '__main__':
    main()
