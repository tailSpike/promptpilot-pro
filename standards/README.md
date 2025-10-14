# Project Standards Kit

This folder contains copyable, reusable project standards you can drop into any repository to bootstrap consistent engineering practices quickly.

What’s included:
- CONTRIBUTING.md – Core expectations (branches, reviews, testing, workflow)
- STANDARD_WORKFLOW.md – Step-by-step delivery loop
- TESTING_TROPHY.md – Testing strategy and layering
- ACCEPTANCE_CRITERIA_TEMPLATE.md – AC scaffold for stories
- PR_CHECKLIST.md – Same checks as the PR template
- ISSUE_TEMPLATE.md – Same content as the issue template
- github-templates/ – PR + Issue templates and config.yml
- bootstrap.ps1 – PowerShell script to copy these into another repo

## How to adopt in another project (Windows PowerShell)

```powershell
# From this repo root
Set-Location standards
./bootstrap.ps1 -Target "C:\path\to\other-project" -Force
```

Flags:
-Target: path to the target project root (defaults to current directory)
-Force: overwrite existing files if present

After running, review and tweak:
- CODEOWNERS (optional; not included by default)
- SECURITY.md (optional)
- Any repo-specific links in docs
