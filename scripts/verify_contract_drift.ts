#!/usr/bin/env tsx
/**
 * Contract Drift Verification Script
 *
 * Loads all mock fixtures and validates them against zod schemas.
 * Exits with non-zero code if any validation fails.
 *
 * Usage:
 *   npm run contracts:check
 *   tsx scripts/verify_contract_drift.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import {
  RealtimeMessageSchema,
  RSSItemSchema,
} from '../frontend/src/types/contracts.generated';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

interface ValidationResult {
  file: string;
  success: boolean;
  errors?: z.ZodIssue[];
}

/**
 * Load and parse JSON file
 */
function loadJSONFile(filePath: string): unknown {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate a WebSocket message mock
 */
function validateWebSocketMock(filePath: string): ValidationResult {
  try {
    const data = loadJSONFile(filePath);
    const result = RealtimeMessageSchema.safeParse(data);

    if (result.success) {
      return { file: filePath, success: true };
    } else {
      return { file: filePath, success: false, errors: result.error.issues };
    }
  } catch (error) {
    return {
      file: filePath,
      success: false,
      errors: [{
        code: 'custom',
        path: [],
        message: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

/**
 * Validate an RSS item mock
 */
function validateRSSMock(filePath: string): ValidationResult {
  try {
    const data = loadJSONFile(filePath);
    const result = RSSItemSchema.safeParse(data);

    if (result.success) {
      return { file: filePath, success: true };
    } else {
      return { file: filePath, success: false, errors: result.error.issues };
    }
  } catch (error) {
    return {
      file: filePath,
      success: false,
      errors: [{
        code: 'custom',
        path: [],
        message: error instanceof Error ? error.message : String(error),
      }],
    };
  }
}

/**
 * Find all JSON files in a directory
 */
function findJSONFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(directory, file))
    .sort();
}

/**
 * Print validation result
 */
function printResult(result: ValidationResult, index: number, total: number): void {
  const fileName = path.basename(result.file);
  const prefix = `[${index + 1}/${total}]`;

  if (result.success) {
    console.log(`${colors.green}✓${colors.reset} ${prefix} ${fileName}`);
  } else {
    console.log(`${colors.red}✗${colors.reset} ${prefix} ${fileName}`);
    if (result.errors) {
      result.errors.forEach(error => {
        const pathStr = error.path.length > 0 ? error.path.join('.') : 'root';
        console.log(`  ${colors.red}└─${colors.reset} ${colors.yellow}${pathStr}${colors.reset}: ${error.message}`);
        if ('expected' in error) {
          console.log(`     Expected: ${error.expected}`);
        }
        if ('received' in error) {
          console.log(`     Received: ${error.received}`);
        }
      });
    }
  }
}

/**
 * Print summary
 */
function printSummary(results: ValidationResult[]): void {
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bold}Contract Drift Verification Summary${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`Total:  ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    console.log(`${colors.red}${colors.bold}CONTRACT DRIFT DETECTED!${colors.reset}`);
    console.log(`${failed} mock file(s) failed validation.\n`);
    console.log('This indicates that the mock data does not match the current contract schemas.');
    console.log('Please update either the mocks or the schemas to resolve the drift.\n');
  } else {
    console.log(`${colors.green}${colors.bold}ALL CONTRACTS VALID!${colors.reset}`);
    console.log('No contract drift detected. All mocks conform to schemas.\n');
  }
}

/**
 * Main execution
 */
function main(): void {
  console.log(`${colors.cyan}${colors.bold}Contract Drift Verification${colors.reset}\n`);

  const projectRoot = path.resolve(__dirname, '..');
  const wsMocksDir = path.join(projectRoot, 'frontend', 'mocks', 'ws');
  const rssMocksDir = path.join(projectRoot, 'frontend', 'mocks', 'rss');

  const results: ValidationResult[] = [];

  // Validate WebSocket mocks
  console.log(`${colors.cyan}Validating WebSocket Mocks${colors.reset}`);
  console.log(`Directory: ${wsMocksDir}\n`);

  const wsFiles = findJSONFiles(wsMocksDir);
  if (wsFiles.length === 0) {
    console.log(`${colors.yellow}⚠ No WebSocket mock files found${colors.reset}\n`);
  } else {
    wsFiles.forEach((file, index) => {
      const result = validateWebSocketMock(file);
      results.push(result);
      printResult(result, index, wsFiles.length);
    });
  }

  console.log('');

  // Validate RSS mocks
  console.log(`${colors.cyan}Validating RSS Mocks${colors.reset}`);
  console.log(`Directory: ${rssMocksDir}\n`);

  const rssFiles = findJSONFiles(rssMocksDir);
  if (rssFiles.length === 0) {
    console.log(`${colors.yellow}⚠ No RSS mock files found${colors.reset}\n`);
  } else {
    rssFiles.forEach((file, index) => {
      const result = validateRSSMock(file);
      results.push(result);
      printResult(result, index, rssFiles.length);
    });
  }

  // Print summary
  printSummary(results);

  // Exit with appropriate code
  const hasFailures = results.some(r => !r.success);
  process.exit(hasFailures ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main, validateWebSocketMock, validateRSSMock };
