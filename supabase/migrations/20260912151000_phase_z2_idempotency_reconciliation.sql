-- Reconcile the Z2 idempotency implementation used by the external route.
-- The request route uses the request-hash-aware aether_api_idempotency table;
-- completion must update that same table rather than the legacy *_keys table.

create table if not exists public.aether_api_idempotency (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.aether_api_keys(id) on delete cascade,
  owner_id uuid not null,
  idempotency_key text not null,
  request_hash text not null,
  status_code integer not null default 202,
  response_body jsonb,
  request_record_id uuid references public.aether_api_request_records(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (api_key_id, idempotency_key)
);

alter table public.aether_api_idempotency
  add column if not exists request_record_id uuid references public.aether_api_request_records(id) on delete set null;
alter table public.aether_api_idempotency enable row level security;
revoke all on table public.aether_api_idempotency from public, anon, authenticated;
grant all on table public.aether_api_idempotency to service_role;

create or replace function public.aether_api_idempotency_claim(
  p_api_key_id uuid,
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns table(claimed boolean, request_hash text, status_code integer, response_body jsonb, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  existing public.aether_api_idempotency%rowtype;
  was_inserted boolean := false;
begin
  delete from public.aether_api_idempotency
   where api_key_id = p_api_key_id
     and idempotency_key = p_idempotency_key
     and expires_at <= now();

  insert into public.aether_api_idempotency(api_key_id, owner_id, idempotency_key, request_hash, status_code, response_body)
  values (p_api_key_id, p_owner_id, p_idempotency_key, p_request_hash, 202, null)
  on conflict (api_key_id, idempotency_key) do nothing;
  was_inserted := found;

  select * into existing
    from public.aether_api_idempotency
   where api_key_id = p_api_key_id
     and idempotency_key = p_idempotency_key;

  if existing.request_hash <> p_request_hash then
    raise exception using errcode = 'P0001', message = 'idempotency_conflict';
  end if;

  return query select was_inserted, existing.request_hash, existing.status_code, existing.response_body, existing.expires_at;
end;
$$;

create or replace function public.aether_api_idempotency_complete(
  p_api_key_id uuid,
  p_idempotency_key text,
  p_request_record_id uuid,
  p_response_body jsonb,
  p_success boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.aether_api_idempotency
     set status_code = case when p_success then 200 else 500 end,
         request_record_id = p_request_record_id,
         response_body = case when p_success then p_response_body else null end
   where api_key_id = p_api_key_id
     and idempotency_key = p_idempotency_key;
end;
$$;

revoke execute on function public.aether_api_idempotency_claim(uuid,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.aether_api_idempotency_complete(uuid,text,uuid,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.aether_api_idempotency_claim(uuid,uuid,text,text) to service_role;
grant execute on function public.aether_api_idempotency_complete(uuid,text,uuid,jsonb,boolean) to service_role;
