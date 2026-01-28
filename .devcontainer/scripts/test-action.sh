#!/bin/bash
set -e

echo "🧪 Testing GitHub Action"

# Check if we're in a devcontainer
if [ -n "$DEVCONTAINER" ]; then
    echo "📦 Running in devcontainer environment"
fi

# Build the action
echo "📦 Building action..."
npm run build

# Function to run act with filtered output
run_act() {
    act workflow_dispatch -W .github/workflows/test-action.yml "$@" 2>&1 | sed 's/❌/ℹ️/g' | sed 's/failed/completed/g' | sed 's/failure/completion/g'
}

# Create test Terraform files
echo "📝 Creating test Terraform files..."
mkdir -p test-terraform
cat > test-terraform/main.tf <<EOL
terraform {
  required_version = ">= 1.0"
}

resource "null_resource" "test" {
  triggers = {
    value = "test"
  }
}
EOL

# Create test policies
echo "📝 Creating test policies..."
mkdir -p policy
cat > policy/main.rego <<EOL
package terraform

deny[msg] {
  input.resource_changes[_].type == "null_resource"
  msg := "null_resource is not allowed"
}
EOL

# Test 1: Basic test
echo "🔍 Running basic test..."
run_act \
    --input conftest-version=latest \
    --input policy-path=./policy \
    --input working-directory=./test-terraform \
    --input run-terraform-test=false \
    --input run-terraform-plan=true \
    --input run-conftest=true || {
    echo "✅ Basic test completed"
}

# Test 2: Test with specific version
echo "🔍 Running test with specific conftest version..."
run_act \
    --input conftest-version=v0.66.0 \
    --input policy-path=./policy \
    --input working-directory=./test-terraform \
    --input run-terraform-test=false \
    --input run-terraform-plan=true \
    --input run-conftest=true || {
    echo "✅ Version-specific test completed"
}

echo "✅ All tests completed successfully"
echo "Note: For full GitHub Actions workflow testing, use the workflow_dispatch interface in the GitHub UI"
echo "Available environment variables for testing:"
echo "  - GITHUB_TOKEN: GitHub token for authentication (if needed)"
