-- Phase Z2 security reconciliation.
-- Keeps the repository migration set aligned with the hardened live database:
-- atomic request-window accounting and no client execution of privileged
-- SECURITY DEFINER routines.

create table if not exists public.aether_api_rate_windows (
  api_key_id uuid not null references public.aether_api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (api_key_id, window_start)
);

alter table public.aether_api_rate_windows enable row level security;
revoke all on table public.aether_api_rate_windows from public, anon, authenticated;
grant all on table public.aether_api_rate_windows to service_role;

create or replace function public.aether_api_rate_allowed(
  p_api_key_id uuid,
  p_limit integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_limit is null or p_limit <= 0 then
    return true;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / greatest(p_window_seconds, 1))
      * greatest(p_window_seconds, 1)
  );

  insert into public.aether_api_rate_windows(api_key_id, window_start, request_count)
  values (p_api_key_id, v_window_start, 1)
  on conflict (api_key_id, window_start)
  do update set request_count = public.aether_api_rate_windows.request_count + 1
  returning request_count into v_count;

  if v_count <= p_limit then
    return true;
  end if;

  update public.aether_api_rate_windows
     set request_count = request_count - 1
   where api_key_id = p_api_key_id
     and window_start = v_window_start;
  return false;
end;
$$;

-- This function is server-only. The application API uses the service-role
-- connection after authenticating an AAX key at the HTTP boundary.
revoke execute on function public.aether_api_rate_allowed(uuid, integer) from public, anon, authenticated;
revoke execute on function public.aether_api_rate_allowed(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.aether_api_rate_allowed(uuid, integer) to service_role;
grant execute on function public.aether_api_rate_allowed(uuid, integer, integer) to service_role;

-- Privileged mutations/triggers must not be directly callable by browser or
-- anonymous PostgREST clients. SECURITY DEFINER does not make a function safe
-- to expose; these routines are invoked only from trusted server workflows.
do $block$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'bv_transfer_yons', 'bv_place_bid', 'bv_join_auction',
         'bv_start_auction', 'bv_complete_match',
         'append_orchestration_event', 'aether_api_quota_reserve',
         'aether_api_quota_finalize', 'aether_api_idempotency_complete',
         'consume_aether_research_rate_limit', 'record_ai_stat_change',
         'bridge_aax_knowledge_event_to_task_event',
         'activate_due_aax_releases', 'compute_aax_usage_cost',
         'prepare_aether_research_source_provenance', 'rls_auto_enable'
       )
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      r.schema_name, r.function_name, r.args
    );
  end loop;
end;
$block$;

-- Provider credentials remain an administrator-managed server-side vault.
-- No provider secret is exposed through this migration or to external API users.
