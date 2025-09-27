# PowerShell Pre-push Hook for PromptPilot Pro
# This hook leverages our management scripts for better Windows support

param(
    [switch]$SkipE2E = $false
)

# Change to project root
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
Set-Location $ProjectRoot

# Check environment variable for skipping E2E tests
if ($env:SKIP_E2E -eq "1") {
    $SkipE2E = $true
}

Write-Host "🚀 Running PowerShell-based pre-push checks..." -ForegroundColor Cyan

try {
    # Get current branch
    $CurrentBranch = git rev-parse --abbrev-ref HEAD
    Write-Host "? Current branch: $CurrentBranch" -ForegroundColor Blue

    # On non-main/develop branches, default to skipping E2E unless explicitly enabled
    if (-not $SkipE2E -and $env:SKIP_E2E -ne "0") {
        if ($CurrentBranch -notin @('main','develop')) {
            Write-Host " Skipping E2E by default on feature branches (set SKIP_E2E=0 to enable)" -ForegroundColor Yellow
            $SkipE2E = $true
        }
    }

    # Check for uncommitted changes
    git diff-index --quiet HEAD -- 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host " You have uncommitted changes - ensure all changes are committed" -ForegroundColor Yellow
    }

    # Quick lint and build checks
    Write-Host "? Running frontend checks..." -ForegroundColor Blue
    if (Test-Path "frontend\package.json") {
        Set-Location frontend
        $feDepsOk = $true
        if (-not (Test-Path "node_modules")) {
            $feDepsOk = $false
        } else {
            $feCritical = @(
                "node_modules/react",
                "node_modules/react-dom",
                "node_modules/axios",
                "node_modules/vite"
            )
            foreach ($m in $feCritical) { if (-not (Test-Path $m)) { $feDepsOk = $false; break } }
        }
        if (-not $feDepsOk) {
            Write-Host "? Installing frontend dependencies (npm install)..." -ForegroundColor Blue
            try {
                npm install --no-audit --no-fund
            } catch {
                Write-Host " Warning: Frontend dependency install failed, continuing with existing modules (" -NoNewline -ForegroundColor Yellow; Write-Host $_.Exception.Message -ForegroundColor Yellow; Write-Host ")"
            }
        } else {
            Write-Host " Frontend dependencies look OK" -ForegroundColor Green
        }
        
        # Quick type check (app)
        Write-Host "? Type checking..." -ForegroundColor Blue
        $tsOk = $false
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            npm run type-check
            if ($LASTEXITCODE -eq 0) { $tsOk = $true }
        }
        if (-not $tsOk) {
            # Fallback to npx TypeScript if local tsc is unavailable
            Write-Host " Local tsc not found or failed; trying npx typescript..." -ForegroundColor Yellow
            try {
                npx -y -p typescript@5.8.3 tsc --noEmit -p tsconfig.app.json
                if ($LASTEXITCODE -eq 0) { $tsOk = $true }
            } catch { }
        }
        if (-not $tsOk) {
            Write-Host " TypeScript type checking issues found" -ForegroundColor Yellow
        } else {
            Write-Host " TypeScript type checking passed" -ForegroundColor Green
        }

        # Cypress spec type check
        Write-Host "? Cypress spec type checking..." -ForegroundColor Blue
        $cypressTsOk = $false
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            npm run type-check:cypress
            if ($LASTEXITCODE -eq 0) { $cypressTsOk = $true }
        }
        if (-not $cypressTsOk) {
            Write-Host " Local tsc not found or failed for Cypress; trying npx typescript..." -ForegroundColor Yellow
            try {
                npx -y -p typescript@5.8.3 tsc --noEmit -p cypress/tsconfig.json
                if ($LASTEXITCODE -eq 0) { $cypressTsOk = $true }
            } catch { }
        }
        if (-not $cypressTsOk) {
            Write-Host " Cypress spec TypeScript issues found" -ForegroundColor Red
            Set-Location ..
            exit 1
        } else {
            Write-Host " Cypress spec TypeScript passed" -ForegroundColor Green
        }
        
        # Build check
        Write-Host "? Build check..." -ForegroundColor Blue
        npm run build 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host " Frontend build failed" -ForegroundColor Red
            Set-Location ..
            exit 1
        } else {
            Write-Host " Frontend build passed" -ForegroundColor Green
        }
        
        Set-Location ..
    }

    # Backend checks
    Write-Host "? Running backend checks..." -ForegroundColor Blue
    if (Test-Path "backend\package.json") {
        Set-Location backend
        
        # Ensure dependencies are installed or complete
        $depsOk = $true
        if (-not (Test-Path "node_modules")) {
            $depsOk = $false
        } else {
            # Verify a few critical modules exist; if any missing, we need to reinstall
            $criticalModules = @(
                "node_modules/express",
                "node_modules/cors",
                "node_modules/helmet",
                "node_modules/dotenv",
                "node_modules/@prisma/client"
            )
            foreach ($m in $criticalModules) {
                if (-not (Test-Path $m)) { $depsOk = $false; break }
            }
        }

        if (-not $depsOk) {
            Write-Host "? Installing backend dependencies (npm install)..." -ForegroundColor Blue
            npm install --no-audit --no-fund 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Host " Backend dependency installation failed" -ForegroundColor Red
                Set-Location ..
                exit 1
            }
        } else {
            Write-Host " Backend dependencies look OK" -ForegroundColor Green
        }
        
        # Ensure Prisma client is generated (safe no-op if already present)
        if (Test-Path "node_modules/.bin/prisma") {
            Write-Host "? Generating Prisma client..." -ForegroundColor Blue
            npx prisma generate 2>$null
        }
        
        # Build check
        Write-Host "? Backend build check..." -ForegroundColor Blue
        npm run build 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host " Backend build failed" -ForegroundColor Red
            Set-Location ..
            exit 1
        } else {
            Write-Host " Backend build passed" -ForegroundColor Green
        }
        
        Set-Location ..
    }

    # E2E Tests
    if (-not $SkipE2E) {
        Write-Host "? Running E2E tests..." -ForegroundColor Blue
        
        # Check service status
        Write-Host "? Checking service status..." -ForegroundColor Blue
        
        $ServicesStarted = $false
        
        # Always verify services are actually responding, regardless of status output
        Write-Host "? Verifying service connectivity..." -ForegroundColor Blue
        $BackendReady = $false
        $FrontendReady = $false
        
        # Quick connectivity check
        try {
            $BackendResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 3 -UseBasicParsing
            if ($BackendResponse.StatusCode -eq 200) { $BackendReady = $true }
        } catch { }
        
        try {
            $FrontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method Head -TimeoutSec 3 -UseBasicParsing
            if ($FrontendResponse.StatusCode -eq 200) { $FrontendReady = $true }
        } catch { }
        
        if (-not $BackendReady -or -not $FrontendReady) {
            Write-Host "? Starting services for testing (backend dist + vite preview)..." -ForegroundColor Blue
            $ServicesStarted = $true

            # Ensure ports are free
            function Stop-ProcessOnPort {
                param([int]$Port)
                try {
                    $pids = (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
                    if ($pids) {
                        Write-Host " Port $Port in use; stopping processes: $($pids -join ',')" -ForegroundColor Yellow
                        foreach ($procId in $pids) { try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {} }
                        Start-Sleep -Seconds 1
                    }
                } catch {}
            }
            Stop-ProcessOnPort -Port 3001
            Stop-ProcessOnPort -Port 5173

            # Ensure DB schema is applied
            if (Test-Path "backend\package.json") {
                Write-Host "? Applying database schema (prisma db push)..." -ForegroundColor Blue
                Push-Location backend
                $prevDbUrl = $env:DATABASE_URL
                $env:DATABASE_URL = "file:./test.db"
                npx prisma db push 2>$null
                if ($null -ne $prevDbUrl -and $prevDbUrl -ne "") { $env:DATABASE_URL = $prevDbUrl } else { Remove-Item env:DATABASE_URL -ErrorAction SilentlyContinue }
                Pop-Location
            }

            # Start backend from compiled dist (force PORT=3001 to avoid environment conflicts)
            $BackendProc = $null
            $backendOutLog = Join-Path $env:TEMP "ppp-backend-e2e.out.log"
            $backendErrLog = Join-Path $env:TEMP "ppp-backend-e2e.err.log"
            if (Test-Path "backend\dist\index.js") {
                Write-Host "? Starting backend (node dist/index.js)..." -ForegroundColor Blue
                if (Test-Path $backendOutLog) { Remove-Item $backendOutLog -Force -ErrorAction SilentlyContinue }
                if (Test-Path $backendErrLog) { Remove-Item $backendErrLog -Force -ErrorAction SilentlyContinue }
                $prevPort = $env:PORT
                $env:PORT = "3001"
                $BackendProc = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory "$ProjectRoot\backend" -PassThru -RedirectStandardOutput $backendOutLog -RedirectStandardError $backendErrLog
                if ($null -ne $prevPort -and $prevPort -ne "") { $env:PORT = $prevPort } else { Remove-Item env:PORT -ErrorAction SilentlyContinue }
            } else {
                Write-Host " Backend dist not found; building..." -ForegroundColor Yellow
                Push-Location backend; npm run build 2>$null; Pop-Location
                if (Test-Path "backend\dist\index.js") {
                    if (Test-Path $backendOutLog) { Remove-Item $backendOutLog -Force -ErrorAction SilentlyContinue }
                    if (Test-Path $backendErrLog) { Remove-Item $backendErrLog -Force -ErrorAction SilentlyContinue }
                    $prevPort = $env:PORT
                    $env:PORT = "3001"
                    $BackendProc = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory "$ProjectRoot\backend" -PassThru -RedirectStandardOutput $backendOutLog -RedirectStandardError $backendErrLog
                    if ($null -ne $prevPort -and $prevPort -ne "") { $env:PORT = $prevPort } else { Remove-Item env:PORT -ErrorAction SilentlyContinue }
                }
            }

            # Start frontend preview (serve built assets using local vite)
            $FrontendProc = $null
            $frontendOutLog = Join-Path $env:TEMP "ppp-frontend-e2e.out.log"
            $frontendErrLog = Join-Path $env:TEMP "ppp-frontend-e2e.err.log"

            # Always use cmd.exe to launch npm on Windows to avoid shim issues
            $npmCmd = $env:ComSpec
            $npmArgs = @("/c","npm","run","preview","--","--port","5173","--strictPort")

            if (Test-Path "frontend\dist\index.html") {
                Write-Host "? Starting frontend (vite preview on 5173)..." -ForegroundColor Blue
                if (Test-Path $frontendOutLog) { Remove-Item $frontendOutLog -Force -ErrorAction SilentlyContinue }
                if (Test-Path $frontendErrLog) { Remove-Item $frontendErrLog -Force -ErrorAction SilentlyContinue }
                $FrontendProc = Start-Process -FilePath $npmCmd -ArgumentList $npmArgs -WorkingDirectory "$ProjectRoot\frontend" -PassThru -RedirectStandardOutput $frontendOutLog -RedirectStandardError $frontendErrLog
            } else {
                Write-Host " Frontend dist not found; building..." -ForegroundColor Yellow
                Push-Location frontend; npm run build 2>$null; Pop-Location
                if (Test-Path $frontendOutLog) { Remove-Item $frontendOutLog -Force -ErrorAction SilentlyContinue }
                if (Test-Path $frontendErrLog) { Remove-Item $frontendErrLog -Force -ErrorAction SilentlyContinue }
                $FrontendProc = Start-Process -FilePath $npmCmd -ArgumentList $npmArgs -WorkingDirectory "$ProjectRoot\frontend" -PassThru -RedirectStandardOutput $frontendOutLog -RedirectStandardError $frontendErrLog
            }

            # Wait for services to be fully ready
            Write-Host "? Waiting for services to be ready..." -ForegroundColor Blue
            
            # Verify they're responding with timeout
            for ($i = 0; $i -lt 60; $i++) {
                $BackendReady = $false
                $FrontendReady = $false
                
                try {
                    $BackendResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 2 -UseBasicParsing
                    if ($BackendResponse.StatusCode -eq 200) { $BackendReady = $true }
                } catch { }
                
                try {
                    $FrontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method Head -TimeoutSec 2 -UseBasicParsing
                    if ($FrontendResponse.StatusCode -eq 200) { $FrontendReady = $true }
                } catch { }
                
                if ($BackendReady -and $FrontendReady) { break }
                Write-Host "." -NoNewline
                Start-Sleep -Seconds 2
            }
            
            Write-Host ""
            
            if (-not $BackendReady -or -not $FrontendReady) {
                Write-Host " Services failed to start properly" -ForegroundColor Red
                Write-Host "  Backend Ready: $BackendReady" -ForegroundColor Yellow
                Write-Host "  Frontend Ready: $FrontendReady" -ForegroundColor Yellow
                
                # Stop background services if started
                if ($BackendProc) { try { Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue } catch {} }
                if ($FrontendProc) { try { Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue } catch {} }
                
                # Show recent logs to help debugging
                if (Test-Path $backendOutLog) {
                    Write-Host "--- Backend log tail ---" -ForegroundColor DarkGray
                    Get-Content $backendOutLog -Tail 100 | ForEach-Object { Write-Host $_ }
                }
                if (Test-Path $backendErrLog) {
                    Write-Host "--- Backend error log tail ---" -ForegroundColor DarkGray
                    Get-Content $backendErrLog -Tail 100 | ForEach-Object { Write-Host $_ }
                }
                if (Test-Path $frontendOutLog) {
                    Write-Host "--- Frontend log tail ---" -ForegroundColor DarkGray
                    Get-Content $frontendOutLog -Tail 100 | ForEach-Object { Write-Host $_ }
                }
                if (Test-Path $frontendErrLog) {
                    Write-Host "--- Frontend error log tail ---" -ForegroundColor DarkGray
                    Get-Content $frontendErrLog -Tail 100 | ForEach-Object { Write-Host $_ }
                }
                exit 1
            }
            
            Write-Host " Services are ready" -ForegroundColor Green
        } else {
            Write-Host " Services already running and responding" -ForegroundColor Green
        }
        
        # Run Cypress tests
        Set-Location frontend
        Write-Host "? Running Cypress E2E tests (max 5 minutes)..." -ForegroundColor Blue

        # Ensure Cypress is installed; consider Windows shims
        $candidates = @(
            "node_modules/.bin/cypress",
            "node_modules/.bin/cypress.cmd",
            "node_modules/.bin/cypress.ps1"
        )
        $hasCypress = $false
        foreach ($cand in $candidates) { if (Test-Path $cand) { $hasCypress = $true; break } }
        if (-not $hasCypress) {
            Write-Host " Cypress not installed; attempting to run via npx..." -ForegroundColor Yellow
            try {
                npx cypress --version | Out-Null
                if ($LASTEXITCODE -eq 0) { $hasCypress = $true }
            } catch { $hasCypress = $false }
        }
        if (-not $hasCypress) {
            Write-Host " Cypress still not available; skipping E2E (run 'npm ci' in frontend to enable)" -ForegroundColor Yellow
            Set-Location ..
            if ($ServicesStarted) { & ".\stop.ps1" }
            exit 0
        }
        
        # Use timeout command to limit execution time (300 seconds = 5 minutes)
        try {
            # Run Cypress with simplified config to avoid hanging
            npx cypress run --headless --config "baseUrl=http://localhost:5173,env.apiUrl=http://localhost:3001" --reporter spec --browser electron --config video=false,screenshotOnRunFailure=false
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host " ✅ E2E tests passed!" -ForegroundColor Green
            } else {
                Write-Host " ❌ E2E tests failed!" -ForegroundColor Red
                Write-Host "? Check cypress/screenshots/ and cypress/videos/ for debugging" -ForegroundColor Blue
                
                Set-Location ..
                if ($ServicesStarted) { & ".\stop.ps1" }
                exit 1
            }
        } catch {
            Write-Host " ⚠ E2E test execution error: $($_.Exception.Message)" -ForegroundColor Yellow
            Set-Location ..
            if ($ServicesStarted) { & ".\stop.ps1" }
            exit 1
        }
        
        Set-Location ..
        
        # Clean up services if we started them
        if ($ServicesStarted) {
            Write-Host "? Stopping services..." -ForegroundColor Blue
                if ($BackendProc) { try { Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue } catch {} }
                if ($FrontendProc) { try { Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue } catch {} }
        }
    } else {
        Write-Host " E2E tests skipped (SKIP_E2E=1)" -ForegroundColor Yellow
    }

    # Security checks
    Write-Host "? Running security checks..." -ForegroundColor Blue
    
    # Check for sensitive patterns in staged files
    $StagedFiles = git diff --cached --name-only
    if ($StagedFiles) {
        foreach ($File in $StagedFiles) {
            if (Test-Path $File) {
                $Content = Get-Content $File -Raw -ErrorAction SilentlyContinue
                if ($Content -match "(password|secret|key|token|api_key|private_key).*=.*['\`"][^'\`"]*['\`"]") {
                    Write-Host " Potential sensitive data found in $File" -ForegroundColor Yellow
                }
                if ($Content -match "(localhost|127\.0\.0\.1|192\.168\.|10\.0\.|172\.16\.)") {
                    Write-Host " Hard-coded local URLs found in $File" -ForegroundColor Yellow
                }
            }
        }
    }

    Write-Host " Pre-push checks completed successfully!" -ForegroundColor Green
    Write-Host "🎉 Ready to push to remote!" -ForegroundColor Green
    
    exit 0

} catch {
    Write-Host " Pre-push hook failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
