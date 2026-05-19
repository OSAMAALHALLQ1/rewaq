# rewaq

منصة SaaS عربية RTL لإدارة عمليات المطاعم والفروع: المخزون، الموردون، المشتريات، تكلفة الوصفات، التقارير، التسويق الاجتماعي، الصلاحيات، ولوحة أدمن.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS 3
- shadcn-style local UI primitives
- Supabase Auth, PostgreSQL, Storage, RLS
- React Hook Form ready via dependencies
- Zod validation
- Recharts
- Lucide React

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production build on this Windows setup uses Webpack because the local Next native Turbopack binding was unavailable:

```bash
npm run build
```

The app runs in Demo Mode when Supabase env vars are not configured. Demo Mode uses `src/lib/demo-data.ts` through `src/server/queries/app.ts`, so all pages are still navigable locally.

## Supabase setup

1. Use the configured Supabase project:

```bash
https://thusfzjbzzcevvgddoxs.supabase.co
```

2. Copy `.env.example` to `.env.local`.
3. Set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://thusfzjbzzcevvgddoxs.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Install and login to Supabase CLI, then link the project:

```bash
npm install -g supabase
supabase login
npm run db:link
```

5. Apply the migrations:

```bash
npm run db:push
```

If you do not use the CLI, paste these files into Supabase SQL editor in order:

```bash
db/migrations/001_initial_schema.sql
db/migrations/002_pos_inventory_backend.sql
```

On Windows, if the direct database host resolves to IPv6 only, use the Supabase
**Transaction Pooler** connection string in `DATABASE_URL`, then run:

```bash
npm run db:apply
```

6. Seed demo data:

```bash
npm run db:reset
```

Or run `db/seed.sql` in the SQL editor after the migration.

7. Generate fresh database types after the remote schema is applied:

```bash
npm run db:types
```

## Database

Main tables:

- Multi-tenant: `organizations`, `branches`, `profiles`, `organization_memberships`
- Inventory: `inventory_items`, `inventory_categories`, `units`, `unit_conversions`, `branch_stock`, `stock_movements`, `stock_counts`, `stock_count_items`
- Waste/transfers: `waste_logs`, `transfers`, `transfer_items`
- Purchasing: `suppliers`, `purchase_orders`, `purchase_order_items`, `invoices`, `invoice_items`, `supplier_price_history`
- Recipes/menu: `recipes`, `recipe_ingredients`, `menu_items`, `menu_item_recipe_mapping`
- POS/backend: `catalog_items`, `item_barcodes`, `customer_invoice_payments`
- Cost tracking: `daily_cost_entries`, `sales_daily_summaries`, `amwali_daily_summary`
- Marketing: `social_accounts`, `social_posts`, `social_post_targets`, `social_media_assets`, `social_publish_jobs`, `social_publish_logs`, `social_templates`
- Automation/notifications: `automation_rules`, `automation_runs`, `notifications`
- Admin: `plans`, `subscriptions`, `feature_flags`, `system_logs`, `support_tickets`

RLS is enabled across tenant data. Policies use `organization_id`, membership checks, and branch access checks. Branch managers are constrained through `can_access_branch(...)`; owners and cross-functional managers can access organization-level data.

## Social publishing engine

The platform supports one publishing flow for:

- Facebook
- Instagram
- Telegram
- TikTok
- X
- Google Business

Publishing is intentionally split into two layers:

- Trigger.dev: background jobs, queues, schedules, retries, monitoring, long-running publish tasks.
- ImageKit: public media storage for marketing images and videos.
- Node-RED: optional external triggers and automation sources such as Google Sheets, Drive, RSS, or custom webhooks.
- Platform APIs: Meta/TikTok/etc. permissions, OAuth, tokens, app review, and actual publishing.

When `TRIGGER_DEV_SOCIAL_PUBLISH_ENDPOINT` is configured, every selected target is queued as a background publish task. If Trigger.dev is not configured, Rewaq can send to `NODE_RED_SOCIAL_PUBLISH_WEBHOOK_URL`. When neither is configured, the app uses a local demo publisher so the UX remains fully navigable.

Publishing modules live under:

- `src/lib/social/facebook.ts`
- `src/lib/social/instagram.ts`
- `src/lib/social/telegram.ts`
- `src/lib/social/node-red.ts`
- `src/lib/social/trigger-dev.ts`
- `src/lib/social/publisher.ts`
- `src/lib/imagekit.ts`

All providers share:

```ts
SocialPublisher.publish(input)
```

Partial failures are supported: one failed target does not fail the entire post.

Production OAuth, job, scheduler, retry, and audit setup is documented in:

- `docs/social-publishing-runbook.md`

### Facebook Pages API

For direct Facebook Page publishing without Trigger.dev/Node-RED, configure:

```bash
FACEBOOK_GRAPH_VERSION=v21.0
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=
```

The Page access token must be generated through Meta OAuth and include the Page permissions needed for publishing, especially `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`. App ID/App Secret alone are not enough to publish to a Page.

Internal API endpoint for workflow/server calls:

```bash
POST /api/node-red/social-publish
Authorization: Bearer $NODE_RED_REWAQ_API_KEY
```

Example request body:

```json
{
  "organizationId": "org_123",
  "postId": "post_123",
  "body": "عرض اليوم متاح الآن",
  "targets": [
    { "platform": "facebook", "accountId": "page_1", "accountName": "Restaurant Page" },
    { "platform": "instagram", "accountId": "ig_1", "accountName": "restaurant" }
  ]
}
```

## Real integration TODO

- Create Trigger.dev task(s) for scheduled publishing, retries, and per-platform failure handling
- Build OAuth flows for Meta, TikTok, LinkedIn, YouTube, Pinterest, and Google Business
- Store provider tokens encrypted in Supabase or a managed secrets vault
- Keep `IMAGEKIT_PRIVATE_KEY` only in server environment variables, never in client code
- POS imports for theoretical usage
- OCR invoices
- Advanced billing and subscription webhooks
- Encrypt social tokens with Supabase Vault or KMS before production
- Background worker for `social_publish_jobs`
- Supabase Realtime subscriptions for notification bell and publish logs

## Demo data

Seed data includes:

- Organization: `مطعم إيوان`
- Branches: `فرع شارع عبد القادر الحسيني`, `فرع الرمال`
- Suppliers: `مورد الدجاج`, `مورد الخضار`, `مورد التغليف`
- Inventory: دجاج، أرز، زيت، بطاطا، خبز برجر، صوص حار، جبنة، علب تغليف
- Recipes and menu items with Food Cost calculations
- Social templates and mock publishing logs

## Notes

- Do not mutate stock quantities directly in production flows. Post `stock_movements` and update `branch_stock` in the same transaction.
- Real POS issuing is handled by `issue_customer_invoice(...)`, which saves the invoice, deducts recipe ingredients, writes `stock_movements`, and updates daily sales summaries in one database transaction.
- Barcode lookup is handled by `find_catalog_item_by_barcode(...)` against `item_barcodes`.
- Do not store social tokens as plain text in production.
- Server code uses `@supabase/ssr` and `src/proxy.ts` to refresh sessions.
