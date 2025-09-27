# 🔐 PromptPilot Pro API Testing Helper
param(
    [switch]$Login,
    [switch]$TestTriggers,
    [switch]$Verbose
)

$API_BASE = "http://localhost:3001/api"
$TEST_EMAIL = "test@example.com"
$TEST_PASSWORD = "password123"

function Write-Success { param([string]$Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }

# Get authentication token
function Get-AuthToken {
    try {
        # Register user (ignore if exists)
        try {
            $registerData = @{ email = $TEST_EMAIL; password = $TEST_PASSWORD; name = "Test User" } | ConvertTo-Json
            Invoke-RestMethod -Uri "$API_BASE/auth/register" -Method POST -Body $registerData -ContentType "application/json" | Out-Null
        } catch { }

        # Login
        $loginData = @{ email = $TEST_EMAIL; password = $TEST_PASSWORD } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method POST -Body $loginData -ContentType "application/json"
        Write-Success "Authentication successful!"
        return $response.token
    } catch {
        Write-Error "Authentication failed: $($_.Exception.Message)"
        return $null
    }
}

# Test trigger operations
function Test-TriggerOperations {
    param([string]$Token)
    
    $headers = @{ "Authorization" = "Bearer $Token"; "Content-Type" = "application/json" }
    
    # Create test workflow
    $workflowData = @{ name = "Test Workflow"; description = "Test"; steps = @() } | ConvertTo-Json
    $workflow = Invoke-RestMethod -Uri "$API_BASE/workflows" -Method POST -Headers $headers -Body $workflowData
    Write-Success "Created test workflow: $($workflow.id)"
    
    # Test trigger creation
    $triggerData = @{ name = "Test Manual Trigger"; type = "MANUAL"; config = @{} } | ConvertTo-Json
    $trigger = Invoke-RestMethod -Uri "$API_BASE/workflows/$($workflow.id)/triggers" -Method POST -Headers $headers -Body $triggerData
    Write-Success "Created trigger: $($trigger.name)"
    
    # Test trigger listing
    $triggers = Invoke-RestMethod -Uri "$API_BASE/workflows/$($workflow.id)/triggers" -Method GET -Headers $headers
    Write-Success "Listed triggers: $($triggers.Count) found"
    
    if ($Verbose) {
        Write-Info "Workflow ID: $($workflow.id)"
        Write-Info "Trigger ID: $($trigger.id)"
    }
}

# Main execution
if ($Login) {
    $token = Get-AuthToken
    if ($token) { Write-Info "Token: $token" }
} elseif ($TestTriggers) {
    $token = Get-AuthToken
    if ($token) { Test-TriggerOperations -Token $token }
} else {
    Write-Host "Usage: .\test-api.ps1 -Login | -TestTriggers [-Verbose]"
}