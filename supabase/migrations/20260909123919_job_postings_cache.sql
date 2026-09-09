create table if not exists public.job_postings (
  id text primary key,
  source text not null check (source in ('greenhouse', 'lever', 'ashby', 'adzuna')),
  source_label text not null,
  source_feed text not null,
  external_id text not null,
  company text not null,
  role text not null,
  location text not null default '',
  employment_type text not null default '',
  description text not null default '',
  source_url text not null check (source_url ~ '^https://'),
  apply_url text not null check (apply_url ~ '^https://'),
  published_at timestamptz,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  tags text[] not null default '{}',
  is_active boolean not null default true,
  refresh_batch text not null,
  constraint job_postings_source_external_unique unique (source, source_feed, external_id)
);

alter table public.job_postings enable row level security;
alter table public.job_postings force row level security;

revoke all on table public.job_postings from public, anon, authenticated;
grant select, insert, update, delete on table public.job_postings to service_role;

create index if not exists job_postings_active_published_idx
  on public.job_postings (published_at desc)
  where is_active;

create index if not exists job_postings_active_expiry_idx
  on public.job_postings (expires_at)
  where is_active;
