$email = "script-demo-$([Guid]::NewGuid().ToString('N'))@example.com"
$body = @{ name = 'Script Demo'; email = $email; password = 'testpassword123!' } | ConvertTo-Json

Write-Host "Requesting registration for $email" -ForegroundColor Cyan

try {
	$response = Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/register' -Method Post -Body $body -ContentType 'application/json'

	Write-Host "Registration succeeded:" -ForegroundColor Green
	$response | ConvertTo-Json -Depth 5
}
catch {
	Write-Host "Registration failed:" -ForegroundColor Red
	if ($_.Exception.Response -and $_.Exception.Response.ContentType -like '*application/json*') {
		$errorBody = ($_ | Select-Object -ExpandProperty ErrorDetails).Message
		if (-not $errorBody) {
			$reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
			$errorBody = $reader.ReadToEnd()
		}
		Write-Host $errorBody
	}
	else {
		Write-Host $_
	}
	exit 1
}