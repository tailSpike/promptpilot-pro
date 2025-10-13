$ErrorActionPreference = 'Stop'
$api = 'http://localhost:3001/api'
$token = & "$PSScriptRoot\login-demo.ps1"
if (-not $token) { Write-Error 'No token'; exit 1 }
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }

try {
  $workflows = Invoke-RestMethod -Uri "$api/workflows" -Headers $headers -Method Get
  $demo = $workflows.workflows | Where-Object { $_.name -eq 'Demo: Summarize then Bulletize' } | Select-Object -First 1
  if (-not $demo) { Write-Error 'Demo workflow not found'; exit 1 }

  $payload = @{ input = @{ inputText = 'PromptPilot Pro is a workflow platform for building prompt chains and automations.' } } | ConvertTo-Json -Depth 5
  $exec = Invoke-RestMethod -Uri "$api/workflows/$($demo.id)/execute" -Headers $headers -Method Post -Body $payload
  Write-Output $exec.id
} catch {
  Write-Error ("Run failed: {0}" -f $_.Exception.Message)
  exit 1
}
