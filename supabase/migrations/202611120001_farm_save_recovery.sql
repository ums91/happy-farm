-- Happy Farm: independent recovery snapshots for Supabase Free projects.
-- Apply this migration in Supabase SQL Editor before enabling cloud recovery writes.

create table if not exists public.farm_save_recovery (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  save_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists farm_save_recovery_user_created_idx
  on public.farm_save_recovery (user_id, created_at desc);

alter table public.farm_save_recovery enable row level security;

drop policy if exists "Players can read their own farm recovery snapshots" on public.farm_save_recovery;
create policy "Players can read their own farm recovery snapshots"
  on public.farm_save_recovery for select
  using (auth.uid() = user_id);

drop policy if exists "Players can create their own farm recovery snapshots" on public.farm_save_recovery;
create policy "Players can create their own farm recovery snapshots"
  on public.farm_save_recovery for insert
  with check (auth.uid() = user_id);

drop policy if exists "Players can delete their own farm recovery snapshots" on public.farm_save_recovery;
create policy "Players can delete their own farm recovery snapshots"
  on public.farm_save_recovery for delete
  using (auth.uid() = user_id);
