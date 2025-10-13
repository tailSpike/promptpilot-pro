param(
    [switch]$Clean
)

# PromptPilot Pro Development Startup Script
# - Ensures dependencies are installed
# - Starts backend (3001) and frontend (5173) reliably on Windows
# - Waits for health checks and shows friendly diagnostics

Write-Host "Starting PromptPilot Pro Development Environment" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

$scriptRoot = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
if (-not $scriptRoot) {
    $scriptRoot = Get-Location
}
$repoRoot = (Resolve-Path $scriptRoot).Path
$backendPath = Join-Path $repoRoot 'backend'
$frontendPath = Join-Path $repoRoot 'frontend'

# Function to kill processes on specific ports
function Stop-ProcessOnPort {
    param([int]$Port)
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($processes) {
            Write-Host "Port $Port is in use. Stopping existing processes..." -ForegroundColor Yellow
            $processes | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
            Start-Sleep -Seconds 2
        }
    } catch {
        # Port not in use, continue
    }
}
    # Ensure required tools
    function Assert-Tool {
        param([string]$Name)
        if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
            throw "Required tool '$Name' not found in PATH. Please install it and retry."
        }
    }

    function Ensure-Dependencies {
        param(
            [string]$Path,
            [string]$PackageHint = ''
        )
        Push-Location $Path
        try {
            $needInstall = $false
            if (-not (Test-Path (Join-Path $Path 'node_modules'))) { $needInstall = $true }
            elseif ($PackageHint -ne '') {
                try {
                    node -e "require('$PackageHint')" 2>$null | Out-Null
                } catch {
                    $needInstall = $true
                }
            }

            if ($Clean) {
                Write-Host "Running clean install in $Path..." -ForegroundColor Yellow
                if (Test-Path (Join-Path $Path 'package-lock.json')) {
                    npm ci | Out-Host
                } else {
                    npm install | Out-Host
                }
            } elseif ($needInstall) {
                Write-Host "Installing dependencies in $Path..." -ForegroundColor Yellow
                npm install | Out-Host
            } else {
                Write-Host "Dependencies OK in $Path" -ForegroundColor DarkGreen
            }
        } finally {
            Pop-Location
        }
    }

    function Start-AppProcess {
        param(
            [string]$Path,
            [string]$NpmScript,
            [string]$Name
        )
        try {
            # Prefer launching new window that remains open
            Start-Process -FilePath "cmd.exe" -ArgumentList "/k","npm run $NpmScript" -WorkingDirectory $Path -WindowStyle Normal | Out-Null
        } catch {
            Write-Host "⚠ Failed to open new terminal window for $Name. Starting in background job instead." -ForegroundColor Yellow
            $log = Join-Path $Path "$NpmScript.log"
            Start-Job -ScriptBlock {
                param($workDir, $scriptName)
                Set-Location $workDir
                npm run $scriptName *>> ($scriptName + '.log')
            } -ArgumentList $Path, $NpmScript | Out-Null
            Write-Host "$Name logs: $log" -ForegroundColor Yellow
        }
    }

    function Wait-For-Http {
        param(
            [string]$Url,
            [int]$TimeoutSeconds = 60
        )
        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
        while ((Get-Date) -lt $deadline) {
            try {
                $resp = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 -ErrorAction Stop
                if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) { return $true }
            } catch { Start-Sleep -Milliseconds 800 }
        }
        return $false
    }


# Kill any existing Node.js processes
Write-Host "Cleaning up existing Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Clean up specific ports
Stop-ProcessOnPort -Port 3001
Stop-ProcessOnPort -Port 5173

Write-Host "Ensuring development database schema is up to date..." -ForegroundColor Yellow
try {
    Push-Location $backendPath
    # Minimal tool checks and dependency ensure
    Assert-Tool node
    Assert-Tool npm
    Ensure-Dependencies -Path $backendPath -PackageHint 'express'

    npx prisma generate | Out-Host
    npx prisma db push | Out-Host
}
catch {
    Write-Host "⚠ Failed to synchronize database schema. Check the output above." -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}

Write-Host "Starting Backend Server (Port 3001)..." -ForegroundColor Cyan
Start-AppProcess -Path $backendPath -NpmScript 'dev' -Name 'backend'

Write-Host "Starting Frontend Server (Port 5173)..." -ForegroundColor Cyan
Ensure-Dependencies -Path $frontendPath -PackageHint 'vite'
Start-AppProcess -Path $frontendPath -NpmScript 'dev' -Name 'frontend'

Write-Host ""
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Write-Host "Waiting for backend health (http://localhost:3001/api/health)..." -ForegroundColor Yellow
$backendOk = Wait-For-Http -Url 'http://localhost:3001/api/health' -TimeoutSeconds 60
if ($backendOk) { Write-Host "✓ Backend is responding" -ForegroundColor Green } else { Write-Host "⚠ Backend did not respond within timeout" -ForegroundColor Yellow }

Write-Host "Waiting for frontend (http://localhost:5173)..." -ForegroundColor Yellow
$frontendOk = Wait-For-Http -Url 'http://localhost:5173' -TimeoutSeconds 60
if ($frontendOk) { Write-Host "✓ Frontend is responding" -ForegroundColor Green } else { Write-Host "⚠ Frontend did not respond within timeout" -ForegroundColor Yellow }

# If backend is not up, try starting it inline as a last resort (visible output)
if (-not $backendOk) {
    Write-Host "Attempting to start backend inline as fallback..." -ForegroundColor Yellow
    Push-Location $backendPath
    try {
    $env:PORT = '3001'
    # Ensure ts-node registers with transpile-only
    $env:TS_NODE_TRANSPILE_ONLY = 'true'
    npx nodemon src/index.ts
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Services Started!" -ForegroundColor Green
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Two terminal windows should have opened for backend and frontend servers" -ForegroundColor Yellow
Write-Host "To stop all services, run: .\stop.ps1" -ForegroundColor Yellow
Write-Host "To check status, run: .\status.ps1" -ForegroundColor Yellow

Write-Host ""
Write-Host "If services don't start properly, open logs or run with -Clean to reinstall dependencies:" -ForegroundColor Yellow
Write-Host "  .\start.ps1 -Clean" -ForegroundColor Yellow
Write-Host "Backend window: npm run dev (in backend/)" -ForegroundColor DarkGray
Write-Host "Frontend window: npm run dev (in frontend/)" -ForegroundColor DarkGray
