# Social Publishing Runbook

This is the production path for Rewaq social publishing.

## Runtime Flow

```text
User
↓
Rewaq publishing page
↓
ImageKit upload for image/video
↓
Supabase social_posts + social_media_assets + social_publish_jobs
↓
Edge Function / Trigger.dev task
↓
Meta API / TikTok API / other platform APIs
↓
social_publish_logs + target status + retry
```

## What Rewaq Handles

1. OAuth connection records through `social_oauth_states`.
2. Connected accounts through `social_accounts`.
3. Encrypted access/refresh token fields.
4. Post records through `social_posts`.
5. Per-platform targets through `social_post_targets`.
6. Image/video metadata through `social_media_assets`.
7. Queue records through `social_publish_jobs`.
8. Audit trail through `social_publish_logs`.
9. Retry metadata: attempts, max attempts, next retry, locked job, external run id.

## What You Must Do

### 1. Supabase

Run these SQL files in order:

```text
db/migrations/001_initial_schema.sql
db/migrations/002_pos_inventory_backend.sql
db/migrations/003_social_platform_expansion.sql
db/migrations/004_social_publishing_engine.sql
db/seed.sql
```

Add these environment variables to your deployment:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

### 2. ImageKit

Add:

```bash
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
```

Keep `IMAGEKIT_PRIVATE_KEY` server-only.

### 3. Meta App Review

Create a Meta Developer app and configure OAuth redirect URLs.

Required permissions for Facebook Pages publishing:

```text
pages_show_list
pages_read_engagement
pages_manage_posts
```

Required permissions for Instagram publishing:

```text
instagram_basic
instagram_content_publish
pages_show_list
pages_read_engagement
```

You must submit App Review before real users can connect and publish with advanced permissions.

### 4. TikTok Audit

Create a TikTok Developer app and add Content Posting API.

Required permission:

```text
video.publish
```

TikTok may keep posts private/restricted until the app passes audit.

### 5. Background Execution

Use one of these:

```text
Trigger.dev = recommended for queues, retries, schedules, logs, long tasks
Supabase Edge Function = good for webhook/worker execution
Node-RED = good for open-source external triggers
```

Recommended environment variables:

```bash
TRIGGER_DEV_SOCIAL_PUBLISH_ENDPOINT=
TRIGGER_DEV_API_KEY=
NODE_RED_SOCIAL_PUBLISH_WEBHOOK_URL=
NODE_RED_SOCIAL_PUBLISH_API_KEY=
NODE_RED_REWAQ_API_KEY=
```

### 6. Production Safety

Before launch:

1. Rotate any secrets that were pasted into chat or logs.
2. Encrypt provider tokens before saving them.
3. Add Privacy Policy and Data Deletion URL for Meta.
4. Add Terms of Service if required by the platform.
5. Add OAuth redirect URLs for local, preview, and production.
6. Test each platform with one real connected account.
7. Submit Meta App Review and TikTok Audit.
8. Keep logs append-only for publishing evidence.

## Minimal Worker Behavior

Worker must:

1. Pick jobs where `status = 'queued'` and `run_after <= now()`.
2. Lock the job with `locked_at` and `locked_by`.
3. Load post, target, account, media, and encrypted token.
4. Decrypt token server-side.
5. Publish to the correct platform API.
6. Update `social_post_targets`.
7. Insert `social_publish_logs`.
8. If failed and retryable, set `next_retry_at` and increment `attempts`.
9. If permanently failed, set job and target to failed.
10. Do not retry platforms that already succeeded.
