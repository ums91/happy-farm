-- Cooperative job leaderboards, personal contribution history and progressive rotations.
create table if not exists public.farmer_coop_progression (
  singleton boolean primary key default true check (singleton),
  cycle_number integer not null default 0 check (cycle_number >= 0),
  updated_at timestamptz not null default now()
);
alter table public.farmer_coop_progression enable row level security;
revoke all on public.farmer_coop_progression from anon,authenticated;

insert into public.farmer_coop_progression(singleton,cycle_number)
values(true,0) on conflict(singleton) do nothing;

create or replace function public.hf_seed_cooperative_jobs()
returns void language plpgsql security definer set search_path=public as $$
declare cycle integer; scale numeric; wheat_target integer; eggs_target integer; milk_target integer;
begin
  perform pg_advisory_xact_lock(hashtext('happy_farm_cooperative_rotation'));
  if exists(select 1 from public.farmer_coop_jobs where status='active' and ends_at>now()) then return; end if;
  update public.farmer_coop_jobs set status=case
    when contributed_quantity>=target_quantity then 'completed' else 'expired' end
    where status='active' and ends_at<=now();
  update public.farmer_coop_progression set cycle_number=cycle_number+1,updated_at=now()
    where singleton=true returning cycle_number into cycle;
  if cycle is null then
    insert into public.farmer_coop_progression(singleton,cycle_number) values(true,1)
      on conflict(singleton) do update set cycle_number=public.farmer_coop_progression.cycle_number+1,updated_at=now()
      returning cycle_number into cycle;
  end if;
  -- Increase targets by 20% every three completed rotations, capped at 2.5x.
  scale:=least(2.5::numeric,1+floor((cycle-1)/3)::numeric*0.2);
  wheat_target:=round(250*scale)::integer;
  eggs_target:=round(120*scale)::integer;
  milk_target:=round(90*scale)::integer;
  insert into public.farmer_coop_jobs(
    title,description,requirement_key,requirement_label,requirement_emoji,
    target_quantity,starts_at,ends_at,reward_coins,reward_xp,reward_badge
  ) values
    ('The Wheat Wagon','Fill the village granary with freshly harvested wheat.','wheat','Wheat','🌾',wheat_target,now(),now()+interval '48 hours',round(300*scale)::integer,round(60*scale)::integer,'Granary Helper'),
    ('Breakfast for the Valley','Gather eggs from our happy hens for the village breakfast.','eggs','Eggs','🥚',eggs_target,now(),now()+interval '48 hours',round(360*scale)::integer,round(70*scale)::integer,'Breakfast Champion'),
    ('A Dairy Day','Help the village dairy stock up on fresh milk.','milk','Milk', '🥛',milk_target,now(),now()+interval '48 hours',round(420*scale)::integer,round(80*scale)::integer,'Dairy Partner');
end $$;

create or replace function public.hf_list_cooperative_leaderboard()
returns table(rank bigint,farmer_id uuid,farmer_name text,farm_name text,level integer,total_contributed bigint,jobs_joined bigint)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in to view the village leaderboard.'; end if;
 perform public.hf_seed_cooperative_jobs();
 return query
 with totals as (
  select c.farmer_id,sum(c.quantity)::bigint total,count(distinct c.job_id)::bigint jobs
  from public.farmer_coop_contributions c
  join public.farmer_coop_jobs j on j.id=c.job_id
  where j.created_at>=now()-interval '30 days'
  group by c.farmer_id
 ), ranked as (
  select t.*,row_number() over(order by t.total desc,t.jobs desc,t.farmer_id) pos
  from totals t
 )
 select r.pos,p.user_id,p.farmer_name,p.farm_name,p.level,r.total,r.jobs
 from ranked r join public.farmer_profiles p on p.user_id=r.farmer_id
 order by r.pos limit 20;
end $$;

create or replace function public.hf_list_my_cooperative_history()
returns table(job_id uuid,title text,requirement_label text,quantity integer,contributed_at timestamptz,job_status text,reward_coins integer,reward_xp integer,reward_claimed boolean)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in to view your contribution history.'; end if;
 return query
 select j.id,j.title,j.requirement_label,c.quantity,c.created_at,j.status,j.reward_coins,j.reward_xp,
  exists(select 1 from public.farmer_coop_reward_claims rc where rc.job_id=j.id and rc.farmer_id=auth.uid())
 from public.farmer_coop_contributions c join public.farmer_coop_jobs j on j.id=c.job_id
 where c.farmer_id=auth.uid()
 order by c.created_at desc limit 30;
end $$;

grant execute on function public.hf_list_cooperative_leaderboard() to authenticated;
grant execute on function public.hf_list_my_cooperative_history() to authenticated;
revoke all on function public.hf_list_cooperative_leaderboard() from public,anon;
revoke all on function public.hf_list_my_cooperative_history() from public,anon;
