# PromptPilot Pro Development Startup Script
# This script starts both frontend and backend servers with proper port management

Write-Host "Starting PromptPilot Pro Development Environment" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

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

# Kill any existing Node.js processes
Write-Host "Cleaning up existing Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Clean up specific ports
Stop-ProcessOnPort -Port 3001
Stop-ProcessOnPort -Port 5173

Write-Host "Starting Backend Server (Port 3001)..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location C:\work\promptpilot-pro\backend; npm run dev" -WindowStyle Normal

Write-Host "Starting Frontend Server (Port 5173)..." -ForegroundColor Cyan
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location C:\work\promptpilot-pro\frontend; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "Services Started!" -ForegroundColor Green
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Two terminal windows should have opened for backend and frontend servers" -ForegroundColor Yellow
Write-Host "To stop all services, run: .\stop.ps1" -ForegroundColor Yellow
Write-Host "To check status, run: .\status.ps1" -ForegroundColor Yellow

# Test connections
Write-Host ""
Write-Host "Testing connections..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($backendResponse.StatusCode -eq 200) {
        Write-Host "✓ Backend is responding" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Backend may still be starting..." -ForegroundColor Yellow
}

try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method Head -TimeoutSec 10 -ErrorAction SilentlyContinue
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "✓ Frontend is responding" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Frontend may still be starting..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "If services don't start properly, check the terminal windows for error messages." -ForegroundColor Yellow
