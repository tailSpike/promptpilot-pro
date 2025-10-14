param(
  [string]$Target = (Get-Location).Path,
  [switch]$Force
)

function Copy-ItemSafe {
  param(
    [Parameter(Mandatory=$true)][string]$Source,
    [Parameter(Mandatory=$true)][string]$Destination,
    [switch]$AllowOverwrite
  )
  $destDir = Split-Path -Parent $Destination
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  if ((Test-Path $Destination) -and -not $AllowOverwrite) {
    Write-Host "Skip (exists): $Destination" -ForegroundColor Yellow
  } else {
    Copy-Item -Path $Source -Destination $Destination -Force:$AllowOverwrite
    Write-Host "Copied: $Destination" -ForegroundColor Green
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$kitDocs = @(
  @{ src = Join-Path $root 'docs' 'CONTRIBUTING.md' ; dst = Join-Path $Target 'CONTRIBUTING.md' },
  @{ src = Join-Path $root 'docs' 'STANDARD_WORKFLOW.md' ; dst = Join-Path $Target 'docs' 'STANDARD_WORKFLOW.md' },
  @{ src = Join-Path $root 'docs' 'TESTING_TROPHY.md' ; dst = Join-Path $Target 'docs' 'TESTING_TROPHY.md' },
  @{ src = Join-Path $root 'docs' 'ACCEPTANCE_CRITERIA_TEMPLATE.md' ; dst = Join-Path $Target 'docs' 'ACCEPTANCE_CRITERIA_TEMPLATE.md' },
  @{ src = Join-Path $root 'docs' 'PR_CHECKLIST.md' ; dst = Join-Path $Target '.github' 'PULL_REQUEST_TEMPLATE.md' },
  @{ src = Join-Path $root 'docs' 'ISSUE_TEMPLATE.md' ; dst = Join-Path $Target '.github' 'ISSUE_TEMPLATE.md' }
)

$kitGitHub = @(
  @{ src = Join-Path $root 'github-templates' 'config.yml' ; dst = Join-Path $Target '.github' 'ISSUE_TEMPLATE' 'config.yml' },
  @{ src = Join-Path $root 'github-templates' 'pull_request_template.md' ; dst = Join-Path $Target '.github' 'PULL_REQUEST_TEMPLATE.md' },
  @{ src = Join-Path $root 'github-templates' 'issue_template.md' ; dst = Join-Path $Target '.github' 'ISSUE_TEMPLATE.md' }
)

Write-Host "Applying Project Standards Kit to: $Target" -ForegroundColor Cyan
foreach ($f in $kitDocs) { Copy-ItemSafe -Source $f.src -Destination $f.dst -AllowOverwrite:$Force }
foreach ($f in $kitGitHub) { Copy-ItemSafe -Source $f.src -Destination $f.dst -AllowOverwrite:$Force }
Write-Host "Done." -ForegroundColor Cyan
