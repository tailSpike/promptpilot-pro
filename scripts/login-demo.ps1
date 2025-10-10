$ErrorActionPreference = 'Stop'
$api = 'http://localhost:3001/api'
$email = 'demo@example.com'
$password = 'demo123!'

try {
  # Try register (ignore if already exists)
  try {
    $regBody = @{ email = $email; password = $password; name = 'Demo User' } | ConvertTo-Json
    Invoke-RestMethod -Uri "$api/auth/register" -Method Post -Body $regBody -ContentType 'application/json' | Out-Null
  } catch { }

  $body = @{ email = $email; password = $password } | ConvertTo-Json
  $resp = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -Body $body -ContentType 'application/json'
  if ($resp -and $resp.token) {
    Write-Output $resp.token
  } else {
    Write-Error 'Login did not return a token.'
    exit 1
  }
} catch {
  Write-Error ("Login failed: {0}" -f $_.Exception.Message)
  exit 1
}
