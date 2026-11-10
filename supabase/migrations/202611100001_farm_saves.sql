-- Happy Farm cloud saves. Run in the Supabase SQL Editor.
create table if not exists public.farm_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save_data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint farm_saves_payload_object check (jsonb_typeof(save_data) = 'object')
);
alter table public.farm_saves enable row level security;
drop policy if exists "Players can read their own farm save" on public.farm_saves;
create policy "Players can read their own farm save" on public.farm_saves
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Players can create their own farm save" on public.farm_saves;
create policy "Players can create their own farm save" on public.farm_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Players can update their own farm save" on public.farm_saves;
create policy "Players can update their own farm save" on public.farm_saves
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update on public.farm_saves to authenticated;
revoke all on public.farm_saves from anon;
