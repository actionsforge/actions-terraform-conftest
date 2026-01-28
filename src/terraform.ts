import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Runs terraform init
 */
export async function terraformInit(workingDirectory: string): Promise<void> {
  core.info('Running terraform init...');
  await exec.exec('terraform', ['init'], {
    cwd: workingDirectory
  });
}

/**
 * Runs terraform test
 */
export async function terraformTest(workingDirectory: string): Promise<void> {
  core.info('Running terraform test...');
  await exec.exec('terraform', ['test'], {
    cwd: workingDirectory
  });
}

/**
 * Runs terraform plan and generates JSON output
 */
export async function terraformPlan(
  workingDirectory: string,
  planFile: string
): Promise<string> {
  core.info('Running terraform plan...');

  // Normalize planFile to just the basename (no directory components)
  // since terraform commands run with cwd set to workingDirectory
  const planFileBasename = path.basename(planFile);

  // Use relative filename for terraform commands (since cwd is workingDirectory)
  const planBinaryFilename = 'tfplan.binary';
  const planJson = path.join(workingDirectory, planFileBasename);

  // Run terraform plan with binary output
  // Use relative filename since cwd is set to workingDirectory
  await exec.exec('terraform', ['plan', '-out', planBinaryFilename], {
    cwd: workingDirectory
  });

  // Convert binary plan to JSON
  // Use relative filename since cwd is set to workingDirectory
  core.info(`Converting plan to JSON: ${planJson}`);
  const jsonOutput: string[] = [];
  const exitCode = await exec.exec('terraform', ['show', '-json', planBinaryFilename], {
    cwd: workingDirectory,
    listeners: {
      stdout: (data: Buffer) => {
        jsonOutput.push(data.toString());
      }
    },
    silent: false
  });

  if (exitCode !== 0) {
    throw new Error(`Failed to convert terraform plan to JSON. Exit code: ${exitCode}`);
  }

  // Write JSON to file
  const jsonContent = jsonOutput.join('');
  fs.writeFileSync(planJson, jsonContent);
  core.info(`Plan JSON written to: ${planJson}`);

  return planJson;
}

/**
 * Executes terraform operations based on configuration
 */
export async function runTerraform(
  workingDirectory: string,
  runTest: boolean,
  runPlan: boolean,
  planFile: string
): Promise<string | null> {
  // Ensure working directory exists
  if (!fs.existsSync(workingDirectory)) {
    throw new Error(`Working directory does not exist: ${workingDirectory}`);
  }

  // Run terraform init
  await terraformInit(workingDirectory);

  // Run terraform test if enabled
  if (runTest) {
    await terraformTest(workingDirectory);
  }

  // Run terraform plan if enabled
  if (runPlan) {
    return await terraformPlan(workingDirectory, planFile);
  }

  return null;
}
