-- Daily neighbour gifts. Gifts are server-tracked and can be claimed exactly once.
create table if not exists public.farmer_gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  coins integer not null default 25 check (coins = 25),
  sent_day date not null default ((now() at time zone 'utc')::date),
  sent_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint farmer_gift_not_self check (sender_id <> receiver_id)
);
create unique index if not exists farmer_gifts_sender_receiver_day_uidx
  on public.farmer_gifts(sender_id,receiver_id,sent_day);
create index if not exists farmer_gifts_receiver_unclaimed_idx
  on public.farmer_gifts(receiver_id,sent_at desc) where claimed_at is null;
alter table public.farmer_gifts enable row level security;
revoke all on public.farmer_gifts from anon, authenticated;

create or replace function public.hf_send_gift(p_friend_user_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); gift_id uuid;
begin
  if uid is null then raise exception 'Sign in to send neighbour gifts.'; end if;
  if p_friend_user_id is null or p_friend_user_id=uid then raise exception 'Choose a valid neighbour.'; end if;
  if not exists (
    select 1 from public.farmer_friend_requests r
    where r.status='accepted'
      and ((r.sender_id=uid and r.receiver_id=p_friend_user_id)
        or (r.sender_id=p_friend_user_id and r.receiver_id=uid))
  ) then raise exception 'You can only send gifts to accepted neighbours.'; end if;
  if (select count(*) from public.farmer_gifts g
      where g.sender_id=uid and g.sent_day=(now() at time zone 'utc')::date) >= 5
    then raise exception 'Daily gift limit reached. You can send up to 5 gifts per day.'; end if;
  insert into public.farmer_gifts(sender_id,receiver_id)
  values(uid,p_friend_user_id) returning id into gift_id;
  return gift_id;
exception when unique_violation then
  raise exception 'You have already sent this neighbour a gift today.';
end $$;

create or replace function public.hf_list_my_gifts()
returns table(gift_id uuid,sender_name text,sender_farm text,coins integer,sent_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view gifts.'; end if;
  return query select g.id,p.farmer_name,p.farm_name,g.coins,g.sent_at
    from public.farmer_gifts g join public.farmer_profiles p on p.user_id=g.sender_id
    where g.receiver_id=auth.uid() and g.claimed_at is null order by g.sent_at desc;
end $$;

create or replace function public.hf_list_sent_gifts()
returns table(receiver_name text,coins integer,sent_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view sent gifts.'; end if;
  return query select p.farmer_name,g.coins,g.sent_at
    from public.farmer_gifts g join public.farmer_profiles p on p.user_id=g.receiver_id
    where g.sender_id=auth.uid() and g.sent_day=(now() at time zone 'utc')::date
    order by g.sent_at desc;
end $$;

create or replace function public.hf_claim_gift(p_gift_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare amount integer;
begin
  if auth.uid() is null then raise exception 'Sign in to collect gifts.'; end if;
  update public.farmer_gifts set claimed_at=now()
    where id=p_gift_id and receiver_id=auth.uid() and claimed_at is null
    returning coins into amount;
  if amount is null then raise exception 'This gift is unavailable or has already been collected.'; end if;
  return amount;
end $$;

grant execute on function public.hf_send_gift(uuid) to authenticated;
grant execute on function public.hf_list_my_gifts() to authenticated;
grant execute on function public.hf_list_sent_gifts() to authenticated;
grant execute on function public.hf_claim_gift(uuid) to authenticated;
revoke all on function public.hf_send_gift(uuid) from public,anon;
revoke all on function public.hf_list_my_gifts() from public,anon;
revoke all on function public.hf_list_sent_gifts() from public,anon;
revoke all on function public.hf_claim_gift(uuid) from public,anon;
