param(
  [string]$Target = ".",
  [switch]$InstallPlaywright
)

$ErrorActionPreference = "Stop"
$Source = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetPath = (Resolve-Path $Target).Path

Write-Host "Rewaq AI Agent Kit"
Write-Host "Source: $Source"
Write-Host "Target: $TargetPath"

$items = @(
  "AGENTS.md",
  "CLAUDE.md",
  ".agents",
  ".claude\agents",
  "docs",
  "scripts"
)

foreach ($item in $items) {
  $src = Join-Path $Source $item
  if (-not (Test-Path $src)) { continue }
  $dst = Join-Path $TargetPath $item

  if (Test-Path $dst) {
    Write-Warning "Exists, not overwritten automatically: $dst"
    continue
  }

  Copy-Item $src $dst -Recurse
  Write-Host "Copied: $item"
}

if ($InstallPlaywright) {
  $pkg = Join-Path $TargetPath "package.json"
  if (-not (Test-Path $pkg)) {
    throw "package.json not found. Playwright was not installed."
  }
  Push-Location $TargetPath
  try {
    Write-Host "Installing Playwright as a dev dependency with npm. Review package manager first if this repo uses pnpm/yarn/bun."
    npm install -D @playwright/test
    npx playwright install chromium
  } finally {
    Pop-Location
  }
}

Write-Host "Done. Existing files were intentionally not overwritten. Merge them manually with Codex."
