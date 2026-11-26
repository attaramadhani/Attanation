$ErrorActionPreference = "Stop"

$pwaSrc = Join-Path $PSScriptRoot "..\..\pwa-docstudio-pro"
$assetsDst = Join-Path $PSScriptRoot "app\src\main\assets\www"

if (-not (Test-Path $pwaSrc)) {
    throw "Sumber PWA tidak ditemukan: $pwaSrc"
}

if (Test-Path $assetsDst) {
    Remove-Item -Path $assetsDst -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $assetsDst | Out-Null

# Salin seluruh berkas runtime PWA; kecualikan dokumen desain, skrip server PHP, dan git metadata
$excludeDirs = @("server-api", ".git", "node_modules")
$excludeFiles = @("DESIGN.md", "README.md")

Get-ChildItem -Path $pwaSrc -Force | ForEach-Object {
    if ($_.PSIsContainer) {
        if ($excludeDirs -notcontains $_.Name) {
            Copy-Item -Path $_.FullName -Destination (Join-Path $assetsDst $_.Name) -Recurse -Force
        }
    } else {
        if ($excludeFiles -notcontains $_.Name -and $_.Extension -ne ".md") {
            Copy-Item -Path $_.FullName -Destination (Join-Path $assetsDst $_.Name) -Force
        }
    }
}

Write-Host "Sinkronisasi selesai -> $assetsDst"
