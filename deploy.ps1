$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$gitCandidates = @(
    "git",
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe"
)

$git = $null
foreach ($candidate in $gitCandidates) {
    try {
        & $candidate --version *> $null
        if ($LASTEXITCODE -eq 0) {
            $git = $candidate
            break
        }
    } catch {
    }
}

if (-not $git) {
    throw "Git was not found. Install Git for Windows, then run this script again."
}

$message = if ($args.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace($args[0])) {
    $args[0]
} else {
    "Update site $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Write-Host "Checking local changes..."
$status = & $git status --porcelain

if ([string]::IsNullOrWhiteSpace(($status -join ""))) {
    Write-Host "No local changes to commit."
} else {
    Write-Host "Staging changes..."
    & $git add -A

    Write-Host "Creating commit: $message"
    & $git commit -m $message
}

Write-Host "Pushing to GitHub..."
& $git push origin main

Write-Host ""
Write-Host "Done. GitHub Pages should update shortly:"
Write-Host "https://lscape82.github.io/k-goplay-ui/"
