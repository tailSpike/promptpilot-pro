# Setup Git hooks for PromptPilot Pro (PowerShell version)
Write-Host "Setting up Git hooks for PromptPilot Pro..." -ForegroundColor Cyan

# Change to project root
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
Set-Location $ProjectRoot

# Check if we're in a git repository
$gitCheck = git rev-parse --git-dir 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Git repository detected" -ForegroundColor Green
} else {
    Write-Host "Not in a git repository. Please run 'git init' first." -ForegroundColor Red
    exit 1
}

$HooksDir = ".git\hooks"

# Make sure hooks directory exists
if (-not (Test-Path $HooksDir)) {
    New-Item -ItemType Directory -Path $HooksDir -Force | Out-Null
    Write-Host "Created hooks directory" -ForegroundColor Green
}

# Check and confirm hooks exist
$PreCommitPath = Join-Path $HooksDir "pre-commit"
$PrePushPath = Join-Path $HooksDir "pre-push"

if (Test-Path $PreCommitPath) {
    Write-Host "Pre-commit hook found and ready" -ForegroundColor Green
} else {
    Write-Host "Pre-commit hook not found at $PreCommitPath" -ForegroundColor Red
    exit 1
}

if (Test-Path $PrePushPath) {
    Write-Host "Pre-push hook found and ready" -ForegroundColor Green
} else {
    Write-Host "Pre-push hook not found at $PrePushPath" -ForegroundColor Red
    exit 1
}

Write-Host "Git hooks setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "The following hooks are now active:" -ForegroundColor Cyan
Write-Host "  • pre-commit: Runs linting and quick tests before each commit"
Write-Host "  • pre-push: Runs comprehensive tests before pushing to remote"
Write-Host ""
Write-Host "To skip hooks temporarily, use:" -ForegroundColor Cyan
Write-Host "  • git commit --no-verify"
Write-Host "  • git push --no-verify"
Write-Host ""
Write-Host "Happy coding!" -ForegroundColor Green