import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

const CONFTEST_REPO = 'open-policy-agent/conftest';
const CONFTEST_BINARY_NAME = 'conftest';

/**
 * Resolves the latest conftest version from GitHub API
 */
async function resolveLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${CONFTEST_REPO}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'actions-terraform-conftest',
          Accept: 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const version = release.tag_name.startsWith('v')
              ? release.tag_name.substring(1)
              : release.tag_name;
            core.info(`Resolved latest version: ${version}`);
            resolve(version);
          } catch (error) {
            reject(new Error(`Failed to parse GitHub API response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to fetch latest version: ${error.message}`));
      });

      req.end();
    } catch (error) {
      reject(new Error(`Failed to resolve latest version: ${error}`));
    }
  });
}

/**
 * Normalizes version string (removes 'v' prefix if present)
 */
function normalizeVersion(version: string): string {
  return version.startsWith('v') ? version.substring(1) : version;
}

/**
 * Downloads and caches conftest binary
 */
export async function setupConftest(version: string): Promise<string> {
  const normalizedVersion = normalizeVersion(version);
  core.info(`Setting up conftest version: ${normalizedVersion}`);

  // Resolve version if "latest"
  let resolvedVersion = normalizedVersion;
  if (normalizedVersion === 'latest') {
    resolvedVersion = await resolveLatestVersion();
  }

  // Check cache first
  const cachedPath = tc.find(CONFTEST_BINARY_NAME, resolvedVersion);
  if (cachedPath) {
    core.info(`Using cached conftest at: ${cachedPath}`);
    const conftestPath = path.join(cachedPath, CONFTEST_BINARY_NAME);
    if (fs.existsSync(conftestPath)) {
      await exec.exec('chmod', ['+x', conftestPath]);
      return conftestPath;
    }
  }

  // Download binary
  const downloadUrl = `https://github.com/${CONFTEST_REPO}/releases/download/v${resolvedVersion}/conftest_${resolvedVersion}_Linux_x86_64.tar.gz`;
  core.info(`Downloading conftest from: ${downloadUrl}`);

  const downloadPath = await tc.downloadTool(downloadUrl);
  core.info(`Downloaded to: ${downloadPath}`);

  // Extract tar.gz
  const extractPath = await tc.extractTar(downloadPath);
  core.info(`Extracted to: ${extractPath}`);

  // Find the conftest binary in the extracted directory
  // The binary might be directly in extractPath or in a subdirectory
  let extractedBinary = path.join(extractPath, CONFTEST_BINARY_NAME);

  if (!fs.existsSync(extractedBinary)) {
    // Check subdirectories
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

  await exec.exec('chmod', ['+x', extractedBinary]);

  // Cache the directory containing the binary
  const binaryDir = path.dirname(extractedBinary);
  const cachedDir = await tc.cacheDir(binaryDir, CONFTEST_BINARY_NAME, resolvedVersion);
  const cachedBinary = path.join(cachedDir, CONFTEST_BINARY_NAME);

  core.info(`Cached conftest at: ${cachedBinary}`);
  return cachedBinary;
}
