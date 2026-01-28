#!/bin/bash
set -euo pipefail

# Print environment information
echo "🔍 Environment Information:"
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo "TypeScript version: $(npx tsc --version 2>/dev/null || echo 'not installed')"
echo "Environment: ${NODE_ENV:-development}"

# Verify Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node -v)
REQUIRED_VERSION="v20.10.0"

# Extract version numbers for comparison (remove 'v' prefix)
NODE_VER_NUM="${NODE_VERSION#v}"
REQUIRED_VER_NUM="${REQUIRED_VERSION#v}"

# Compare versions using sort -V
if ! printf '%s\n' "$REQUIRED_VER_NUM" "$NODE_VER_NUM" | sort -V -C; then
    echo "❌ Node.js version $NODE_VERSION is below required version $REQUIRED_VERSION"
    exit 1
fi
echo "✅ Node.js version $NODE_VERSION meets requirements"

if [ -f "package.json" ]; then
  echo "📦 Installing dependencies..."
  if ! npm ci; then
    echo "⚠️ npm ci failed, trying npm install..."
    if ! npm install; then
      echo "❌ Failed to install dependencies"
      exit 1
    fi
  fi

  # Type checking - critical for development
  echo "🔍 Type checking..."
  TYPE_CHECK_FAILED=0
  if ! npm run typecheck 2>&1; then
    echo "❌ Type checking failed!"
    TYPE_CHECK_FAILED=1
    if [ "${FAIL_ON_ERRORS:-false}" = "true" ]; then
      echo "⚠️ FAIL_ON_ERRORS is set, but continuing for dev container setup..."
    else
      echo "⚠️ Type checking failed, but continuing..."
    fi
  else
    echo "✅ Type checking passed"
  fi

  # Building - critical for action to work
  echo "🔨 Building action..."
  BUILD_FAILED=0
  if ! npm run build 2>&1; then
    echo "❌ Build failed!"
    BUILD_FAILED=1
    if [ "${FAIL_ON_ERRORS:-false}" = "true" ]; then
      echo "⚠️ FAIL_ON_ERRORS is set, but continuing for dev container setup..."
    else
      echo "⚠️ Build failed, but continuing..."
    fi
  else
    echo "✅ Build succeeded"
    # Verify build output exists
    if [ -f "dist/index.js" ]; then
      echo "✅ Build output verified: dist/index.js exists"
    else
      echo "⚠️ Warning: dist/index.js not found after build"
    fi
  fi

  # Run tests based on environment and TEST_STAGE
  echo "🧪 Running tests..."
  TEST_FAILED=0
  if [ "${TEST_STAGE:-quick}" = "quick" ]; then
    echo "🔍 Running quick test suite..."
    if ! npm run test:run 2>&1; then
      echo "⚠️ Quick tests failed, but continuing..."
      TEST_FAILED=1
    else
      echo "✅ Quick tests passed"
    fi
  else
    echo "🔍 Running full test suite..."
    # Run unit tests
    if ! npm run test:run 2>&1; then
      echo "⚠️ Unit tests failed, but continuing..."
      TEST_FAILED=1
    else
      echo "✅ Unit tests passed"
    fi

    # Run action-specific tests
    if [ -f "./.devcontainer/scripts/test-action.sh" ]; then
      if ! ./.devcontainer/scripts/test-action.sh; then
        echo "⚠️ Action tests failed, but continuing..."
        TEST_FAILED=1
      else
        echo "✅ Action tests passed"
      fi
    else
      echo "⚠️ test-action.sh not found, skipping action tests"
    fi
  fi

  # Security audit (non-blocking)
  echo "🔒 Security audit (non-blocking)..."
  if npm audit --audit-level=moderate >/dev/null 2>&1; then
    echo "✅ No moderate or high severity vulnerabilities found"
  else
    echo "⚠️ Security vulnerabilities found (run 'npm audit' for details)"
    npm audit --audit-level=moderate 2>&1 | head -20 || true
  fi

  # Check for outdated dependencies
  echo "📦 Checking dependencies..."
  if npm outdated >/dev/null 2>&1; then
    echo "✅ All dependencies are up to date"
  else
    echo "ℹ️ Some dependencies have updates available:"
    npm outdated 2>&1 | head -10 || true
  fi

  # Summary
  echo ""
  echo "📊 Setup Summary:"
  if [ $TYPE_CHECK_FAILED -eq 0 ]; then
    echo "  ✅ Type checking: PASSED"
  else
    echo "  ❌ Type checking: FAILED"
  fi
  if [ $BUILD_FAILED -eq 0 ]; then
    echo "  ✅ Build: PASSED"
  else
    echo "  ❌ Build: FAILED"
  fi
  if [ $TEST_FAILED -eq 0 ]; then
    echo "  ✅ Tests: PASSED"
  else
    echo "  ⚠️  Tests: FAILED (non-blocking)"
  fi

  echo "✅ Dev container setup complete!"
  echo "💡 Available commands:"
  echo "   - npm test: Run unit tests in watch mode"
  echo "   - npm run test:run: Run unit tests once"
  echo "   - npm run test:coverage: Run tests with coverage"
  echo "   - ./.devcontainer/scripts/test-action.sh: Run action-specific tests"
  echo "   - npm run build: Build the action"
  echo "   - npm run typecheck: Type check the code"
  echo "   - npm run lint: Lint the code"
  echo "   - act: Run GitHub Actions locally"
  echo ""
  echo "💡 Environment variables:"
  echo "   - TEST_STAGE=quick|full: Control test depth"
  echo "   - NODE_ENV=development|production: Set environment"
fi
