# Scripts Directory

This directory contains utility scripts for managing the Rewaq-SaaS application.

## Admin Setup Scripts

### setup-admin-user.ps1 (PowerShell)
**Platform**: Windows  
**Prerequisites**: PowerShell, Supabase CLI, Node.js

Setup the admin user in Supabase database after creating the auth account.

```powershell
# Basic usage
.\setup-admin-user.ps1

# With custom database URL
.\setup-admin-user.ps1 -DatabaseUrl "postgresql://..."

# With custom admin email
.\setup-admin-user.ps1 -AdminEmail "custom@example.com"
```

**What it does**:
1. Loads DATABASE_URL from environment or .env.local
2. Validates database connection
3. Applies admin user setup SQL
4. Verifies admin user in database
5. Shows next steps

### setup-admin-user.py (Python)
**Platform**: Windows, macOS, Linux  
**Prerequisites**: Python 3.6+, Supabase CLI, Node.js

Cross-platform admin setup script with better error handling.

```bash
# Basic usage
python scripts/setup-admin-user.py

# Or with shebang (macOS/Linux)
./scripts/setup-admin-user.py
```

**What it does**:
1. Loads .env.local configuration
2. Validates admin credentials
3. Gets database URL
4. Applies SQL setup file
5. Verifies admin in database
6. Shows completion status

## Database Scripts

### apply-supabase-sql.ps1
**Platform**: Windows  
**Purpose**: Apply all migrations and seed data to Supabase

```powershell
# Apply all migrations and seed data
.\scripts\apply-supabase-sql.ps1

# Skip seed data
.\scripts\apply-supabase-sql.ps1 -SkipSeed

# Custom database URL
.\scripts\apply-supabase-sql.ps1 -DatabaseUrl "postgresql://..."
```

## Usage Guide

### Step 1: Environment Setup
Make sure `.env.local` is configured:
```
DATABASE_URL=postgresql://...
ADMIN_EMAIL=osama.alhallq.14@gmail.com
ADMIN_PASSWORD=osamaalhallqst9
```

### Step 2: Create Auth User
Use Supabase Dashboard, CLI, or API to create the auth user with email and password.

### Step 3: Run Setup Script
```bash
# PowerShell (Windows)
.\scripts\setup-admin-user.ps1

# Python (All platforms)
python scripts/setup-admin-user.py
```

### Step 4: Verify
1. Login with admin credentials
2. Check `/admin` dashboard is accessible
3. Verify all features are working

## Troubleshooting

### "DATABASE_URL is missing"
Add it to `.env.local`:
```
DATABASE_URL=postgresql://username:password@host:5432/database
```

### "psql not found"
Install PostgreSQL client:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql

# Windows
choco install postgresql
```

### "npx supabase db query failed"
Make sure Supabase CLI is installed:
```bash
npm install -g supabase
```

## SQL Files

Located in `db/` directory:

- `db/seed.sql` - Base demo data
- `db/fixes/001_seed_rerun_safe.sql` - Safe re-run of seed
- `db/fixes/002_admin_user_seed.sql` - Admin user setup
- `db/migrations/001_initial_schema.sql` - Base schema
- `db/migrations/002_pos_inventory_backend.sql` - Inventory
- ... (other migrations)
- `supabase/migrations/008_admin_user_setup.sql` - Admin migration

## Development

### Adding New Scripts

1. Create script file in this directory
2. Add descriptive header/docstring
3. Document usage in this README
4. Add to appropriate subsection

### Script Best Practices

- Use error handling
- Provide clear output messages
- Support both relative and absolute paths
- Load configuration from .env.local
- Validate inputs
- Log results
