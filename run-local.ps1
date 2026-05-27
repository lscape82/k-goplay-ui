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
Write-Host "Serving http://localhost:$port from .venv"
& $venvPython -m http.server $port
