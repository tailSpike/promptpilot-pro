# PromptPilot Pro Status Check Script
# This script checks the status of development servers

Write-Host " PromptPilot Pro Service Status" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Function to check port status
function Test-Port {
    param([int]$Port, [string]$ServiceName)
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($processes) {
            $processIds = $processes | Select-Object -ExpandProperty OwningProcess
            Write-Host " $ServiceName (Port $Port): RUNNING" -ForegroundColor Green
            $processIds | ForEach-Object {
                try {
                    $process = Get-Process -Id $_ -ErrorAction SilentlyContinue
                    if ($process) {
                        $cpu = $process.CPU
                        $memory = [math]::Round($process.WorkingSet64 / 1MB, 2)
                        Write-Host "    PID: $_, CPU: $cpu, Memory: $memory MB" -ForegroundColor Gray
                    }
                } catch {
                    Write-Host "     Process $_ details unavailable" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host " $ServiceName (Port $Port): NOT RUNNING" -ForegroundColor Red
        }
    } catch {
        Write-Host " $ServiceName (Port $Port): NOT RUNNING" -ForegroundColor Red
    }
}

# Check services
Test-Port -Port 3001 -ServiceName "Backend API"
Test-Port -Port 5173 -ServiceName "Frontend Dev Server"

Write-Host ""
Write-Host " Testing HTTP Endpoints..." -ForegroundColor Cyan

# Test backend health
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($backendResponse.StatusCode -eq 200) {
        Write-Host " Backend API: Responding (Status: $($backendResponse.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "  Backend API: Unexpected status ($($backendResponse.StatusCode))" -ForegroundColor Yellow
    }
} catch {
    Write-Host " Backend API: Not responding" -ForegroundColor Red
}

# Test frontend
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method Head -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host " Frontend: Responding (Status: $($frontendResponse.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "  Frontend: Unexpected status ($($frontendResponse.StatusCode))" -ForegroundColor Yellow
    }
} catch {
    Write-Host " Frontend: Not responding" -ForegroundColor Red
}

Write-Host ""
Write-Host " All Node.js Processes:" -ForegroundColor Cyan
Get-Process -Name "node" -ErrorAction SilentlyContinue | Format-Table Id, ProcessName, CPU, @{Name="Memory(MB)"; Expression={[math]::Round($_.WorkingSet64 / 1MB, 2)}} -AutoSize
