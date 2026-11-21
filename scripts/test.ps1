param([ValidateSet('server','web','app','all')][string]$Target = 'all')
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

if ($Target -eq 'all') {
  Invoke-Checked 'Secret scan' { & "$PSScriptRoot/secret-scan.ps1" }
}
if ($Target -in @('server','all')) {
  Push-Location server
  try {
    Invoke-Checked 'Server lint' { npm.cmd run lint }
    Invoke-Checked 'Server build' { npm.cmd run build }
    Invoke-Checked 'Server tests' { npm.cmd test }
  } finally { Pop-Location }
}
if ($Target -in @('web','all')) {
  Push-Location web
  try {
    Invoke-Checked 'Web lint' { npm.cmd run lint }
    Invoke-Checked 'Web build' { npm.cmd run build }
    Invoke-Checked 'Web tests' { npm.cmd test }
  } finally { Pop-Location }
}
if ($Target -in @('app','all')) {
  Push-Location app
  try {
    Invoke-Checked 'Flutter analysis' { flutter analyze }
    Invoke-Checked 'Flutter tests' { flutter test }
  } finally { Pop-Location }
}
