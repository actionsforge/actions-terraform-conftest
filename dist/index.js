"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var core4 = __toESM(require("@actions/core"));
var path3 = __toESM(require("path"));

// src/setup-conftest.ts
var core = __toESM(require("@actions/core"));
var tc = __toESM(require("@actions/tool-cache"));
var exec = __toESM(require("@actions/exec"));
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var https = __toESM(require("https"));
var CONFTEST_REPO = "open-policy-agent/conftest";
var CONFTEST_BINARY_NAME = "conftest";
async function resolveLatestVersion() {
  return new Promise((resolve, reject) => {
    try {
      const options = {
        hostname: "api.github.com",
        path: `/repos/${CONFTEST_REPO}/releases/latest`,
        method: "GET",
        headers: {
          "User-Agent": "actions-terraform-conftest",
          Accept: "application/vnd.github.v3+json"
        }
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const release = JSON.parse(data);
            const version = release.tag_name.startsWith("v") ? release.tag_name.substring(1) : release.tag_name;
            core.info(`Resolved latest version: ${version}`);
            resolve(version);
          } catch (error2) {
            reject(new Error(`Failed to parse GitHub API response: ${error2}`));
          }
        });
      });
      req.on("error", (error2) => {
        reject(new Error(`Failed to fetch latest version: ${error2.message}`));
      });
      req.end();
    } catch (error2) {
      reject(new Error(`Failed to resolve latest version: ${error2}`));
    }
  });
}
function normalizeVersion(version) {
  return version.startsWith("v") ? version.substring(1) : version;
}
async function setupConftest(version) {
  const normalizedVersion = normalizeVersion(version);
  core.info(`Setting up conftest version: ${normalizedVersion}`);
  let resolvedVersion = normalizedVersion;
  if (normalizedVersion === "latest") {
    resolvedVersion = await resolveLatestVersion();
  }
  const cachedPath = tc.find(CONFTEST_BINARY_NAME, resolvedVersion);
  if (cachedPath) {
    core.info(`Using cached conftest at: ${cachedPath}`);
    const conftestPath = path.join(cachedPath, CONFTEST_BINARY_NAME);
    if (fs.existsSync(conftestPath)) {
      await exec.exec("chmod", ["+x", conftestPath]);
      return conftestPath;
    }
  }
  const downloadUrl = `https://github.com/${CONFTEST_REPO}/releases/download/v${resolvedVersion}/conftest_${resolvedVersion}_Linux_x86_64.tar.gz`;
  core.info(`Downloading conftest from: ${downloadUrl}`);
  const downloadPath = await tc.downloadTool(downloadUrl);
  core.info(`Downloaded to: ${downloadPath}`);
  const extractPath = await tc.extractTar(downloadPath);
  core.info(`Extracted to: ${extractPath}`);
  let extractedBinary = path.join(extractPath, CONFTEST_BINARY_NAME);
  if (!fs.existsSync(extractedBinary)) {
    const files = fs.readdirSync(extractPath, { withFileTypes: true });
    for (const file of files) {
      if (file.isDirectory()) {
        const subdirPath = path.join(extractPath, file.name);
        const binaryInSubdir = path.join(subdirPath, CONFTEST_BINARY_NAME);
        if (fs.existsSync(binaryInSubdir)) {
          extractedBinary = binaryInSubdir;
          break;
        }
      } else if (file.name === CONFTEST_BINARY_NAME) {
        extractedBinary = path.join(extractPath, file.name);
        break;
      }
    }
  }
  if (!fs.existsSync(extractedBinary)) {
    throw new Error(`Conftest binary not found in extracted archive at: ${extractPath}`);
  }
  await exec.exec("chmod", ["+x", extractedBinary]);
  const binaryDir = path.dirname(extractedBinary);
  const cachedDir = await tc.cacheDir(binaryDir, CONFTEST_BINARY_NAME, resolvedVersion);
  const cachedBinary = path.join(cachedDir, CONFTEST_BINARY_NAME);
  core.info(`Cached conftest at: ${cachedBinary}`);
  return cachedBinary;
}

// src/terraform.ts
var core2 = __toESM(require("@actions/core"));
var exec3 = __toESM(require("@actions/exec"));
var path2 = __toESM(require("path"));
var fs2 = __toESM(require("fs"));
async function terraformInit(workingDirectory) {
  core2.info("Running terraform init...");
  await exec3.exec("terraform", ["init"], {
    cwd: workingDirectory
  });
}
async function terraformTest(workingDirectory) {
  core2.info("Running terraform test...");
  await exec3.exec("terraform", ["test"], {
    cwd: workingDirectory
  });
}
async function terraformPlan(workingDirectory, planFile) {
  core2.info("Running terraform plan...");
  const planBinary = path2.join(workingDirectory, "tfplan.binary");
  const planJson = path2.join(workingDirectory, planFile);
  await exec3.exec("terraform", ["plan", "-out", planBinary], {
    cwd: workingDirectory
  });
  core2.info(`Converting plan to JSON: ${planJson}`);
  const jsonOutput = [];
  const exitCode = await exec3.exec("terraform", ["show", "-json", planBinary], {
    cwd: workingDirectory,
    listeners: {
      stdout: (data) => {
        jsonOutput.push(data.toString());
      }
    },
    silent: false
  });
  if (exitCode !== 0) {
    throw new Error(`Failed to convert terraform plan to JSON. Exit code: ${exitCode}`);
  }
  const jsonContent = jsonOutput.join("");
  fs2.writeFileSync(planJson, jsonContent);
  core2.info(`Plan JSON written to: ${planJson}`);
  return planJson;
}
async function runTerraform(workingDirectory, runTest, runPlan, planFile) {
  if (!fs2.existsSync(workingDirectory)) {
    throw new Error(`Working directory does not exist: ${workingDirectory}`);
  }
  await terraformInit(workingDirectory);
  if (runTest) {
    await terraformTest(workingDirectory);
  }
  if (runPlan) {
    return await terraformPlan(workingDirectory, planFile);
  }
  return null;
}

// src/conftest.ts
var core3 = __toESM(require("@actions/core"));
var exec5 = __toESM(require("@actions/exec"));
var fs3 = __toESM(require("fs"));
async function runConftest(conftestPath, planFile, policyPath) {
  core3.info(`Running conftest test on: ${planFile}`);
  core3.info(`Using policy path: ${policyPath}`);
  if (!fs3.existsSync(planFile)) {
    throw new Error(`Plan file does not exist: ${planFile}`);
  }
  if (!fs3.existsSync(policyPath)) {
    throw new Error(`Policy path does not exist: ${policyPath}`);
  }
  let exitCode = 0;
  const output = [];
  const errors = [];
  try {
    await exec5.exec(conftestPath, ["test", planFile, "-p", policyPath], {
      listeners: {
        stdout: (data) => {
          output.push(data.toString());
        },
        stderr: (data) => {
          errors.push(data.toString());
        }
      },
      ignoreReturnCode: true
    });
  } catch (error2) {
    exitCode = typeof error2 === "object" && error2 !== null && "code" in error2 ? error2.code : 1;
  }
  const outputText = output.join("");
  const errorText = errors.join("");
  const passed = exitCode === 0;
  const violationsCount = passed ? 0 : parseViolationsCount(outputText + errorText);
  if (!passed) {
    core3.warning(`Conftest found ${violationsCount} policy violation(s)`);
    core3.info("Conftest output:");
    if (outputText) {
      core3.info(outputText);
    }
    if (errorText) {
      core3.error(errorText);
    }
  } else {
    core3.info("Conftest validation passed");
    if (outputText) {
      core3.info(outputText);
    }
  }
  return { passed, violationsCount };
}
function parseViolationsCount(output) {
  const failMatches = output.match(/FAIL/g);
  if (failMatches) {
    return failMatches.length;
  }
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
  if (output.toLowerCase().includes("fail") || output.toLowerCase().includes("deny")) {
    return 1;
  }
  return 0;
}

// src/index.ts
async function run() {
  try {
    const conftestVersion = core4.getInput("conftest-version") || "latest";
    const policyPath = core4.getInput("policy-path") || "./policy";
    const workingDirectory = core4.getInput("working-directory") || ".";
    const runTerraformTest = core4.getBooleanInput("run-terraform-test");
    const runTerraformPlan = core4.getBooleanInput("run-terraform-plan");
    const runConftestValidation = core4.getBooleanInput("run-conftest");
    const terraformPlanFile = core4.getInput("terraform-plan-file") || "tfplan.json";
    core4.info("Starting Terraform Conftest Action");
    core4.info(`Conftest version: ${conftestVersion}`);
    core4.info(`Policy path: ${policyPath}`);
    core4.info(`Working directory: ${workingDirectory}`);
    core4.info(`Run terraform test: ${runTerraformTest}`);
    core4.info(`Run terraform plan: ${runTerraformPlan}`);
    core4.info(`Run conftest: ${runConftestValidation}`);
    core4.info("Setting up conftest...");
    const conftestPath = await setupConftest(conftestVersion);
    core4.addPath(path3.dirname(conftestPath));
    core4.info(`Conftest available at: ${conftestPath}`);
    let planFilePath = null;
    if (runTerraformTest || runTerraformPlan) {
      planFilePath = await runTerraform(
        workingDirectory,
        runTerraformTest,
        runTerraformPlan,
        terraformPlanFile
      );
    }
    let conftestPassed = true;
    let violationsCount = 0;
    if (runConftestValidation) {
      if (!planFilePath) {
        throw new Error(
          "Cannot run conftest: terraform plan was not executed. Set run-terraform-plan to true."
        );
      }
      const result = await runConftest(conftestPath, planFilePath, policyPath);
      conftestPassed = result.passed;
      violationsCount = result.violationsCount;
      if (!conftestPassed) {
        core4.setFailed(`Conftest validation failed with ${violationsCount} violation(s)`);
      }
    }
    if (planFilePath) {
      core4.setOutput("plan-file", planFilePath);
    }
    core4.setOutput("conftest-passed", conftestPassed);
    core4.setOutput("violations-count", violationsCount);
    core4.info("Terraform Conftest Action completed successfully");
  } catch (error2) {
    if (error2 instanceof Error) {
      core4.setFailed(error2.message);
    } else {
      core4.setFailed(`Unknown error: ${error2}`);
    }
  }
}
run();
//# sourceMappingURL=index.js.map