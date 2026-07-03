alter type social_post_status add value if not exists 'ready';
alter type social_post_status add value if not exists 'prepared';

alter type social_target_status add value if not exists 'ready';
alter type social_target_status add value if not exists 'prepared';

alter table social_posts
  add column if not exists image_local_path text,
  add column if not exists local_agent_payload jsonb not null default '{}'::jsonb;

create index if not exists social_posts_local_publisher_queue_idx
  on social_posts (organization_id, status, scheduled_at, created_at desc);

comment on column social_posts.image_local_path is 'Optional local filesystem path used by the Rewaq Publisher desktop agent after downloading media.';
comment on column social_posts.local_agent_payload is 'Semi-automation metadata for the local publisher agent. No Meta Graph API token is required.';
