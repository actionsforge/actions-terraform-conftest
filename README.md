# Terraform Conftest GitHub Action

Reusable GitHub Action to run Conftest validation on Terraform plan output.

## Features

- ✅ Runs Terraform test, plan, and Conftest validation
- ✅ Supports version pinning for both Terraform and Conftest
- ✅ Uses GitHub Actions tool cache for fast subsequent runs
- ✅ Generates Terraform plan in JSON format for Conftest
- ✅ Configurable workflow steps (test, plan, conftest)
- ✅ Detailed outputs for integration with other actions

## Usage

### Basic Example

```yaml
name: Terraform Conftest

on:
  pull_request:
    paths:
      - 'terraform/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Run Terraform Conftest
        uses: actionsforge/actions-terraform-conftest@v1
        with:
          conftest-version: 'latest'
          policy-path: './policy'
          working-directory: './terraform'
```

### Advanced Example

```yaml
name: Terraform Conftest

on:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: '1.6.0'

      - name: Run Terraform Conftest
        uses: actionsforge/actions-terraform-conftest@v1
        with:
          conftest-version: 'v0.66.0'
          terraform-version: '1.6.0'
          policy-path: './policies'
          working-directory: './infrastructure'
          run-terraform-test: 'true'
          run-terraform-plan: 'true'
          run-conftest: 'true'
          terraform-plan-file: 'plan.json'

      - name: Check results
        run: |
          echo "Plan file: ${{ steps.conftest.outputs.plan-file }}"
          echo "Passed: ${{ steps.conftest.outputs.conftest-passed }}"
          echo "Violations: ${{ steps.conftest.outputs.violations-count }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `conftest-version` | Conftest version (e.g., `v0.66.0`) or `latest` | No | `latest` |
| `terraform-version` | Terraform version for hashicorp/setup-terraform | No | (uses setup-terraform default) |
| `policy-path` | Path to conftest policy files (Rego) | No | `./policy` |
| `working-directory` | Terraform working directory | No | `.` |
| `run-terraform-test` | Run `terraform test` | No | `true` |
| `run-terraform-plan` | Run `terraform plan` and generate JSON | No | `true` |
| `run-conftest` | Run conftest validation | No | `true` |
| `terraform-plan-file` | Output file for terraform plan JSON | No | `tfplan.json` |

## Outputs

| Output | Description |
|-------|-------------|
| `plan-file` | Path to the generated Terraform plan JSON file |
| `conftest-passed` | Whether conftest validation passed (`true` or `false`) |
| `violations-count` | Number of policy violations found |

## Workflow

The action executes the following steps (configurable):

1. **Setup Conftest**: Downloads and caches the specified conftest version
2. **Terraform Init**: Runs `terraform init` in the working directory
3. **Terraform Test** (optional): Runs `terraform test` if enabled
4. **Terraform Plan**: Runs `terraform plan` and converts to JSON format
5. **Conftest Validation**: Runs `conftest test` against the plan JSON

## Policy Files

Create Rego policy files in your policy directory. Example:

```rego
# policy/main.rego
package terraform

# Deny resources without tags
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_instance"
    not resource.change.after.tags
    msg := sprintf("Resource %s is missing required tags", [resource.address])
}

# Deny public S3 buckets
deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_s3_bucket"
    resource.change.after.public_access_block_configuration == null
    msg := sprintf("S3 bucket %s must have public access block enabled", [resource.address])
}
```

## Version Management

- **Conftest**: Specify a version like `v0.66.0` or use `latest` to get the newest version
- **Terraform**: Use the `terraform-version` input or rely on `hashicorp/setup-terraform@v3` defaults
- Both tools are cached by GitHub Actions, so subsequent runs are fast

## Requirements

- Terraform must be installed (use `hashicorp/setup-terraform@v3` before this action)
- Conftest policies must be in Rego format
- Terraform plan JSON format is required for conftest validation

## Examples

### Skip Terraform Test

```yaml
- uses: actionsforge/actions-terraform-conftest@v1
  with:
    run-terraform-test: 'false'
    run-terraform-plan: 'true'
    run-conftest: 'true'
```

### Only Run Conftest (Plan Already Generated)

```yaml
- uses: actionsforge/actions-terraform-conftest@v1
  with:
    run-terraform-test: 'false'
    run-terraform-plan: 'false'
    run-conftest: 'true'
    terraform-plan-file: './existing-plan.json'
```

### Custom Policy Path

```yaml
- uses: actionsforge/actions-terraform-conftest@v1
  with:
    policy-path: './.github/policies'
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
