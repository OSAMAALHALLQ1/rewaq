#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Apply admin user setup to Supabase database
.DESCRIPTION
  This script creates the admin user profile and assigns super_admin role
  Prerequisites: Admin user must be created in Supabase Auth first
#>

param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$AdminEmail = "osama.alhallq.14@gmail.com"
)

$ErrorActionPreference = "Stop"

if (-not $DatabaseUrl) {
  $envFile = Join-Path $PSScriptRoot "..\.env.local"
  if (Test-Path $envFile) {
    $DatabaseUrl = ((Get-Content -LiteralPath $envFile | Where-Object { $_ -like "DATABASE_URL=*" }) -replace "^DATABASE_URL=", "")
  }
}

if (-not $DatabaseUrl) {
  Write-Host "ERROR: DATABASE_URL is missing" -ForegroundColor Red
  throw "Add the Supabase connection string to .env.local"
}

if ($DatabaseUrl -match "\[YOUR-PASSWORD\]") {
  Write-Host "ERROR: DATABASE_URL contains placeholder" -ForegroundColor Red
  throw "Replace [YOUR-PASSWORD] with the real database password"
}

# Add SSL mode if not present
if ($DatabaseUrl -notmatch "sslmode=") {
  if ($DatabaseUrl.Contains("?")) {
    $DatabaseUrl = "${DatabaseUrl}&sslmode=require"
  } else {
    $DatabaseUrl = "${DatabaseUrl}?sslmode=require"
  }
}

# Apply admin setup
Write-Host "Setting up admin user for: $AdminEmail" -ForegroundColor Cyan

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$setupFile = Join-Path $root "db\fixes\002_admin_user_seed.sql"

if (-not (Test-Path $setupFile)) {
  Write-Host "ERROR: Setup file not found" -ForegroundColor Red
  throw "Missing SQL file: $setupFile"
}

Write-Host "Applying admin user setup..." -ForegroundColor Cyan
npx supabase db query --db-url $DatabaseUrl --file $setupFile

if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Failed to apply admin setup" -ForegroundColor Red
  throw "Failed to apply: $setupFile"
}

Write-Host "Admin user setup applied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Make sure the admin user is created in Supabase Auth:" -ForegroundColor Yellow
Write-Host "1. Go to Supabase Dashboard > Authentication > Users"
Write-Host "2. Click 'Add user' button"
Write-Host "3. Email: $AdminEmail"
Write-Host "4. Password: Check .env.local for ADMIN_PASSWORD"
Write-Host "5. Uncheck 'Auto send invite email' if needed"
Write-Host ""
Write-Host "Then run this script again to complete the setup."
