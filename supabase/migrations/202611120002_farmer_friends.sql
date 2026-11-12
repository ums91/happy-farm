-- Happy Farm social neighbours: private profiles and server-validated friend requests.
create table if not exists public.farmer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  friend_code text not null unique,
  farmer_name text not null default 'New Farmer' check (char_length(farmer_name) between 1 and 24),
  farm_name text not null default 'My Farm' check (char_length(farm_name) between 1 and 28),
  level integer not null default 1 check (level between 1 and 100),
  xp bigint not null default 0 check (xp >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.farmer_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_request_not_self check (sender_id <> receiver_id),
  constraint friend_request_pair_unique unique(sender_id, receiver_id)
);
create index if not exists farmer_friend_requests_receiver_status_idx on public.farmer_friend_requests(receiver_id,status,created_at desc);
create index if not exists farmer_friend_requests_sender_status_idx on public.farmer_friend_requests(sender_id,status,created_at desc);
alter table public.farmer_profiles enable row level security;
alter table public.farmer_friend_requests enable row level security;
revoke all on public.farmer_profiles from anon, authenticated;
revoke all on public.farmer_friend_requests from anon, authenticated;

create or replace function public.hf_make_friend_code() returns text
language plpgsql volatile as $$
declare candidate text;
begin
  loop
    candidate := upper(substr(md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text),1,8));
    exit when not exists(select 1 from public.farmer_profiles where friend_code=candidate);
  end loop;
  return candidate;
end $$;

create or replace function public.hf_ensure_farmer_profile() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.farmer_profiles(user_id,friend_code)
  values(new.id,public.hf_make_friend_code())
  on conflict(user_id) do nothing;
  return new;
end $$;
drop trigger if exists hf_create_farmer_profile on auth.users;
create trigger hf_create_farmer_profile after insert on auth.users
for each row execute function public.hf_ensure_farmer_profile();

create or replace function public.hf_sync_my_farmer_profile(p_farmer_name text,p_farm_name text,p_level integer,p_xp bigint)
returns table(friend_code text,farmer_name text,farm_name text,level integer,xp bigint)
language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in to use Friends & Neighbours.'; end if;
  insert into public.farmer_profiles(user_id,friend_code,farmer_name,farm_name,level,xp)
  values(uid,public.hf_make_friend_code(),left(coalesce(nullif(trim(p_farmer_name),''),'New Farmer'),24),left(coalesce(nullif(trim(p_farm_name),''),'My Farm'),28),greatest(1,least(100,coalesce(p_level,1))),greatest(0,coalesce(p_xp,0)))
  on conflict(user_id) do update set farmer_name=excluded.farmer_name,farm_name=excluded.farm_name,level=excluded.level,xp=excluded.xp,updated_at=now();
  return query select p.friend_code,p.farmer_name,p.farm_name,p.level,p.xp from public.farmer_profiles p where p.user_id=uid;
end $$;

create or replace function public.hf_search_farmer(p_friend_code text)
returns table(friend_code text,farmer_name text,farm_name text,level integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to search for farmers.'; end if;
  return query select p.friend_code,p.farmer_name,p.farm_name,p.level from public.farmer_profiles p
    where upper(p.friend_code)=upper(trim(p_friend_code)) and p.user_id<>auth.uid();
end $$;

create or replace function public.hf_send_friend_request(p_friend_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); target uuid; request_id uuid; existing_status text;
begin
  if uid is null then raise exception 'Sign in to add neighbours.'; end if;
  select user_id into target from public.farmer_profiles where upper(friend_code)=upper(trim(p_friend_code));
  if target is null then raise exception 'No farmer found with that Friend Code.'; end if;
  if target=uid then raise exception 'You cannot add yourself.'; end if;
  select status into existing_status from public.farmer_friend_requests
    where (sender_id=uid and receiver_id=target) or (sender_id=target and receiver_id=uid)
    order by created_at desc limit 1;
  if existing_status='accepted' then raise exception 'You are already neighbours.'; end if;
  if existing_status='pending' then raise exception 'A friend request is already pending.'; end if;
  delete from public.farmer_friend_requests where (sender_id=uid and receiver_id=target) or (sender_id=target and receiver_id=uid);
  insert into public.farmer_friend_requests(sender_id,receiver_id) values(uid,target) returning id into request_id;
  return request_id;
end $$;

create or replace function public.hf_list_friend_requests()
returns table(request_id uuid,direction text,friend_code text,farmer_name text,farm_name text,level integer,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view friend requests.'; end if;
  return query
    select r.id,case when r.receiver_id=auth.uid() then 'incoming' else 'outgoing' end,
      p.friend_code,p.farmer_name,p.farm_name,p.level,r.created_at
    from public.farmer_friend_requests r
    join public.farmer_profiles p on p.user_id=case when r.receiver_id=auth.uid() then r.sender_id else r.receiver_id end
    where (r.receiver_id=auth.uid() or r.sender_id=auth.uid()) and r.status='pending'
    order by r.created_at desc;
end $$;

create or replace function public.hf_respond_friend_request(p_request_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to manage friend requests.'; end if;
  update public.farmer_friend_requests set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now()
    where id=p_request_id and receiver_id=auth.uid() and status='pending';
  if not found then raise exception 'This friend request is no longer available.'; end if;
end $$;

create or replace function public.hf_list_friends()
returns table(friend_user_id uuid,friend_code text,farmer_name text,farm_name text,level integer,xp bigint,friends_since timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view neighbours.'; end if;
  return query
    select p.user_id,p.friend_code,p.farmer_name,p.farm_name,p.level,p.xp,r.responded_at
    from public.farmer_friend_requests r
    join public.farmer_profiles p on p.user_id=case when r.sender_id=auth.uid() then r.receiver_id else r.sender_id end
    where (r.sender_id=auth.uid() or r.receiver_id=auth.uid()) and r.status='accepted'
    order by p.farmer_name;
end $$;

create or replace function public.hf_remove_friend(p_friend_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to manage neighbours.'; end if;
  delete from public.farmer_friend_requests where status='accepted'
    and ((sender_id=auth.uid() and receiver_id=p_friend_user_id) or (sender_id=p_friend_user_id and receiver_id=auth.uid()));
end $$;

grant execute on function public.hf_sync_my_farmer_profile(text,text,integer,bigint) to authenticated;
grant execute on function public.hf_search_farmer(text) to authenticated;
grant execute on function public.hf_send_friend_request(text) to authenticated;
grant execute on function public.hf_list_friend_requests() to authenticated;
grant execute on function public.hf_respond_friend_request(uuid,boolean) to authenticated;
grant execute on function public.hf_list_friends() to authenticated;
grant execute on function public.hf_remove_friend(uuid) to authenticated;
