-- Phase Z2: Aether Intelligence API credential, quota, request audit and lifecycle foundation.
-- This extends the existing Developer API tables without replacing the Phase S/U boundary.

alter table public.aether_api_keys
  add column if not exists api_kind text not null default 'legacy',
  add column if not exists model_id uuid references public.aax_models(id),
  add column if not exists model_key text,
  add column if not exists model_generation integer,
  add column if not exists model_revision integer,
  add column if not exists environment text not null default 'production',
  add column if not exists application_name text,
  add column if not exists encrypted_secret text,
  add column if not exists secret_version integer not null default 1,
  add column if not exists status text not null default 'active',
  add column if not exists monthly_token_limit bigint not null default 200000,
  add column if not exists unlimited_tokens boolean not null default false,
  add column if not exists max_tokens_per_request integer not null default 4096,
  add column if not exists max_input_tokens integer not null default 12000,
  add column if not exists max_output_tokens integer not null default 4096,
  add column if not exists secret_recovery_available boolean not null default false;

alter table public.aether_api_keys
  drop constraint if exists aether_api_keys_environment_check;
alter table public.aether_api_keys
  add constraint aether_api_keys_environment_check check (environment in ('development','test','production'));
alter table public.aether_api_keys
  drop constraint if exists aether_api_keys_status_check;
alter table public.aether_api_keys
  add constraint aether_api_keys_status_check check (status in ('active','suspended','revoked','expired'));
alter table public.aether_api_keys
  drop constraint if exists aether_api_keys_z2_limits_check;
alter table public.aether_api_keys
  add constraint aether_api_keys_z2_limits_check check (monthly_token_limit >= 0 and max_tokens_per_request between 1 and 100000 and max_input_tokens between 1 and 1000000 and max_output_tokens between 1 and 100000);

create index if not exists aether_api_keys_kind_owner_idx on public.aether_api_keys(api_kind, owner_id, created_at desc);
create index if not exists aether_api_keys_model_idx on public.aether_api_keys(model_id);
create index if not exists aether_api_keys_status_idx on public.aether_api_keys(status);

alter table public.aether_api_key_events
  add column if not exists actor_id uuid,
  add column if not exists action_source text not null default 'user';
create index if not exists aether_api_key_events_key_created_idx on public.aether_api_key_events(api_key_id, created_at desc);

alter table public.aether_api_logs
  add column if not exists request_record_id uuid,
  add column if not exists application_name text,
  add column if not exists environment text,
  add column if not exists model_id uuid,
  add column if not exists model_key text,
  add column if not exists provider text,
  add column if not exists provider_model text,
  add column if not exists tokens_in integer,
  add column if not exists tokens_out integer,
  add column if not exists tokens_total integer,
  add column if not exists response_validation_status text,
  add column if not exists outcome text,
  add column if not exists error_code text;

create table if not exists public.aether_api_request_records (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  api_key_id uuid references public.aether_api_keys(id) on delete set null,
  owner_id uuid,
  application_name text,
  environment text,
  api_kind text not null default 'aax',
  api_version text not null default 'z2',
  model_id uuid,
  model_key text,
  provider text,
  provider_model text,
  request_body jsonb not null default '{}'::jsonb,
  response_body jsonb,
  response_text text,
  response_validation_status text,
  status_code integer,
  outcome text,
  error_code text,
  error_message text,
  tokens_reserved integer not null default 0,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  tokens_total integer not null default 0,
  usage_source text,
  latency_ms integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  retention_class text not null default 'permanent',
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists aether_api_request_records_owner_created_idx on public.aether_api_request_records(owner_id, created_at desc);
create index if not exists aether_api_request_records_key_created_idx on public.aether_api_request_records(api_key_id, created_at desc);
create index if not exists aether_api_request_records_model_created_idx on public.aether_api_request_records(model_id, created_at desc);
create index if not exists aether_api_request_records_outcome_idx on public.aether_api_request_records(outcome, created_at desc);

create table if not exists public.aether_api_key_usage_periods (
  api_key_id uuid not null references public.aether_api_keys(id) on delete cascade,
  period_start date not null,
  token_limit bigint not null,
  tokens_reserved bigint not null default 0,
  tokens_consumed bigint not null default 0,
  request_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (api_key_id, period_start),
  check (token_limit >= 0),
  check (tokens_reserved >= 0),
  check (tokens_consumed >= 0)
);
create index if not exists aether_api_key_usage_periods_period_idx on public.aether_api_key_usage_periods(period_start desc);

create table if not exists public.aether_api_token_reservations (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.aether_api_keys(id) on delete cascade,
  request_record_id uuid references public.aether_api_request_records(id) on delete cascade,
  period_start date not null,
  reserved_tokens integer not null,
  consumed_tokens integer not null default 0,
  status text not null default 'reserved',
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  check (reserved_tokens > 0),
  check (consumed_tokens >= 0)
);
create unique index if not exists aether_api_token_reservations_request_idx on public.aether_api_token_reservations(request_record_id) where request_record_id is not null;
create index if not exists aether_api_token_reservations_key_idx on public.aether_api_token_reservations(api_key_id, created_at desc);

create table if not exists public.aether_api_controls (
  id boolean primary key default true check (id),
  external_intelligence_enabled boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.aether_api_controls(id) values (true) on conflict (id) do nothing;

alter table public.aether_api_request_records enable row level security;
alter table public.aether_api_key_usage_periods enable row level security;
alter table public.aether_api_token_reservations enable row level security;
alter table public.aether_api_controls enable row level security;
revoke all on public.aether_api_request_records from anon, authenticated;
revoke all on public.aether_api_key_usage_periods from anon, authenticated;
revoke all on public.aether_api_token_reservations from anon, authenticated;
revoke all on public.aether_api_controls from anon, authenticated;

-- Recreate the authentication function with the Z2 credential metadata while preserving the
-- existing 5 fields consumed by the legacy Developer API.
drop function if exists public.aether_api_authenticate(text);
create or replace function public.aether_api_authenticate(p_key_hash text)
returns table(
  api_key_id uuid,
  owner_id uuid,
  project_id uuid,
  scopes text[],
  rate_limit_per_minute integer,
  api_kind text,
  model_id uuid,
  model_key text,
  model_generation integer,
  model_revision integer,
  environment text,
  application_name text,
  status text,
  monthly_token_limit bigint,
  unlimited_tokens boolean,
  max_tokens_per_request integer,
  max_input_tokens integer,
  max_output_tokens integer
)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  update public.aether_api_keys k
  set last_used_at = now(),
      updated_at = now(),
      status = case when k.revoked_at is not null then 'revoked' when k.expires_at is not null and k.expires_at <= now() then 'expired' else k.status end
  where k.key_hash = p_key_hash
    and k.revoked_at is null
    and k.status = 'active'
    and (k.expires_at is null or k.expires_at > now())
  returning k.id,k.owner_id,k.project_id,k.scopes,k.rate_limit_per_minute,k.api_kind,k.model_id,k.model_key,k.model_generation,k.model_revision,k.environment,k.application_name,k.status,k.monthly_token_limit,k.unlimited_tokens,k.max_tokens_per_request,k.max_input_tokens,k.max_output_tokens;
end;
$$;

create or replace function public.aether_api_z2_authenticate(p_key_hash text)
returns table(
  api_key_id uuid,
  owner_id uuid,
  project_id uuid,
  scopes text[],
  rate_limit_per_minute integer,
  api_kind text,
  model_id uuid,
  model_key text,
  model_generation integer,
  model_revision integer,
  environment text,
  application_name text,
  status text,
  monthly_token_limit bigint,
  unlimited_tokens boolean,
  max_tokens_per_request integer,
  max_input_tokens integer,
  max_output_tokens integer
)
language plpgsql security definer set search_path = public
as $$
begin
  update public.aether_api_keys k
  set last_used_at = now(),
      updated_at = now(),
      status = case when k.expires_at is not null and k.expires_at <= now() then 'expired' else k.status end
  where k.key_hash = p_key_hash and k.api_kind = 'aax';
  return query
  select k.id,k.owner_id,k.project_id,k.scopes,k.rate_limit_per_minute,k.api_kind,k.model_id,k.model_key,k.model_generation,k.model_revision,k.environment,k.application_name,k.status,k.monthly_token_limit,k.unlimited_tokens,k.max_tokens_per_request,k.max_input_tokens,k.max_output_tokens
  from public.aether_api_keys k
  where k.key_hash = p_key_hash
    and k.api_kind = 'aax'
    and k.status = 'active'
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now());
end;
$$;

create or replace function public.aether_api_quota_reserve(
  p_api_key_id uuid,
  p_request_record_id uuid,
  p_requested_tokens integer
)
returns table(allowed boolean, reason text, reservation_id uuid, period_start date, token_limit bigint, tokens_reserved bigint, tokens_consumed bigint)
language plpgsql security definer set search_path = public
as $$
declare
  k public.aether_api_keys%rowtype;
  period date := date_trunc('month', now())::date;
  u public.aether_api_key_usage_periods%rowtype;
  reservation uuid;
  requested integer := greatest(1, p_requested_tokens);
begin
  select * into k from public.aether_api_keys where id = p_api_key_id for update;
  if not found or k.api_kind <> 'aax' then
    return query select false,'invalid_api_key',null::uuid,period,0::bigint,0::bigint,0::bigint;
    return;
  end if;
  if k.status <> 'active' or k.revoked_at is not null or (k.expires_at is not null and k.expires_at <= now()) then
    return query select false,'api_key_not_active',null::uuid,period,0::bigint,0::bigint,0::bigint;
    return;
  end if;
  if not k.unlimited_tokens and requested > k.max_tokens_per_request then
    return query select false,'request_token_limit_exceeded',null::uuid,period,k.monthly_token_limit,0::bigint,0::bigint;
    return;
  end if;
  if k.unlimited_tokens then
    insert into public.aether_api_key_usage_periods(api_key_id,period_start,token_limit,tokens_reserved,tokens_consumed,request_count)
    values(k.id,period,k.monthly_token_limit,0,0,1)
    on conflict(api_key_id,period_start) do update set request_count=public.aether_api_key_usage_periods.request_count+1,updated_at=now();
  else
    insert into public.aether_api_key_usage_periods(api_key_id,period_start,token_limit,tokens_reserved,tokens_consumed,request_count)
    values(k.id,period,k.monthly_token_limit,requested,0,1)
    on conflict(api_key_id,period_start) do update
      set tokens_reserved=public.aether_api_key_usage_periods.tokens_reserved+excluded.tokens_reserved,
          request_count=public.aether_api_key_usage_periods.request_count+1,
          updated_at=now()
      where public.aether_api_key_usage_periods.tokens_consumed + public.aether_api_key_usage_periods.tokens_reserved + excluded.tokens_reserved <= public.aether_api_key_usage_periods.token_limit;
    if not found then
      select * into u from public.aether_api_key_usage_periods where api_key_id=k.id and period_start=period;
      return query select false,'monthly_token_quota_exhausted',null::uuid,period,u.token_limit,u.tokens_reserved,u.tokens_consumed;
      return;
    end if;
  end if;
  select * into u from public.aether_api_key_usage_periods where api_key_id=k.id and period_start=period;
  insert into public.aether_api_token_reservations(api_key_id,request_record_id,period_start,reserved_tokens,status)
  values(k.id,p_request_record_id,period,case when k.unlimited_tokens then 0 else requested end,'reserved')
  returning id into reservation;
  return query select true,'ok',reservation,period,u.token_limit,u.tokens_reserved,u.tokens_consumed;
end;
$$;

create or replace function public.aether_api_quota_finalize(
  p_reservation_id uuid,
  p_actual_tokens integer,
  p_success boolean
)
returns table(consumed_tokens integer,released_tokens integer,period_start date)
language plpgsql security definer set search_path = public
as $$
declare
  r public.aether_api_token_reservations%rowtype;
  actual integer := greatest(0,p_actual_tokens);
  released integer;
  final_status text;
begin
  select * into r from public.aether_api_token_reservations where id=p_reservation_id for update;
  if not found then return; end if;
  if r.status <> 'reserved' then return query select r.consumed_tokens,0,r.period_start; return; end if;
  actual := least(actual,r.reserved_tokens);
  released := greatest(0,r.reserved_tokens-actual);
  final_status := case when p_success then 'consumed' else 'released' end;
  update public.aether_api_token_reservations set consumed_tokens=actual,status=final_status,finalized_at=now() where id=r.id;
  update public.aether_api_key_usage_periods
  set tokens_reserved=greatest(0,tokens_reserved-r.reserved_tokens),
      tokens_consumed=tokens_consumed+actual,
      updated_at=now()
  where api_key_id=r.api_key_id and period_start=r.period_start;
  return query select actual,released,r.period_start;
end;
$$;

create or replace function public.aether_api_monthly_usage(p_api_key_id uuid)
returns table(period_start date,token_limit bigint,tokens_reserved bigint,tokens_consumed bigint,request_count bigint,tokens_remaining bigint)
language sql security definer set search_path = public
as $$
  select period_start,token_limit,tokens_reserved,tokens_consumed,request_count,
    case when token_limit < 0 then null else greatest(0,token_limit-tokens_reserved-tokens_consumed) end
  from public.aether_api_key_usage_periods
  where api_key_id=p_api_key_id and period_start=date_trunc('month',now())::date;
$$;

create or replace function public.aether_api_controls_enabled()
returns boolean language sql security definer set search_path = public
as $$ select coalesce((select external_intelligence_enabled from public.aether_api_controls where id=true),true); $$;
