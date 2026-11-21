$ErrorActionPreference = 'Stop'

if (-not (Get-Command rg -ErrorAction SilentlyContinue)) {
  throw 'Secret scan requires ripgrep (rg) to be installed.'
}

$patterns = @(
  '-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
  'AKIA[0-9A-Z]{16}',
  'ASIA[0-9A-Z]{16}',
  'gh[pousr]_[A-Za-z0-9]{36,255}',
  'github_pat_[A-Za-z0-9_]{50,255}',
  'sk-(proj-)?[A-Za-z0-9_-]{32,255}',
  'AIza[0-9A-Za-z_-]{35}',
  'xox[baprs]-[0-9A-Za-z-]{10,255}'
)

$arguments = @(
  '--hidden',
  '--no-messages',
  '--glob', '!.git/**',
  '--glob', '!**/node_modules/**',
  '--glob', '!**/build/**',
  '--glob', '!**/dist/**',
  '--glob', '!**/.dart_tool/**',
  '--glob', '!scripts/secret-scan.ps1'
)

$found = $false
foreach ($pattern in $patterns) {
  & rg @arguments --line-number --color never --regexp $pattern .
  if ($LASTEXITCODE -eq 0) {
    $found = $true
  } elseif ($LASTEXITCODE -gt 1) {
    throw "Secret scan failed while evaluating a pattern (rg exit $LASTEXITCODE)."
  }
}

if ($found) {
  throw 'Potential credential material was found. Remove it before committing.'
}

Write-Host 'Secret scan passed.'
