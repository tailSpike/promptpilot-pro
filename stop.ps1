# PromptPilot Pro Stop Script
# This script stops all development servers

Write-Host " Stopping PromptPilot Pro Development Environment" -ForegroundColor Red
Write-Host "=================================================" -ForegroundColor Red

# Function to kill processes on specific ports
function Stop-ProcessOnPort {
    param([int]$Port)
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
        if ($processes) {
            Write-Host " Stopping processes on port $Port..." -ForegroundColor Yellow
            $processes | ForEach-Object { 
                try {
                    $processName = (Get-Process -Id $_ -ErrorAction SilentlyContinue).ProcessName
                    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
                    Write-Host "    Stopped process $processName (PID: $_)" -ForegroundColor Green
                } catch {
                    Write-Host "     Process $_ was already stopped" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host " No processes running on port $Port" -ForegroundColor Green
        }
    } catch {
        Write-Host " Port $Port is free" -ForegroundColor Green
    }
}

# Stop all Node.js processes
Write-Host " Stopping all Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "    Stopping Node.js process (PID: $($_.Id))" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

# Stop processes on specific ports
Stop-ProcessOnPort -Port 3001
Stop-ProcessOnPort -Port 5173

Write-Host ""
Write-Host " All services stopped!" -ForegroundColor Green
Write-Host " To start services again, run: .\start.ps1" -ForegroundColor Cyan
