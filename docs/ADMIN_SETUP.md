# Admin User Setup Guide

## Overview
This document explains how to set up the admin user in the Rewaq-SaaS application.

**Admin Credentials:**
- Email: `osama.alhallq.14@gmail.com`
- Password: `osamaalhallqst9` (stored in `.env.local`)

## Setup Steps

### 1. Environment Configuration
The admin credentials are already added to `.env.local`:
```
ADMIN_EMAIL=osama.alhallq.14@gmail.com
ADMIN_PASSWORD=osamaalhallqst9
```

### 2. Create Auth User in Supabase

You have two options:

#### Option A: Using Supabase Dashboard (Recommended for first time)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** > **Users**
4. Click **"Add user"** button
5. Enter:
   - Email: `osama.alhallq.14@gmail.com`
   - Password: `osamaalhallqst9`
6. Uncheck "Auto send invite email" (unless you want to send one)
7. Click **"Create user"**

#### Option B: Using Supabase CLI
```bash
supabase auth admin create-user \
  --email osama.alhallq.14@gmail.com \
  --password osamaalhallqst9
```

#### Option C: Using Admin API
```bash
curl -X POST 'https://yourdomain.supabase.co/auth/v1/admin/users' \
  -H 'apikey: your-service-role-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "osama.alhallq.14@gmail.com",
    "password": "osamaalhallqst9",
    "email_confirm": true
  }'
```

### 3. Configure Admin Profile in Database

After creating the auth user, run the setup script to configure the admin profile:

```powershell
# From the project root directory
.\scripts\setup-admin-user.ps1
```

Or manually apply the SQL:

```powershell
# Set database URL
$env:DATABASE_URL="your-connection-string"

# Apply the admin setup
npx supabase db query --db-url $env:DATABASE_URL --file db/fixes/002_admin_user_seed.sql
```

### 4. Verify Admin Setup

Log in to the application:
1. Go to the login page
2. Enter:
   - Email: `osama.alhallq.14@gmail.com`
   - Password: `osamaalhallqst9`
3. You should have access to the admin dashboard at `/admin`

## Database Changes

The setup creates:

1. **Profile** in `profiles` table:
   - `full_name`: "Osama Alhallq"
   - `locale`: "ar"

2. **Organization** in `organizations` table:
   - `name`: "Admin Organization"
   - `slug`: "admin-org"
   - `plan`: "scale"
   - `status`: "active"

3. **Organization Membership** in `organization_memberships` table:
   - `role`: "super_admin"
   - Grants full access to all admin features

## SQL Files

### db/fixes/002_admin_user_seed.sql
One-time setup script that creates the admin profile and assigns roles.
Safe to run multiple times (uses `on conflict`).

### supabase/migrations/008_admin_user_setup.sql
Migration version of the admin setup.
Applied automatically during migrations if the auth user exists.

## Admin Features

Once setup is complete, the admin user has access to:

- **Dashboard** (`/admin`) - System overview and metrics
- **Users** (`/admin/users`) - User management and approval requests
- **Organizations** (`/admin/organizations`) - Organization management
- **Plans** (`/admin/plans`) - Subscription plans management
- **Feature Flags** (`/admin/feature-flags`) - Feature toggles
- **Support Tickets** (`/admin/support-tickets`) - Customer support
- **System Logs** (`/admin/system-logs`) - Application logs
- **Account Requests** (`/admin/account-requests`) - Account approval workflow

## Security Notes

1. **Change Password**: After first login, consider changing the admin password
2. **Two-Factor Authentication**: Enable 2FA for the admin account in Supabase
3. **API Key Security**: Keep your Supabase API keys and service role keys secure
4. **Environment Variables**: Never commit `.env.local` to version control

## Troubleshooting

### Admin can't login
- Verify email is confirmed in Supabase Auth
- Check password is correct in `.env.local`
- Ensure the auth user exists

### Admin can't access admin pages
- Check that `super_admin` role is assigned in `organization_memberships`
- Verify `role` column is set to `super_admin` in the database

### Admin organization not found
- Run the setup script again: `.\scripts\setup-admin-user.ps1`
- Verify the `organizations` table has "admin-org" entry

## Resetting Admin Access

If you need to reset the admin account:

1. Delete the auth user from Supabase Dashboard
2. Delete admin organization records:
   ```sql
   delete from organization_memberships 
   where user_id = (select id from auth.users where email = 'osama.alhallq.14@gmail.com');
   
   delete from profiles 
   where id = (select id from auth.users where email = 'osama.alhallq.14@gmail.com');
   ```
3. Follow the setup steps above again

## Related Files

- `.env.local` - Admin credentials storage
- `src/app/admin/` - Admin dashboard pages
- `src/lib/auth/require-auth.ts` - Authentication logic
- `db/migrations/001_initial_schema.sql` - Database schema
