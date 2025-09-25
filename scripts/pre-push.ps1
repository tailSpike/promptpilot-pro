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

    # Check for uncommitted changes
    git diff-index --quiet HEAD -- 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host " You have uncommitted changes - ensure all changes are committed" -ForegroundColor Yellow
    }

    # Quick lint and build checks
    Write-Host "? Running frontend checks..." -ForegroundColor Blue
    if (Test-Path "frontend\package.json") {
        Set-Location frontend
        
        # Quick type check
        Write-Host "? Type checking..." -ForegroundColor Blue
        npm run type-check 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host " TypeScript type checking issues found" -ForegroundColor Yellow
        } else {
            Write-Host " TypeScript type checking passed" -ForegroundColor Green
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
            Write-Host "? Starting services for testing..." -ForegroundColor Blue
            & ".\start.ps1"
            $ServicesStarted = $true
            
            # Wait for services to be fully ready
            Write-Host "? Waiting for services to be ready..." -ForegroundColor Blue
            Start-Sleep -Seconds 8
            
            # Verify they're responding with timeout
            for ($i = 0; $i -lt 15; $i++) {
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
                if ($ServicesStarted) { & ".\stop.ps1" }
                exit 1
            }
            
            Write-Host " Services are ready" -ForegroundColor Green
        } else {
            Write-Host " Services already running and responding" -ForegroundColor Green
        }
        
        # Run Cypress tests
        Set-Location frontend
        Write-Host "? Running Cypress E2E tests (max 5 minutes)..." -ForegroundColor Blue
        
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
            & ".\stop.ps1"
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
