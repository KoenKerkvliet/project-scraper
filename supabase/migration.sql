-- =============================================
-- Site Monitor - Database Setup
-- =============================================
-- Voer dit uit in de Supabase SQL Editor

-- 1. Sites tabel
create table public.sites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  name text not null,
  url text not null,
  selector text not null,
  is_active boolean not null default true,
  last_status text not null default 'pending' check (last_status in ('ok', 'error', 'pending')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Check results tabel
create table public.check_results (
  id uuid default gen_random_uuid() primary key,
  site_id uuid references public.sites(id) on delete cascade not null,
  status text not null check (status in ('ok', 'error')),
  response_time_ms integer,
  error_message text,
  checked_at timestamptz not null default now()
);

-- 3. Settings tabel
create table public.settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  emailit_api_key text,
  notification_email text
);

-- 4. Row Level Security (RLS) inschakelen
alter table public.sites enable row level security;
alter table public.check_results enable row level security;
alter table public.settings enable row level security;

-- 5. RLS Policies - Sites
create policy "Users can view own sites"
  on public.sites for select
  using (auth.uid() = user_id);

create policy "Users can insert own sites"
  on public.sites for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sites"
  on public.sites for update
  using (auth.uid() = user_id);

create policy "Users can delete own sites"
  on public.sites for delete
  using (auth.uid() = user_id);

-- 6. RLS Policies - Check Results (via site ownership)
create policy "Users can view own check results"
  on public.check_results for select
  using (
    exists (
      select 1 from public.sites
      where sites.id = check_results.site_id
      and sites.user_id = auth.uid()
    )
  );

-- Service role kan check results inserten (edge function)
create policy "Service role can insert check results"
  on public.check_results for insert
  with check (true);

-- 7. RLS Policies - Settings
create policy "Users can view own settings"
  on public.settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.settings for update
  using (auth.uid() = user_id);

-- 8. Service role policies voor edge function
-- De edge function draait met de service_role key en kan alles lezen/schrijven
create policy "Service role can read all sites"
  on public.sites for select
  using (true);

create policy "Service role can update all sites"
  on public.sites for update
  using (true);

create policy "Service role can read all settings"
  on public.settings for select
  using (true);

-- 9. Indexen voor performance
create index idx_sites_user_id on public.sites(user_id);
create index idx_sites_is_active on public.sites(is_active);
create index idx_check_results_site_id on public.check_results(site_id);
create index idx_check_results_checked_at on public.check_results(checked_at desc);
create index idx_settings_user_id on public.settings(user_id);
