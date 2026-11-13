-- Daily neighbour-help actions and a server-maintained community score.
alter table public.farmer_profiles
  add column if not exists neighbour_points bigint not null default 0
  check (neighbour_points >= 0);

create table if not exists public.farmer_help_actions (
  id uuid primary key default gen_random_uuid(),
  helper_id uuid not null references auth.users(id) on delete cascade,
  neighbour_id uuid not null references auth.users(id) on delete cascade,
  help_day date not null default ((now() at time zone 'utc')::date),
  points_awarded integer not null default 5 check (points_awarded = 5),
  created_at timestamptz not null default now(),
  constraint farmer_help_not_self check (helper_id <> neighbour_id),
  constraint farmer_help_once_per_day unique(helper_id,neighbour_id,help_day)
);
create index if not exists farmer_help_neighbour_day_idx
  on public.farmer_help_actions(neighbour_id,help_day desc);
alter table public.farmer_help_actions enable row level security;
revoke all on public.farmer_help_actions from anon,authenticated;

create or replace function public.hf_help_neighbour(p_friend_user_id uuid)
returns table(points_awarded integer,total_points bigint)
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); total bigint;
begin
  if uid is null then raise exception 'Sign in to help a neighbour.'; end if;
  if p_friend_user_id is null or p_friend_user_id=uid then raise exception 'Choose a valid neighbour.'; end if;
  if not exists(select 1 from public.farmer_friend_requests r where r.status='accepted'
    and ((r.sender_id=uid and r.receiver_id=p_friend_user_id) or (r.sender_id=p_friend_user_id and r.receiver_id=uid)))
    then raise exception 'You can only help an accepted neighbour.'; end if;
  insert into public.farmer_help_actions(helper_id,neighbour_id)
    values(uid,p_friend_user_id);
  update public.farmer_profiles set neighbour_points=neighbour_points+5,updated_at=now()
    where user_id=uid returning neighbour_points into total;
  return query select 5,total;
exception when unique_violation then
  raise exception 'You have already helped this neighbour today. Come back tomorrow!';
end $$;

create or replace function public.hf_get_my_neighbour_points()
returns bigint language plpgsql stable security definer set search_path=public as $$
declare total bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to view neighbour points.'; end if;
  select neighbour_points into total from public.farmer_profiles where user_id=auth.uid();
  return coalesce(total,0);
end $$;

grant execute on function public.hf_help_neighbour(uuid) to authenticated;
grant execute on function public.hf_get_my_neighbour_points() to authenticated;
revoke all on function public.hf_help_neighbour(uuid) from public,anon;
revoke all on function public.hf_get_my_neighbour_points() from public,anon;
