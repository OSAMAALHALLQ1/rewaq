#!/bin/bash
# Admin Setup Verification Script
# Run this script to verify all admin setup files are in place

set -e

echo "=========================================="
echo "Rewaq-SaaS Admin Setup Verification"
echo "=========================================="
echo ""

SUCCESS=0
FAILED=0

# Function to check file
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo "✅ $description"
        echo "   File: $file"
        ((SUCCESS++))
    else
        echo "❌ $description"
        echo "   File not found: $file"
        ((FAILED++))
    fi
}

# Function to check environment variable
check_env() {
    local var=$1
    local description=$2
    
    if grep -q "^$var=" .env.local 2>/dev/null; then
        local value=$(grep "^$var=" .env.local | cut -d'=' -f2)
        echo "✅ $description"
        echo "   Value: $value"
        ((SUCCESS++))
    else
        echo "❌ $description"
        echo "   Variable not in .env.local: $var"
        ((FAILED++))
    fi
}

echo "Checking Configuration Files..."
echo ""
check_env "ADMIN_EMAIL" "Admin email configured"
check_env "ADMIN_PASSWORD" "Admin password configured"
echo ""

echo "Checking Database Files..."
echo ""
check_file "db/fixes/002_admin_user_seed.sql" "Admin seed SQL file"
check_file "supabase/migrations/008_admin_user_setup.sql" "Admin migration file"
echo ""

echo "Checking Scripts..."
echo ""
check_file "scripts/setup-admin-user.ps1" "PowerShell setup script"
check_file "scripts/setup-admin-user.py" "Python setup script"
echo ""

echo "Checking Documentation..."
echo ""
check_file "docs/ADMIN_SETUP.md" "Admin setup guide"
check_file "docs/ADMIN_COMPLETE_SETUP.md" "Complete setup guide"
check_file "docs/ADMIN_SETUP_UPDATE.md" "Setup update summary"
check_file "docs/INDEX.md" "Setup index/summary"
check_file "scripts/README.md" "Scripts documentation"
echo ""

echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo "✅ Passed: $SUCCESS"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All files present and configured!"
    echo ""
    echo "Next steps:"
    echo "1. Create auth user in Supabase (osama.alhallq.14@gmail.com)"
    echo "2. Run: ./scripts/setup-admin-user.ps1 (Windows)"
    echo "3. Or: python scripts/setup-admin-user.py (All platforms)"
    echo "4. Login and test admin dashboard"
    exit 0
else
    echo "⚠️  Some files are missing!"
    echo "Please check the files listed above."
    exit 1
fi
