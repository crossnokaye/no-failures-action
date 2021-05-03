# No Failures Action

_A GitHub Action that fails if any previous Job in the `needs` graph fails._

## Usage

The main purpose of this Action is to provide a consistent signal for a repository's [protected branch required checks][branch-protection]. By default, a failed Job causes all dependent jobs (defined by the [`jobs.<job_id>.needs`][jobs.job_id.needs] field in the Workflow YAML) to be marked as skipped. A skipped status check is interpreted as a successful status by the branch protection mechanism, permitting a merge despite the actual failure.

This action walks the `needs` dependency graph, and fails if any of the previous jobs have failed:

```yaml
# /.github/workflows/my-workflow.yml
# ...

jobs:
  A: #...

  B: #...

  Ready-To-Merge:
    needs: [A, B] # Fails if A or B (or any of their dependencies) fail
    if: always() # Required!
    runs-on: ubuntu-latest # Any OS that supports Node v12
    steps:
      - uses: crossnokaye/no-failures-action@v0.1.0
```

### Inputs

_**Note:** all inputs to a GitHub Action must be strings._

#### `github-token`

**Optional?** yes
**Default?** the default `GITHUB_TOKEN` provided to the Job

Specify the GitHub API token to use to query job status and workflow definition information.

```yaml
jobs:
  Ready-To-Merge:
    steps:
      - uses: crossnokaye/no-failures-action@v0.1.0
        with:
          github-token: a-custom-token
```

Alternatively, [`jobs.<job_id>.permissions`][jobs.job_id.permissions] can be used to limit the scope of the token. This Action requires at least `actions: read` and `contents: read` permissions to operate:

```yaml
jobs:
  Ready-To-Merge:
    permissions:
      actions:  read
      contents: read
    steps:
      - uses: crossnokaye/no-failures-action@v0.1.0
```

#### `failure-statuses`

**Optional?** yes
**Default?** `["failure", "cancelled"]`

Defines the Job conclusions that should be considered a failure by this Action. At the time of writing, conclusions can be one of `success`, `failure`, `cancelled`, or `skipped`.

```yaml
jobs:
  Ready-To-Merge:
    steps:
      - uses: crossnokaye/no-failures-action@v0.1.0
        with:
          failure-statuses: '["failure", "skipped", "cancelled"]'
```

[branch-protection]: https://docs.github.com/en/github/administering-a-repository/about-protected-branches#require-status-checks-before-merging
[jobs.job_id.needs]: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#jobsjob_idneeds
[jobs.job_id.permissions]: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#jobsjob_idpermissions
