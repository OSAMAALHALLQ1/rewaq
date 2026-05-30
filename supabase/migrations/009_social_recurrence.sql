alter table social_posts
  add column if not exists recurrence_interval text not null default 'none'
  check (recurrence_interval in ('none', 'daily', 'weekly'));

create index if not exists social_posts_scheduler_idx
  on social_posts (status, scheduled_at, recurrence_interval);

comment on column social_posts.recurrence_interval is 'Restaurant-first automation cadence: none, daily, or weekly. Recurrent publishes clone a new future post to preserve history.';
