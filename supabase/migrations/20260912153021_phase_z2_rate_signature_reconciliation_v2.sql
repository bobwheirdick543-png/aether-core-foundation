-- Keep both legacy and explicit-window Z2 rate signatures without a default-argument ambiguity.
drop function if exists public.aether_api_rate_allowed(uuid,integer,integer);
create function public.aether_api_rate_allowed(p_api_key_id uuid,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path=public
as $$
declare v_window_seconds integer:=greatest(1,least(86400,coalesce(p_window_seconds,60))); v_limit integer:=greatest(1,least(10000,coalesce(p_limit,60))); v_window_start timestamptz; v_count integer;
begin
  v_window_start:=to_timestamp(floor(extract(epoch from clock_timestamp())/v_window_seconds)*v_window_seconds);
  delete from public.aether_api_rate_windows where api_key_id=p_api_key_id and window_start < v_window_start - make_interval(secs => v_window_seconds*2);
  insert into public.aether_api_rate_windows(api_key_id,window_start,request_count) values(p_api_key_id,v_window_start,1)
  on conflict(api_key_id,window_start) do update set request_count=public.aether_api_rate_windows.request_count+1 returning request_count into v_count;
  if v_count<=v_limit then return true; end if;
  update public.aether_api_rate_windows set request_count=greatest(0,request_count-1) where api_key_id=p_api_key_id and window_start=v_window_start;
  return false;
end;
$$;
revoke execute on function public.aether_api_rate_allowed(uuid,integer) from public,anon,authenticated;
revoke execute on function public.aether_api_rate_allowed(uuid,integer,integer) from public,anon,authenticated;
