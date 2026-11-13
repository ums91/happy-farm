-- Idempotent cooperative transactions.
-- A client-generated request UUID makes retries safe if a browser closes or loses
-- its network connection after the server commits but before the local save updates.
create table if not exists public.farmer_coop_operations (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  operation_type text not null check (operation_type in ('contribution','claim')),
  job_id uuid not null references public.farmer_coop_jobs(id) on delete cascade,
  requirement_key text,
  requested_quantity integer,
  accepted_quantity integer not null default 0 check (accepted_quantity >= 0),
  reward_coins integer not null default 0 check (reward_coins >= 0),
  reward_xp integer not null default 0 check (reward_xp >= 0),
  reward_badge text,
  created_at timestamptz not null default now(),
  constraint farmer_coop_operation_request_once unique(farmer_id,request_id),
  check (
    (operation_type='contribution' and requirement_key is not null
      and requested_quantity between 1 and 100)
    or
    (operation_type='claim' and requirement_key is null and requested_quantity is null)
  )
);
alter table public.farmer_coop_operations enable row level security;
revoke all on public.farmer_coop_operations from anon,authenticated;

drop function if exists public.hf_contribute_cooperative_job(uuid,integer);
create or replace function public.hf_contribute_cooperative_job(
  p_job_id uuid,p_quantity integer,p_request_id uuid
)
returns table(contributed_now integer,total_contributed integer,my_total integer,job_status text)
language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid();
  job public.farmer_coop_jobs%rowtype;
  prior public.farmer_coop_operations%rowtype;
  accepted integer;
  farmer_total integer;
begin
  if uid is null then raise exception 'Sign in to contribute to a community job.'; end if;
  if p_request_id is null then raise exception 'A contribution request identifier is required.'; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>100 then
    raise exception 'Choose a contribution between 1 and 100 items.';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text),hashtext(p_request_id::text));
  select * into prior from public.farmer_coop_operations
    where farmer_id=uid and request_id=p_request_id;
  if found then
    if prior.operation_type<>'contribution' or prior.job_id<>p_job_id
       or prior.requested_quantity<>p_quantity then
      raise exception 'This request identifier was already used for a different village action.';
    end if;
    select * into job from public.farmer_coop_jobs where id=p_job_id;
    select coalesce(sum(c.quantity),0)::integer into farmer_total
      from public.farmer_coop_contributions c where c.job_id=p_job_id and c.farmer_id=uid;
    return query select prior.accepted_quantity,job.contributed_quantity,farmer_total,job.status;
    return;
  end if;

  select * into job from public.farmer_coop_jobs where id=p_job_id for update;
  if not found then raise exception 'This community job is unavailable.'; end if;
  if job.status<>'active' or job.ends_at<=now() then raise exception 'This job has ended.'; end if;
  if job.contributed_quantity>=job.target_quantity then raise exception 'The community goal is already complete.'; end if;

  accepted:=least(p_quantity,job.target_quantity-job.contributed_quantity);
  insert into public.farmer_coop_operations(
    farmer_id,request_id,operation_type,job_id,requirement_key,requested_quantity
  ) values(uid,p_request_id,'contribution',job.id,job.requirement_key,p_quantity);

  insert into public.farmer_coop_contributions(job_id,farmer_id,quantity)
    values(job.id,uid,accepted);
  update public.farmer_coop_jobs
    set contributed_quantity=contributed_quantity+accepted,
        status=case when contributed_quantity+accepted>=target_quantity then 'completed' else 'active' end
    where id=job.id returning * into job;
  update public.farmer_coop_operations set accepted_quantity=accepted
    where farmer_id=uid and request_id=p_request_id;
  select coalesce(sum(c.quantity),0)::integer into farmer_total
    from public.farmer_coop_contributions c where c.job_id=job.id and c.farmer_id=uid;
  return query select accepted,job.contributed_quantity,farmer_total,job.status;
end $$;

drop function if exists public.hf_claim_cooperative_job_reward(uuid);
create or replace function public.hf_claim_cooperative_job_reward(
  p_job_id uuid,p_request_id uuid
)
returns table(coins integer,xp integer,badge text)
language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid();
  job public.farmer_coop_jobs%rowtype;
  prior public.farmer_coop_operations%rowtype;
begin
  if uid is null then raise exception 'Sign in to claim cooperative rewards.'; end if;
  if p_request_id is null then raise exception 'A reward request identifier is required.'; end if;

  perform pg_advisory_xact_lock(hashtext(uid::text),hashtext(p_request_id::text));
  select * into prior from public.farmer_coop_operations
    where farmer_id=uid and request_id=p_request_id;
  if found then
    if prior.operation_type<>'claim' or prior.job_id<>p_job_id then
      raise exception 'This request identifier was already used for a different village action.';
    end if;
    return query select prior.reward_coins,prior.reward_xp,prior.reward_badge;
    return;
  end if;

  select * into job from public.farmer_coop_jobs where id=p_job_id for update;
  if not found or job.status<>'completed' or job.contributed_quantity<job.target_quantity then
    raise exception 'The community goal is not complete yet.';
  end if;
  if not exists(
    select 1 from public.farmer_coop_contributions c
    where c.job_id=job.id and c.farmer_id=uid
  ) then raise exception 'Contribute to this job before claiming its reward.'; end if;

  begin
    insert into public.farmer_coop_reward_claims(job_id,farmer_id)
      values(job.id,uid);
  exception when unique_violation then
    raise exception 'You have already claimed this job reward.';
  end;

  insert into public.farmer_coop_operations(
    farmer_id,request_id,operation_type,job_id,reward_coins,reward_xp,reward_badge
  ) values(uid,p_request_id,'claim',job.id,job.reward_coins,job.reward_xp,job.reward_badge);
  return query select job.reward_coins,job.reward_xp,job.reward_badge;
end $$;

grant execute on function public.hf_contribute_cooperative_job(uuid,integer,uuid) to authenticated;
grant execute on function public.hf_claim_cooperative_job_reward(uuid,uuid) to authenticated;
revoke all on function public.hf_contribute_cooperative_job(uuid,integer,uuid) from public,anon;
revoke all on function public.hf_claim_cooperative_job_reward(uuid,uuid) from public,anon;
