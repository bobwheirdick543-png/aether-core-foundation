-- The external Z2 route currently calls the two-argument rate limiter.
-- Keep that active overload atomic as well as the configurable-window variant.

create or replace function public.aether_api_rate_allowed(p_api_key_id uuid,p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_limit integer;
begin
  v_limit := greatest(1, least(10000, coalesce(p_limit, 60)));
  v_window_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / 60) * 60);

  insert into public.aether_api_rate_windows(api_key_id, window_start, request_count)
  values (p_api_key_id, v_window_start, 1)
  on conflict (api_key_id, window_start)
  do update set request_count = public.aether_api_rate_windows.request_count + 1
  returning request_count into v_count;

  if v_count <= v_limit then
    return true;
  end if;

  update public.aether_api_rate_windows
     set request_count = request_count - 1
   where api_key_id = p_api_key_id
     and window_start = v_window_start;
  return false;
end;
$$;

revoke execute on function public.aether_api_rate_allowed(uuid,integer) from public,anon,authenticated;
grant execute on function public.aether_api_rate_allowed(uuid,integer) to service_role;
