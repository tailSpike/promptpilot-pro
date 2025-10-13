param(
    [string]$Spec,
    [switch]$Headless,
    [switch]$StartServers,
    [string]$ApiUrl = 'http://127.0.0.1:3001',
    [string]$BaseUrl = 'http://127.0.0.1:5173'
)

# PromptPilot Pro — Convenience launcher for Cypress with env injection
# - Injects CYPRESS_* env vars so specs that rely on provider keys don't self-skip
# - Optionally runs headless with a specific --spec
# - Does not start servers; for in-app specs, start via ./start.ps1 or use npm run test:e2e:open

function Get-UserEnv {
    param([string]$Name)
    # Prefer current process then user env (set by setx)
    if (Test-Path Env:$Name) {
        try { return (Get-Item Env:$Name).Value } catch { }
    }
    return [Environment]::GetEnvironmentVariable($Name, 'User')
}

function Set-IfMissing {
    param(
        [string]$TargetName,
        [string]$FallbackName
    )
    if (-not (Get-UserEnv $TargetName)) {
        $val = Get-UserEnv $FallbackName
        if ($val) { Set-Item -Path Env:$TargetName -Value $val | Out-Null }
    }
}

function Load-DotEnv {
    param([string]$FilePath)
    $map = @{}
    if (-not (Test-Path $FilePath)) { return $map }
    try {
        foreach ($line in [System.IO.File]::ReadAllLines($FilePath)) {
            if ([string]::IsNullOrWhiteSpace($line)) { continue }
            $trim = $line.Trim()
            if ($trim.StartsWith('#')) { continue }
            $idx = $trim.IndexOf('=')
            if ($idx -lt 1) { continue }
            $key = $trim.Substring(0, $idx).Trim()
            $val = $trim.Substring($idx + 1).Trim()
            if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
                $val = $val.Substring(1, $val.Length - 2)
            }
            if (-not $map.ContainsKey($key)) { $map[$key] = $val }
        }
    } catch {}
    return $map
}

function Set-FromDotEnvIfMissing {
    param(
        [hashtable]$EnvMap,
        [string]$TargetName,
        [string[]]$CandidateKeys
    )
    if (Get-UserEnv $TargetName) { return }
    foreach ($k in $CandidateKeys) {
        if ($EnvMap.ContainsKey($k)) {
            $val = $EnvMap[$k]
            if ([string]::IsNullOrWhiteSpace($val)) { continue }
            if ($val -match 'YOUR_|CHANGEME|<|\*\*') { continue }
            Set-Item -Path Env:$TargetName -Value $val | Out-Null
            break
        }
    }
}

Write-Host "Launching Cypress with provider env injection" -ForegroundColor Green


# Pass-through provider secrets from either CYPRESS_* or base provider vars
Set-IfMissing -TargetName 'CYPRESS_OPENAI_API_KEY' -FallbackName 'OPENAI_API_KEY'
Set-IfMissing -TargetName 'CYPRESS_ANTHROPIC_API_KEY' -FallbackName 'ANTHROPIC_API_KEY'
Set-IfMissing -TargetName 'CYPRESS_GEMINI_API_KEY' -FallbackName 'GEMINI_API_KEY'
Set-IfMissing -TargetName 'CYPRESS_AZURE_OPENAI_ENDPOINT' -FallbackName 'AZURE_OPENAI_ENDPOINT'
Set-IfMissing -TargetName 'CYPRESS_AZURE_OPENAI_API_KEY' -FallbackName 'AZURE_OPENAI_API_KEY'
Set-IfMissing -TargetName 'CYPRESS_AZURE_OPENAI_API_VERSION' -FallbackName 'AZURE_OPENAI_API_VERSION'

# Minimal presence report (no secret values printed)
function Present {
    param([string]$Name)
    if (Get-UserEnv $Name) { return 'present' } else { return 'missing' }
}

# Resolve paths
$scriptRoot = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
if (-not $scriptRoot) { $scriptRoot = Get-Location }
$repoRoot = (Resolve-Path $scriptRoot).Path
$frontendPath = Join-Path $repoRoot 'frontend'
$backendPath = Join-Path $repoRoot 'backend'

if (-not (Test-Path (Join-Path $frontendPath 'package.json'))) {
    throw "Could not find 'frontend/package.json'. Please run from the repository root." 
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not available on PATH. Please install Node.js/npm and retry."
}

# Adjust default BaseUrl for headless server-managed flow (preview runs on 4173)
if ($StartServers -and $Headless -and -not $PSBoundParameters.ContainsKey('BaseUrl')) {
    $BaseUrl = 'http://127.0.0.1:4173'
}

# Inject core app env for Cypress tests
Set-Item -Path Env:CYPRESS_apiUrl -Value $ApiUrl | Out-Null
Set-Item -Path Env:CYPRESS_baseUrl -Value $BaseUrl | Out-Null

# Also attempt to source provider keys from .env files if not already present
$backendEnv = Load-DotEnv -FilePath (Join-Path $backendPath '.env')
$frontendEnv = Load-DotEnv -FilePath (Join-Path $frontendPath '.env')
$mergedEnv = @{}
foreach ($k in $backendEnv.Keys) { $mergedEnv[$k] = $backendEnv[$k] }
foreach ($k in $frontendEnv.Keys) { if (-not $mergedEnv.ContainsKey($k)) { $mergedEnv[$k] = $frontendEnv[$k] } }

Set-FromDotEnvIfMissing -EnvMap $mergedEnv -TargetName 'CYPRESS_OPENAI_API_KEY' -CandidateKeys @('OPENAI_API_KEY','openai_api_key')
Set-FromDotEnvIfMissing -EnvMap $mergedEnv -TargetName 'CYPRESS_ANTHROPIC_API_KEY' -CandidateKeys @('ANTHROPIC_API_KEY','anthropic_api_key')
Set-FromDotEnvIfMissing -EnvMap $mergedEnv -TargetName 'CYPRESS_GEMINI_API_KEY' -CandidateKeys @('GEMINI_API_KEY','gemini_api_key')
Set-FromDotEnvIfMissing -EnvMap $mergedEnv -TargetName 'CYPRESS_AZURE_OPENAI_ENDPOINT' -CandidateKeys @('AZURE_OPENAI_ENDPOINT')
Set-FromDotEnvIfMissing -EnvMap $mergedEnv -TargetName 'CYPRESS_AZURE_OPENAI_API_KEY' -CandidateKeys @('AZURE_OPENAI_API_KEY')
Set-FromDotEnvIfMissing -EnvMap $mergedEnv -TargetName 'CYPRESS_AZURE_OPENAI_API_VERSION' -CandidateKeys @('AZURE_OPENAI_API_VERSION')

# Mirror between CYPRESS_* and base names for robustness
function Mirror-Var {
    param([string]$A, [string]$B)
    $aVal = Get-UserEnv $A
    $bVal = Get-UserEnv $B
    if ($aVal -and -not $bVal) { Set-Item -Path Env:$B -Value $aVal | Out-Null; return }
    if ($bVal -and -not $aVal) { Set-Item -Path Env:$A -Value $bVal | Out-Null; return }
}

Mirror-Var -A 'CYPRESS_OPENAI_API_KEY' -B 'OPENAI_API_KEY'
Mirror-Var -A 'CYPRESS_ANTHROPIC_API_KEY' -B 'ANTHROPIC_API_KEY'
Mirror-Var -A 'CYPRESS_GEMINI_API_KEY' -B 'GEMINI_API_KEY'

# Now print env summary
Write-Host "apiUrl=$ApiUrl, baseUrl=$BaseUrl" -ForegroundColor DarkGray
Write-Host ("OPENAI:  " + (Present 'CYPRESS_OPENAI_API_KEY')) -ForegroundColor DarkGray
Write-Host ("Anthropic:" + (Present 'CYPRESS_ANTHROPIC_API_KEY')) -ForegroundColor DarkGray
Write-Host ("Gemini:   " + (Present 'CYPRESS_GEMINI_API_KEY')) -ForegroundColor DarkGray
Write-Host ("Azure EP: " + (Present 'CYPRESS_AZURE_OPENAI_ENDPOINT')) -ForegroundColor DarkGray
Write-Host ("Azure Key:" + (Present 'CYPRESS_AZURE_OPENAI_API_KEY')) -ForegroundColor DarkGray

# Normalize spec path to frontend workspace if prefixed with 'frontend/'
function Normalize-SpecPath {
    param([string]$SpecPath)
    if (-not $SpecPath) { return $null }
    $sp = $SpecPath -replace '^\.\\', '' -replace '^\.\/', ''
    $sp = $sp -replace '^[Ff]rontend[\\/]', ''
    return $sp
}

# Optionally start servers first
if ($StartServers) {
    if ($Headless) {
        # Full headless flow with servers: build, reset test DB, start servers, run Cypress headless
        $nodeCmd = 'node'
        $nodeArgs = @('scripts\run-e2e.js')
        if ($Spec) {
            $normalized = Normalize-SpecPath -SpecPath $Spec
            $nodeArgs += @('--spec', $normalized)
        }
        Write-Host "Running: $nodeCmd $($nodeArgs -join ' ')" -ForegroundColor Cyan

        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        if ($env:OS -like '*Windows*') {
            $processInfo.FileName = 'cmd.exe'
            $processInfo.Arguments = '/c "' + $nodeCmd + ' ' + ($nodeArgs -join ' ') + '"'
        } else {
            $processInfo.FileName = $nodeCmd
            $processInfo.Arguments = ($nodeArgs -join ' ')
        }
        $processInfo.WorkingDirectory = $repoRoot
        $processInfo.UseShellExecute = $false
        $processInfo.RedirectStandardOutput = $false
        $processInfo.RedirectStandardError = $false

        try {
            $p = [System.Diagnostics.Process]::Start($processInfo)
            $p.WaitForExit()
            exit $p.ExitCode
        } catch {
            Write-Error "Failed to start E2E runner. Details: $($_.Exception.Message)"
            exit 1
        }
    } else {
        # Interactive flow: start servers and open Cypress UI with URLs injected
        $npmArgs = @('run', 'test:e2e:open')
        Write-Host "Running: npm $($npmArgs -join ' ')" -ForegroundColor Cyan

        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        if ($env:OS -like '*Windows*') {
            $processInfo.FileName = 'cmd.exe'
            $processInfo.Arguments = '/c "npm ' + ($npmArgs -join ' ') + '"'
        } else {
            $processInfo.FileName = 'npm'
            $processInfo.Arguments = ($npmArgs -join ' ')
        }
        $processInfo.WorkingDirectory = $repoRoot
        $processInfo.UseShellExecute = $false
        $processInfo.RedirectStandardOutput = $false
        $processInfo.RedirectStandardError = $false

        try {
            $p = [System.Diagnostics.Process]::Start($processInfo)
            $p.WaitForExit()
            exit $p.ExitCode
        } catch {
            Write-Error "Failed to start servers and Cypress UI. Details: $($_.Exception.Message)"
            exit 1
        }
    }
}

# Build command
$npmArgs = @('--prefix', $frontendPath, 'run')
if ($Headless) {
    $npmArgs += 'cypress:run'
} else {
    $npmArgs += 'cypress:open'
}

if ($Spec) {
    $normalized = Normalize-SpecPath -SpecPath $Spec
    $npmArgs += '--'
    $npmArgs += '--spec'
    $npmArgs += $normalized
}

Write-Host "Running: npm $($npmArgs -join ' ')" -ForegroundColor Cyan

# Execute
# Launch via cmd.exe on Windows for reliable npm resolution
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
if ($env:OS -like '*Windows*') {
    $processInfo.FileName = 'cmd.exe'
    $processInfo.Arguments = '/c "npm ' + ($npmArgs -join ' ') + '"'
} else {
    $processInfo.FileName = 'npm'
    $processInfo.Arguments = ($npmArgs -join ' ')
}
$processInfo.WorkingDirectory = $repoRoot
$processInfo.UseShellExecute = $false
$processInfo.RedirectStandardOutput = $false
$processInfo.RedirectStandardError = $false

try {
    $p = [System.Diagnostics.Process]::Start($processInfo)
    $p.WaitForExit()
    exit $p.ExitCode
} catch {
    Write-Error "Failed to start npm. Ensure Node.js/npm are installed and on PATH. Details: $($_.Exception.Message)"
    exit 1
}
