#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Verify admin setup files are in place
.DESCRIPTION
    This script checks that all required admin setup files and configurations are present
.EXAMPLE
    .\verify-admin-setup.ps1
#>

$ErrorActionPreference = "Stop"
$Success = 0
$Failed = 0

function Test-File {
    param(
        [string]$Path,
        [string]$Description
    )
    
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        Write-Host "✅ $Description" -ForegroundColor Green
        Write-Host "   File: $Path" -ForegroundColor Gray
        $global:Success++
    } else {
        Write-Host "❌ $Description" -ForegroundColor Red
        Write-Host "   File not found: $Path" -ForegroundColor Gray
        $global:Failed++
    }
}

function Test-EnvVar {
    param(
        [string]$Variable,
        [string]$Description
    )
    
    $envFile = ".env.local"
    if (Test-Path -LiteralPath $envFile) {
        $content = Get-Content -LiteralPath $envFile -Raw
        if ($content -match "^$Variable=(.+)$" -Multiline) {
            $value = $matches[1]
            Write-Host "✅ $Description" -ForegroundColor Green
            Write-Host "   Value: $value" -ForegroundColor Gray
            $global:Success++
        } else {
            Write-Host "❌ $Description" -ForegroundColor Red
            Write-Host "   Variable not in $envFile : $Variable" -ForegroundColor Gray
            $global:Failed++
        }
    } else {
        Write-Host "❌ $Description" -ForegroundColor Red
        Write-Host "   File not found: $envFile" -ForegroundColor Gray
        $global:Failed++
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Rewaq-SaaS Admin Setup Verification" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking Configuration Files..." -ForegroundColor Yellow
Write-Host ""
Test-EnvVar "ADMIN_EMAIL" "Admin email configured"
Test-EnvVar "ADMIN_PASSWORD" "Admin password configured"
Write-Host ""

Write-Host "Checking Database Files..." -ForegroundColor Yellow
Write-Host ""
Test-File "db/fixes/002_admin_user_seed.sql" "Admin seed SQL file"
Test-File "supabase/migrations/008_admin_user_setup.sql" "Admin migration file"
Write-Host ""

Write-Host "Checking Scripts..." -ForegroundColor Yellow
Write-Host ""
Test-File "scripts/setup-admin-user.ps1" "PowerShell setup script"
Test-File "scripts/setup-admin-user.py" "Python setup script"
Write-Host ""

Write-Host "Checking Documentation..." -ForegroundColor Yellow
Write-Host ""
Test-File "docs/ADMIN_SETUP.md" "Admin setup guide"
Test-File "docs/ADMIN_COMPLETE_SETUP.md" "Complete setup guide"
Test-File "docs/ADMIN_SETUP_UPDATE.md" "Setup update summary"
Test-File "docs/INDEX.md" "Setup index/summary"
Test-File "scripts/README.md" "Scripts documentation"
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Verification Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Passed: $Success" -ForegroundColor Green
Write-Host "❌ Failed: $Failed" -ForegroundColor Red
Write-Host ""

if ($Failed -eq 0) {
    Write-Host "🎉 All files present and configured!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Create auth user in Supabase (osama.alhallq.14@gmail.com)" -ForegroundColor Gray
    Write-Host "2. Run: .\scripts\setup-admin-user.ps1" -ForegroundColor Gray
    Write-Host "3. Login and test admin dashboard" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "⚠️  Some files are missing!" -ForegroundColor Yellow
    Write-Host "Please check the files listed above." -ForegroundColor Gray
    exit 1
}
