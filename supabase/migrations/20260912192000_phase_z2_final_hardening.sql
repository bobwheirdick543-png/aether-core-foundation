-- Phase Z2 final hardening: atomic rate windows and correct accounting for unlimited-token keys.
create table if not exists public.aether_api_rate_windows (
  api_key_id uuid not null references public.aether_api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (api_key_id, window_start),
  check (request_count >= 0)
);
create index if not exists aether_api_rate_windows_created_idx on public.aether_api_rate_windows(window_start);
alter table public.aether_api_rate_windows enable row level security;
revoke all on public.aether_api_rate_windows from anon, authenticated;

create or replace function public.aether_api_rate_allowed(p_api_key_id uuid, p_limit integer)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  current_window timestamptz := date_trunc('minute', now());
  current_count integer;
  effective_limit integer := greatest(1, least(10000, coalesce(p_limit, 60)));
begin
  delete from public.aether_api_rate_windows where window_start < current_window - interval '2 minutes';
  insert into public.aether_api_rate_windows(api_key_id, window_start, request_count)
  values (p_api_key_id, current_window, 1)
  on conflict (api_key_id, window_start) do update
    set request_count = public.aether_api_rate_windows.request_count + 1
    where public.aether_api_rate_windows.request_count < effective_limit
  returning request_count into current_count;
  if current_count is null then
    select request_count into current_count from public.aether_api_rate_windows where api_key_id=p_api_key_id and window_start=current_window;
  end if;
  return coalesce(current_count, 0) <= effective_limit;
end;
$$;

create or replace function public.aether_api_quota_finalize(p_reservation_id uuid,p_actual_tokens integer,p_success boolean)
returns table(consumed_tokens integer,released_tokens integer,period_start date)
language plpgsql security definer set search_path = public
as $$
declare
  r public.aether_api_token_reservations%rowtype;
  key_unlimited boolean;
  actual integer := greatest(0,p_actual_tokens);
  released integer := 0;
  final_status text;
begin
  select * into r from public.aether_api_token_reservations where id=p_reservation_id for update;
  if not found then return; end if;
  if r.status <> 'reserved' then return query select r.consumed_tokens,0,r.period_start; return; end if;
  select unlimited_tokens into key_unlimited from public.aether_api_keys where id=r.api_key_id;
  if coalesce(key_unlimited,false) then
    final_status := case when p_success and actual > 0 then 'consumed' else 'released' end;
    update public.aether_api_token_reservations set consumed_tokens=actual,status=final_status,finalized_at=now() where id=r.id;
    update public.aether_api_key_usage_periods set tokens_consumed=tokens_consumed+case when p_success then actual else 0 end,updated_at=now() where api_key_id=r.api_key_id and period_start=r.period_start;
    return query select case when p_success then actual else 0 end,0,r.period_start;
    return;
  end if;
  actual := least(actual,r.reserved_tokens);
  released := greatest(0,r.reserved_tokens-actual);
  final_status := case when p_success and actual > 0 then 'consumed' else 'released' end;
  update public.aether_api_token_reservations set consumed_tokens=actual,status=final_status,finalized_at=now() where id=r.id;
  update public.aether_api_key_usage_periods set tokens_reserved=greatest(0,tokens_reserved-r.reserved_tokens),tokens_consumed=tokens_consumed+case when p_success then actual else 0 end,updated_at=now() where api_key_id=r.api_key_id and period_start=r.period_start;
  return query select case when p_success then actual else 0 end,released,r.period_start;
end;
$$;
