-- Allow an authenticated player to view an accepted neighbour's saved farm.
-- The save itself remains private; this SECURITY DEFINER RPC checks the accepted
-- friendship before returning only the farm_saves payload.
create or replace function public.hf_get_friend_farm(p_friend_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  farm jsonb;
begin
  if uid is null then
    raise exception 'Sign in to visit a neighbour farm.';
  end if;
  if p_friend_user_id is null or p_friend_user_id = uid then
    raise exception 'Choose a valid neighbour farm.';
  end if;
  if not exists (
    select 1
    from public.farmer_friend_requests r
    where r.status='accepted'
      and ((r.sender_id=uid and r.receiver_id=p_friend_user_id)
        or (r.sender_id=p_friend_user_id and r.receiver_id=uid))
  ) then
    raise exception 'You can only visit an accepted neighbour.';
  end if;
  select s.save_data into farm
  from public.farm_saves s
  where s.user_id=p_friend_user_id;
  if farm is null then
    raise exception 'This neighbour has not uploaded a cloud farm yet.';
  end if;
  return farm;
end;
$$;

revoke all on function public.hf_get_friend_farm(uuid) from public, anon;
grant execute on function public.hf_get_friend_farm(uuid) to authenticated;
