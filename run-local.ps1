$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$port = if ($args.Count -gt 0) { [int]$args[0] } else { 3000 }

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating local virtual environment..."
    $pythonCandidates = @(
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    )
    $basePython = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $basePython) {
        throw "Python was not found. Install Python 3.12, then run this script again."
    }
    & $basePython -m venv (Join-Path $root ".venv")
}

Set-Location $root

$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^\s*([^#\s][^=]*)=(.*)$") {
            $k = $Matches[1].Trim()
            $v = $Matches[2].Trim()
            Set-Item -Path "Env:$k" -Value $v
        }
    }
    Write-Host "Loaded .env"
}

Write-Host "Serving http://localhost:$port"
& $venvPython api_server.py $port
