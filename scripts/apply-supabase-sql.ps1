param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  $envFile = Join-Path $PSScriptRoot "..\.env.local"
  if (Test-Path $envFile) {
    $DatabaseUrl = ((Get-Content -LiteralPath $envFile | Where-Object { $_ -like "DATABASE_URL=*" }) -replace "^DATABASE_URL=", "")
  }
}

if (-not $DatabaseUrl) {
  throw "DATABASE_URL is missing. Add the Supabase pooler connection string to .env.local."
}

if ($DatabaseUrl -match "\[YOUR-PASSWORD\]") {
  throw "DATABASE_URL still contains [YOUR-PASSWORD]. Replace it with the real database password."
}

if ($DatabaseUrl -notmatch "sslmode=") {
  if ($DatabaseUrl.Contains("?")) {
    $DatabaseUrl = "${DatabaseUrl}&sslmode=require"
  } else {
    $DatabaseUrl = "${DatabaseUrl}?sslmode=require"
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$files = @(
  "db\migrations\001_initial_schema.sql",
  "db\migrations\002_pos_inventory_backend.sql",
  "db\migrations\003_social_platform_expansion.sql",
  "db\migrations\004_social_publishing_engine.sql",
  "db\migrations\005_business_profiles_and_cashier_role.sql",
  "db\migrations\006_email_approval_and_team_invites.sql"
)

if (-not $SkipSeed) {
  $files += "db\seed.sql"
}

foreach ($file in $files) {
  $fullPath = Join-Path $root $file
  if (-not (Test-Path $fullPath)) {
    throw "Missing SQL file: $file"
  }

  Write-Host "Running: $file" -ForegroundColor Cyan
  npx supabase db query --db-url $DatabaseUrl --file $fullPath --output json
  if ($LASTEXITCODE -ne 0) { throw "Failed to apply: $file" }
}

Write-Host "Database SQL files were applied successfully." -ForegroundColor Green
