import * as core from '@actions/core';
import * as path from 'path';
import { setupConftest } from './setup-conftest';
import { runTerraform } from './terraform';
import { runConftest } from './conftest';

async function run(): Promise<void> {
  try {
    // Get inputs
    const conftestVersion = core.getInput('conftest-version') || 'latest';
    const policyPath = core.getInput('policy-path') || './policy';
    const workingDirectory = core.getInput('working-directory') || '.';
    const runTerraformTest = core.getBooleanInput('run-terraform-test');
    const runTerraformPlan = core.getBooleanInput('run-terraform-plan');
    const runConftestValidation = core.getBooleanInput('run-conftest');
    const terraformPlanFile = core.getInput('terraform-plan-file') || 'tfplan.json';

    core.info('Starting Terraform Conftest Action');
    core.info(`Conftest version: ${conftestVersion}`);
    core.info(`Policy path: ${policyPath}`);
    core.info(`Working directory: ${workingDirectory}`);
    core.info(`Run terraform test: ${runTerraformTest}`);
    core.info(`Run terraform plan: ${runTerraformPlan}`);
    core.info(`Run conftest: ${runConftestValidation}`);

    // Setup conftest
    core.info('Setting up conftest...');
    const conftestPath = await setupConftest(conftestVersion);
    core.addPath(path.dirname(conftestPath));
    core.info(`Conftest available at: ${conftestPath}`);

    // Run terraform operations
    let planFilePath: string | null = null;
    if (runTerraformTest || runTerraformPlan) {
      planFilePath = await runTerraform(
        workingDirectory,
        runTerraformTest,
        runTerraformPlan,
        terraformPlanFile
      );
    }

    // Run conftest validation
    let conftestPassed = true;
    let violationsCount = 0;

    if (runConftestValidation) {
      if (!planFilePath) {
        throw new Error(
          'Cannot run conftest: terraform plan was not executed. Set run-terraform-plan to true.'
        );
      }

      const result = await runConftest(conftestPath, planFilePath, policyPath);
      conftestPassed = result.passed;
      violationsCount = result.violationsCount;

      if (!conftestPassed) {
        core.setFailed(`Conftest validation failed with ${violationsCount} violation(s)`);
        // Don't continue - the action should fail
        return;
      }
    }

    // Set outputs
    if (planFilePath) {
      core.setOutput('plan-file', planFilePath);
    }
    core.setOutput('conftest-passed', conftestPassed);
    core.setOutput('violations-count', violationsCount);

    core.info('Terraform Conftest Action completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(`Unknown error: ${error}`);
    }
  }
}

run();
