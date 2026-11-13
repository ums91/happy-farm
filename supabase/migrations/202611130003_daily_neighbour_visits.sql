-- Server-side daily neighbour visits and visit points.
alter table public.farmer_profiles
  add column if not exists visit_points bigint not null default 0
  check (visit_points >= 0);

create table if not exists public.farmer_visit_actions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references auth.users(id) on delete cascade,
  visited_user_id uuid not null references auth.users(id) on delete cascade,
  visit_day date not null default ((now() at time zone 'utc')::date),
  points_awarded integer not null default 10 check (points_awarded in (0,10)),
  created_at timestamptz not null default now(),
  constraint farmer_visit_not_self check (visitor_id <> visited_user_id),
  constraint farmer_visit_once_per_day unique(visitor_id,visited_user_id,visit_day)
);
create index if not exists farmer_visit_visitor_created_idx
  on public.farmer_visit_actions(visitor_id,created_at desc);
alter table public.farmer_visit_actions enable row level security;
revoke all on public.farmer_visit_actions from anon,authenticated;

create or replace function public.hf_record_friend_visit(p_friend_user_id uuid)
returns table(points_awarded integer,total_visit_points bigint,already_visited boolean)
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); awarded integer:=10; total bigint;
begin
  if uid is null then raise exception 'Sign in to record a neighbour visit.'; end if;
  if p_friend_user_id is null or p_friend_user_id=uid then raise exception 'Choose a valid neighbour.'; end if;
  if not exists(select 1 from public.farmer_friend_requests r where r.status='accepted'
    and ((r.sender_id=uid and r.receiver_id=p_friend_user_id) or (r.sender_id=p_friend_user_id and r.receiver_id=uid)))
    then raise exception 'You can only visit an accepted neighbour.'; end if;
  insert into public.farmer_visit_actions(visitor_id,visited_user_id,points_awarded)
    values(uid,p_friend_user_id,10) on conflict(visitor_id,visited_user_id,visit_day) do nothing;
  if not found then awarded:=0; end if;
  if awarded=10 then
    update public.farmer_profiles set visit_points=visit_points+10,updated_at=now()
      where user_id=uid returning visit_points into total;
  else
    select visit_points into total from public.farmer_profiles where user_id=uid;
  end if;
  return query select awarded,coalesce(total,0),awarded=0;
end $$;

create or replace function public.hf_list_my_friend_visits()
returns table(farmer_name text,farm_name text,visited_at timestamptz,points_awarded integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view your visit history.'; end if;
  return query
    select p.farmer_name,p.farm_name,v.created_at,v.points_awarded
    from public.farmer_visit_actions v
    join public.farmer_profiles p on p.user_id=v.visited_user_id
    where v.visitor_id=auth.uid()
    order by v.created_at desc limit 20;
end $$;

grant execute on function public.hf_record_friend_visit(uuid) to authenticated;
grant execute on function public.hf_list_my_friend_visits() to authenticated;
revoke all on function public.hf_record_friend_visit(uuid) from public,anon;
revoke all on function public.hf_list_my_friend_visits() from public,anon;

create or replace function public.hf_get_my_visit_points()
returns bigint language plpgsql stable security definer set search_path=public as $$
declare total bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to view visit points.'; end if;
  select visit_points into total from public.farmer_profiles where user_id=auth.uid();
  return coalesce(total,0);
end $$;
grant execute on function public.hf_get_my_visit_points() to authenticated;
revoke all on function public.hf_get_my_visit_points() from public,anon;
