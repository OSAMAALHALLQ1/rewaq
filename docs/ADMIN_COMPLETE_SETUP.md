# Complete Admin Setup Guide for Rewaq-SaaS

This guide explains how to apply the admin user configuration across the entire Rewaq-SaaS application and Supabase infrastructure.

## Admin Credentials

- **Email**: osama.alhallq.14@gmail.com
- **Password**: osamaalhallqst9

## What Was Done

### 1. Environment Configuration (✅ Complete)
- Added `ADMIN_EMAIL` to `.env.local`
- Added `ADMIN_PASSWORD` to `.env.local`

### 2. Database Setup Files Created

#### Database Seed Files
- `db/fixes/002_admin_user_seed.sql` - One-time setup script for admin profile
- `supabase/migrations/008_admin_user_setup.sql` - Migration for admin setup

#### Automation Scripts
- `scripts/setup-admin-user.ps1` - PowerShell setup script (Windows)
- `scripts/setup-admin-user.py` - Python setup script (Cross-platform)

#### Documentation
- `docs/ADMIN_SETUP.md` - Comprehensive admin setup guide

## Step-by-Step Implementation

### Phase 1: Create Auth User in Supabase

Choose one method:

#### Method 1: Dashboard (Recommended)
```
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to Authentication > Users
4. Click "Add user"
5. Email: osama.alhallq.14@gmail.com
6. Password: osamaalhallqst9
7. Click "Create user"
```

#### Method 2: Supabase CLI
```bash
supabase auth admin create-user \
  --email osama.alhallq.14@gmail.com \
  --password osamaalhallqst9
```

#### Method 3: cURL Admin API
```bash
curl -X POST 'https://your-project.supabase.co/auth/v1/admin/users' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "osama.alhallq.14@gmail.com",
    "password": "osamaalhallqst9",
    "email_confirm": true
  }'
```

### Phase 2: Apply Database Configuration

After creating the auth user, apply the database setup:

#### Method 1: PowerShell (Windows)
```powershell
# From project root
.\scripts\setup-admin-user.ps1
```

#### Method 2: Python (All Platforms)
```bash
# Requires: Python 3.6+, Supabase CLI
python scripts/setup-admin-user.py
```

#### Method 3: Manual SQL
```bash
# Set your database URL
$env:DATABASE_URL="postgresql://..."

# Apply the setup
npx supabase db query --db-url $env:DATABASE_URL --file db/fixes/002_admin_user_seed.sql
```

### Phase 3: Test Admin Access

1. Open the application
2. Go to `/login`
3. Enter credentials:
   - Email: osama.alhallq.14@gmail.com
   - Password: osamaalhallqst9
4. You should be redirected to `/admin` dashboard

## Database Changes Applied

### Tables Modified

#### `auth.users`
- User created by Supabase Auth
- Email confirmed
- Password set

#### `profiles`
- `id`: References the auth user
- `full_name`: "Osama Alhallq"
- `locale`: "ar" (Arabic)

#### `organizations`
- `id`: Generated UUID
- `name`: "Admin Organization"
- `slug`: "admin-org"
- `plan`: "scale"
- `status`: "active"

#### `organization_memberships`
- `organization_id`: Links to Admin Organization
- `user_id`: Admin user ID
- `role`: "super_admin"

## Admin Features Unlocked

Access to all admin features at `/admin`:

- **Dashboard** - System metrics and analytics
- **Users Management** - View all users and their status
- **Organizations** - Manage all organizations
- **Plans** - Configure subscription plans
- **Feature Flags** - Toggle features on/off
- **Support Tickets** - Handle customer support
- **System Logs** - View application logs
- **Account Requests** - Approve/reject account registrations

## File Structure

```
rewaq-saas/
├── .env.local                           # ✅ Admin credentials
├── db/
│   ├── seed.sql                         # Original seed data
│   ├── fixes/
│   │   └── 002_admin_user_seed.sql      # ✅ Admin setup (new)
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── ...
│       └── 008_admin_user_setup.sql     # ✅ Admin migration (new)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── ...
│       └── 008_admin_user_setup.sql     # ✅ Admin setup (new)
├── scripts/
│   ├── apply-supabase-sql.ps1
│   ├── setup-admin-user.ps1             # ✅ PowerShell setup (new)
│   └── setup-admin-user.py              # ✅ Python setup (new)
└── docs/
    ├── ...
    └── ADMIN_SETUP.md                   # ✅ Admin guide (new)
```

## Verification Checklist

- [ ] Admin credentials added to `.env.local`
- [ ] Auth user created in Supabase
- [ ] Setup script executed successfully
- [ ] Admin can login with credentials
- [ ] Admin dashboard accessible at `/admin`
- [ ] All admin features working
- [ ] User management features functional
- [ ] Organization management accessible

## Troubleshooting

### Can't Login
- Verify email is confirmed in Supabase Auth
- Check password matches `.env.local`
- Ensure auth user exists

### No Admin Dashboard Access
- Verify `super_admin` role in `organization_memberships`
- Check admin organization exists (slug: "admin-org")
- Run setup script again

### Database Connection Error
- Verify `DATABASE_URL` in `.env.local`
- Check SSL mode is enabled
- Confirm credentials are correct

## Security Considerations

1. **Environment Variables**
   - `.env.local` is in `.gitignore` (not committed)
   - Contains sensitive credentials
   - Never share or expose

2. **Password Management**
   - Change admin password after first login
   - Use strong password for production
   - Enable 2FA in Supabase

3. **Access Control**
   - Only super_admin should have this role
   - Audit user access regularly
   - Review system logs

## Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Admin Setup Details](./ADMIN_SETUP.md)
- [Database Schema](../db/migrations/001_initial_schema.sql)

## Support

For issues or questions:
1. Check the [ADMIN_SETUP.md](./ADMIN_SETUP.md) file
2. Review Supabase documentation
3. Check application logs at `/admin/system-logs`
