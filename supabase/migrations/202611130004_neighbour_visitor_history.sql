-- Let farmers see who has visited their farm.
create or replace function public.hf_list_my_farm_visitors()
returns table(farmer_name text,farm_name text,visited_at timestamptz,points_awarded integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view your farm visitors.'; end if;
  return query
    select p.farmer_name,p.farm_name,v.created_at,v.points_awarded
    from public.farmer_visit_actions v
    join public.farmer_profiles p on p.user_id=v.visitor_id
    where v.visited_user_id=auth.uid()
    order by v.created_at desc limit 20;
end $$;

grant execute on function public.hf_list_my_farm_visitors() to authenticated;
revoke all on function public.hf_list_my_farm_visitors() from public,anon;
