-- Cooperative farming jobs: shared, time-limited community goals.
-- All contribution counts and rewards are computed server-side.
create table if not exists public.farmer_coop_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  requirement_key text not null check (requirement_key in (
    'wheat','carrot','corn','strawberry','tomato','pumpkin','blueberry','watermelon',
    'apples','pears','cherries','oranges','eggs','milk','flour','bread','pastry','grapes'
  )),
  requirement_label text not null,
  requirement_emoji text not null default '🌾',
  target_quantity integer not null check (target_quantity > 0),
  contributed_quantity integer not null default 0 check (contributed_quantity >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','completed','expired')),
  reward_coins integer not null default 0 check (reward_coins >= 0),
  reward_xp integer not null default 0 check (reward_xp >= 0),
  reward_badge text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (contributed_quantity <= target_quantity)
);
create index if not exists farmer_coop_jobs_status_end_idx
  on public.farmer_coop_jobs(status, ends_at);

create table if not exists public.farmer_coop_contributions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.farmer_coop_jobs(id) on delete cascade,
  farmer_id uuid not null references auth.users(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create index if not exists farmer_coop_contributions_job_idx
  on public.farmer_coop_contributions(job_id, created_at desc);
create index if not exists farmer_coop_contributions_farmer_idx
  on public.farmer_coop_contributions(farmer_id, created_at desc);

alter table public.farmer_coop_jobs enable row level security;
alter table public.farmer_coop_contributions enable row level security;
revoke all on public.farmer_coop_jobs from anon, authenticated;
revoke all on public.farmer_coop_contributions from anon, authenticated;

create or replace function public.hf_seed_cooperative_jobs()
returns void language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.farmer_coop_jobs where status='active' and ends_at>now()) then return; end if;
  update public.farmer_coop_jobs set status='expired' where status='active' and ends_at<=now();

  -- A small rotation of accessible produce objectives. New rotations start
  -- only when no active job remains; no background scheduler is required.
  insert into public.farmer_coop_jobs(
    title,description,requirement_key,requirement_label,requirement_emoji,
    target_quantity,starts_at,ends_at,reward_coins,reward_xp,reward_badge
  ) values
    ('The Wheat Wagon','Fill the village granary with freshly harvested wheat.','wheat','Wheat','🌾',250,now(),now()+interval '48 hours',300,60,'Granary Helper'),
    ('Breakfast for the Valley','Gather eggs from our happy hens for the village breakfast.','eggs','Eggs','🥚',120,now(),now()+interval '48 hours',360,70,'Breakfast Champion'),
    ('A Dairy Day','Help the village dairy stock up on fresh milk.','milk','Milk','🥛',90,now(),now()+interval '48 hours',420,80,'Dairy Partner');
end $$;

create or replace function public.hf_list_cooperative_jobs()
returns table(
  job_id uuid,title text,description text,requirement_key text,
  requirement_label text,requirement_emoji text,target_quantity integer,
  contributed_quantity integer,starts_at timestamptz,ends_at timestamptz,
  status text,reward_coins integer,reward_xp integer,reward_badge text,
  my_contribution integer,my_reward_claimed boolean,participant_count bigint
)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to join cooperative farming jobs.'; end if;
  perform public.hf_seed_cooperative_jobs();
  update public.farmer_coop_jobs j set status=case
    when j.contributed_quantity>=j.target_quantity then 'completed' else 'expired' end
    where j.status='active' and j.ends_at<=now();
  return query
    select j.id,j.title,j.description,j.requirement_key,j.requirement_label,j.requirement_emoji,
      j.target_quantity,j.contributed_quantity,j.starts_at,j.ends_at,j.status,
      j.reward_coins,j.reward_xp,j.reward_badge,
      coalesce(sum(c.quantity) filter(where c.farmer_id=auth.uid()),0)::integer,
      exists(select 1 from public.farmer_coop_reward_claims rc where rc.job_id=j.id and rc.farmer_id=auth.uid()),
      count(distinct c.farmer_id)
    from public.farmer_coop_jobs j
    left join public.farmer_coop_contributions c on c.job_id=j.id
    where j.status in ('active','completed') or j.ends_at>now()
    group by j.id
    order by case j.status when 'active' then 0 when 'completed' then 1 else 2 end,j.ends_at;
end $$;

create table if not exists public.farmer_coop_reward_claims (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.farmer_coop_jobs(id) on delete cascade,
  farmer_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  constraint farmer_coop_reward_once unique(job_id,farmer_id)
);
alter table public.farmer_coop_reward_claims enable row level security;
revoke all on public.farmer_coop_reward_claims from anon,authenticated;

create or replace function public.hf_contribute_cooperative_job(p_job_id uuid,p_quantity integer)
returns table(contributed_now integer,total_contributed integer,my_total integer,job_status text)
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); job public.farmer_coop_jobs%rowtype; accepted integer; farmer_total integer;
begin
  if uid is null then raise exception 'Sign in to contribute to a community job.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100 then raise exception 'Choose a contribution between 1 and 100 items.'; end if;
  select * into job from public.farmer_coop_jobs where id=p_job_id for update;
  if not found then raise exception 'This community job is unavailable.'; end if;
  if job.status<>'active' or job.ends_at<=now() then raise exception 'This job has ended.'; end if;
  if job.contributed_quantity>=job.target_quantity then raise exception 'The community goal is already complete.'; end if;
  accepted:=least(p_quantity,job.target_quantity-job.contributed_quantity);
  insert into public.farmer_coop_contributions(job_id,farmer_id,quantity) values(job.id,uid,accepted);
  update public.farmer_coop_jobs set contributed_quantity=contributed_quantity+accepted,
    status=case when contributed_quantity+accepted>=target_quantity then 'completed' else 'active' end
    where id=job.id returning contributed_quantity,status into total_contributed,job_status;
  select coalesce(sum(quantity),0)::integer into farmer_total from public.farmer_coop_contributions
    where job_id=job.id and farmer_id=uid;
  return query select accepted,total_contributed,farmer_total,job_status;
end $$;

create or replace function public.hf_claim_cooperative_job_reward(p_job_id uuid)
returns table(coins integer,xp integer,badge text)
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); job public.farmer_coop_jobs%rowtype;
begin
  if uid is null then raise exception 'Sign in to claim cooperative rewards.'; end if;
  select * into job from public.farmer_coop_jobs where id=p_job_id for update;
  if not found or job.status<>'completed' or job.contributed_quantity<job.target_quantity then
    raise exception 'The community goal is not complete yet.';
  end if;
  if not exists(select 1 from public.farmer_coop_contributions where job_id=job.id and farmer_id=uid) then
    raise exception 'Contribute to this job before claiming its reward.';
  end if;
  insert into public.farmer_coop_reward_claims(job_id,farmer_id) values(job.id,uid);
  return query select job.reward_coins,job.reward_xp,job.reward_badge;
exception when unique_violation then
  raise exception 'You have already claimed this job reward.';
end $$;

grant execute on function public.hf_list_cooperative_jobs() to authenticated;
grant execute on function public.hf_contribute_cooperative_job(uuid,integer) to authenticated;
grant execute on function public.hf_claim_cooperative_job_reward(uuid) to authenticated;
revoke all on function public.hf_seed_cooperative_jobs() from public,anon,authenticated;
revoke all on function public.hf_list_cooperative_jobs() from public,anon;
revoke all on function public.hf_contribute_cooperative_job(uuid,integer) from public,anon;
revoke all on function public.hf_claim_cooperative_job_reward(uuid) from public,anon;
