import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';

/**
 * Runs conftest validation on the plan JSON file
 */
export async function runConftest(
  conftestPath: string,
  planFile: string,
  policyPath: string
): Promise<{ passed: boolean; violationsCount: number }> {
  core.info(`Running conftest test on: ${planFile}`);
  core.info(`Using policy path: ${policyPath}`);

  // Verify plan file exists
  if (!fs.existsSync(planFile)) {
    throw new Error(`Plan file does not exist: ${planFile}`);
  }

  // Verify policy path exists
  if (!fs.existsSync(policyPath)) {
    throw new Error(`Policy path does not exist: ${policyPath}`);
  }

  let exitCode = 0;
  const output: string[] = [];
  const errors: string[] = [];

  try {
    await exec.exec(conftestPath, ['test', planFile, '-p', policyPath], {
      listeners: {
        stdout: (data: Buffer) => {
          output.push(data.toString());
        },
        stderr: (data: Buffer) => {
          errors.push(data.toString());
        }
      },
      ignoreReturnCode: true
    });
  } catch (error) {
    // exec.exec throws if exit code is non-zero, but we're using ignoreReturnCode
    // So we need to check the actual exit code
    exitCode = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: number }).code : 1;
  }

  const outputText = output.join('');
  const errorText = errors.join('');

  // Conftest returns exit code 1 if violations are found
  const passed = exitCode === 0;
  const violationsCount = passed ? 0 : parseViolationsCount(outputText + errorText);

  if (!passed) {
    core.warning(`Conftest found ${violationsCount} policy violation(s)`);
    core.info('Conftest output:');
    if (outputText) {
      core.info(outputText);
    }
    if (errorText) {
      core.error(errorText);
    }
  } else {
    core.info('Conftest validation passed');
    if (outputText) {
      core.info(outputText);
    }
  }

  return { passed, violationsCount };
}

/**
 * Parses the number of violations from conftest output
 */
function parseViolationsCount(output: string): number {
  // Conftest output typically shows violations like:
  // "FAIL - main.tf - <violation message>"
  // or lists them in a structured format
  const failMatches = output.match(/FAIL/g);
  if (failMatches) {
    return failMatches.length;
  }

  // Try to match violation patterns
  const violationPatterns = [
    /(\d+)\s+violation/i,
    /(\d+)\s+test.*fail/i,
    /(\d+)\s+deny/i
  ];

  for (const pattern of violationPatterns) {
    const match = output.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  // If we can't parse, assume at least 1 violation if output contains "FAIL" or "deny"
  if (output.toLowerCase().includes('fail') || output.toLowerCase().includes('deny')) {
    return 1;
  }

  return 0;
}
