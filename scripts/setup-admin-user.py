#!/usr/bin/env python3
"""
Admin User Setup Automation Script
Handles complete admin user setup for Rewaq-SaaS

Prerequisites:
1. Supabase CLI installed
2. .env.local with DATABASE_URL configured
3. Admin auth user created in Supabase
"""

import os
import subprocess
import sys
import json
from pathlib import Path
from typing import Optional

# Configuration
ADMIN_EMAIL = "osama.alhallq.14@gmail.com"
ADMIN_PASSWORD = "osamaalhallqst9"
ROOT_DIR = Path(__file__).parent.parent
ENV_FILE = ROOT_DIR / ".env.local"
SETUP_SQL_FILE = ROOT_DIR / "db/fixes/002_admin_user_seed.sql"


def load_env_file() -> dict:
    """Load environment variables from .env.local"""
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars


def get_database_url() -> Optional[str]:
    """Get database URL from environment or .env.local"""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        env_vars = load_env_file()
        db_url = env_vars.get('DATABASE_URL')
    
    if not db_url:
        print("❌ ERROR: DATABASE_URL not found in environment or .env.local")
        return None
    
    # Add SSL mode if not present
    if 'sslmode=' not in db_url:
        separator = '&' if '?' in db_url else '?'
        db_url = f"{db_url}{separator}sslmode=require"
    
    return db_url


def verify_admin_credentials() -> bool:
    """Verify admin credentials in .env.local"""
    env_vars = load_env_file()
    
    admin_email = env_vars.get('ADMIN_EMAIL')
    admin_password = env_vars.get('ADMIN_PASSWORD')
    
    if admin_email != ADMIN_EMAIL or admin_password != ADMIN_PASSWORD:
        print("❌ ERROR: Admin credentials don't match expected values")
        print(f"   Expected: {ADMIN_EMAIL}")
        print(f"   Got: {admin_email}")
        return False
    
    return True


def apply_sql_file(db_url: str, sql_file: Path) -> bool:
    """Apply SQL file to database using Supabase CLI"""
    if not sql_file.exists():
        print(f"❌ ERROR: SQL file not found: {sql_file}")
        return False
    
    try:
        print(f"📝 Applying SQL file: {sql_file.name}")
        result = subprocess.run(
            ['npx', 'supabase', 'db', 'query', '--db-url', db_url, '--file', str(sql_file)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✅ SQL file applied successfully")
            return True
        else:
            print(f"❌ ERROR applying SQL file:")
            print(result.stderr)
            return False
    except subprocess.TimeoutExpired:
        print("❌ ERROR: Command timed out")
        return False
    except FileNotFoundError:
        print("❌ ERROR: npx or supabase CLI not found")
        print("   Install with: npm install -g supabase")
        return False


def verify_admin_in_database(db_url: str) -> bool:
    """Verify admin user exists in database"""
    verify_sql = f"""
    select 
      u.id,
      u.email,
      p.full_name,
      om.role
    from auth.users u
    left join profiles p on u.id = p.id
    left join organization_memberships om on u.id = om.user_id
    where u.email = '{ADMIN_EMAIL}'
    limit 1;
    """
    
    try:
        result = subprocess.run(
            ['psql', db_url, '-c', verify_sql],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0 and 'super_admin' in result.stdout:
            print("✅ Admin user verified in database")
            return True
        else:
            print(f"⚠️  Could not verify admin in database: {result.stderr}")
            return False
    except FileNotFoundError:
        print("⚠️  psql not available for verification")
        return True  # Not critical


def main():
    """Main setup function"""
    print("=" * 60)
    print("Rewaq-SaaS Admin User Setup")
    print("=" * 60)
    print()
    
    # Step 1: Verify admin credentials
    print("📋 Step 1: Verifying admin credentials...")
    if not verify_admin_credentials():
        return False
    print("✅ Admin credentials verified in .env.local")
    print()
    
    # Step 2: Get database URL
    print("📋 Step 2: Getting database URL...")
    db_url = get_database_url()
    if not db_url:
        return False
    print("✅ Database URL configured")
    print()
    
    # Step 3: Apply admin setup SQL
    print("📋 Step 3: Applying admin setup to database...")
    if not apply_sql_file(db_url, SETUP_SQL_FILE):
        print("⚠️  Failed to apply SQL file")
        print("   Make sure admin user exists in Supabase Auth first")
        return False
    print()
    
    # Step 4: Verify admin in database
    print("📋 Step 4: Verifying admin in database...")
    verify_admin_in_database(db_url)
    print()
    
    # Summary
    print("=" * 60)
    print("✅ Admin Setup Complete!")
    print("=" * 60)
    print()
    print("Admin Login Credentials:")
    print(f"  Email:    {ADMIN_EMAIL}")
    print(f"  Password: {ADMIN_PASSWORD}")
    print()
    print("Important Steps:")
    print("1. If admin user doesn't exist in Supabase Auth yet:")
    print("   - Go to Supabase Dashboard > Authentication > Users")
    print("   - Click 'Add user' and enter the credentials above")
    print()
    print("2. After creating the auth user, run this script again")
    print()
    print("3. Login to the app and go to /admin dashboard")
    print()
    
    return True


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
