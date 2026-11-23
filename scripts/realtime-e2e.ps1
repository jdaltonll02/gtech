param(
  [string]$ApiOrigin = 'http://localhost:8000',
  [string]$AccessToken = $env:PEPPER_E2E_ACCESS_TOKEN,
  [string]$Phone = '+231770000001',
  [string]$Otp = '000000'
)
$ErrorActionPreference = 'Stop'

function Invoke-Checked {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][scriptblock]$Command
  )
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE."
  }
}

$apiBase = "$($ApiOrigin.TrimEnd('/'))/api/v1"
$readiness = Invoke-RestMethod "$apiBase/readyz" -TimeoutSec 10
if ($readiness.db -ne 'ok' -or $readiness.redis -ne 'ok') {
  throw "Pepper API dependencies are not ready: $($readiness | ConvertTo-Json -Compress)"
}

Invoke-Checked 'Isolated protocol cross-client smoke' {
  docker compose exec -T api npm run realtime:cross-client
}

if ([string]::IsNullOrWhiteSpace($AccessToken)) {
  try {
    $challenge = Invoke-RestMethod "$apiBase/auth/otp/request" -Method Post `
      -ContentType 'application/json' -Body (@{phone=$Phone} | ConvertTo-Json)
    $session = Invoke-RestMethod "$apiBase/auth/otp/verify" -Method Post `
      -ContentType 'application/json' `
      -Body (@{challenge_id=$challenge.challenge_id;code=$Otp} | ConvertTo-Json)
    $AccessToken = $session.access
  } catch {
    throw "Could not authenticate the seeded live client. Seed the stack or pass -AccessToken. $($_.Exception.Message)"
  }
}

$headers = @{Authorization="Bearer $AccessToken"}
$matches = Invoke-RestMethod "$apiBase/matches?limit=1" -Headers $headers
if (-not $matches.results -or $matches.results.Count -eq 0) {
  throw 'The seeded live account has no active match. Run the product smoke workflow once, then retry.'
}

$oldToken = $env:PEPPER_E2E_ACCESS_TOKEN
$oldBase = $env:PEPPER_E2E_API_BASE_URL
try {
  $env:PEPPER_E2E_ACCESS_TOKEN = $AccessToken
  $env:PEPPER_E2E_API_BASE_URL = $ApiOrigin.TrimEnd('/')
  Push-Location web
  try {
    Invoke-Checked 'React production realtime client' {
      npm.cmd run test:realtime:e2e
    }
  } finally { Pop-Location }

  Push-Location app
  try {
    Invoke-Checked 'Flutter production realtime client' {
      flutter test test/live/realtime_live_test.dart `
        --dart-define=RUN_LIVE_REALTIME_TEST=true `
        --dart-define="API_BASE_URL=$($ApiOrigin.TrimEnd('/'))" `
        --dart-define="E2E_ACCESS_TOKEN=$AccessToken" `
        --dart-define="E2E_MATCH_ID=$($matches.results[0].id)"
    }
  } finally { Pop-Location }
} finally {
  $env:PEPPER_E2E_ACCESS_TOKEN = $oldToken
  $env:PEPPER_E2E_API_BASE_URL = $oldBase
}

Write-Host 'Cross-client realtime E2E passed for the isolated protocol, React client, and Flutter client.'
