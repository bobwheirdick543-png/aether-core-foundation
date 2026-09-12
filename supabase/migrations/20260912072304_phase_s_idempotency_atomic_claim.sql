create or replace function public.aether_api_idempotency_claim(
  p_api_key_id uuid,
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  claimed boolean,
  request_hash text,
  status_code integer,
  response_body jsonb,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.aether_api_idempotency%rowtype;
  was_inserted boolean := false;
begin
  delete from public.aether_api_idempotency
  where api_key_id = p_api_key_id
    and idempotency_key = p_idempotency_key
    and expires_at <= now();

  insert into public.aether_api_idempotency (
    api_key_id, owner_id, idempotency_key, request_hash, status_code, response_body
  ) values (
    p_api_key_id, p_owner_id, p_idempotency_key, p_request_hash, 202, null
  )
  on conflict (api_key_id, idempotency_key) do nothing;

  was_inserted := found;

  select * into existing
  from public.aether_api_idempotency
  where api_key_id = p_api_key_id
    and idempotency_key = p_idempotency_key;

  if existing.request_hash <> p_request_hash then
    raise exception using errcode = 'P0001', message = 'idempotency_conflict';
  end if;

  return query select
    was_inserted,
    existing.request_hash,
    existing.status_code,
    existing.response_body,
    existing.expires_at;
end;
$$;
revoke all on function public.aether_api_idempotency_claim(uuid, uuid, text, text) from public;
grant execute on function public.aether_api_idempotency_claim(uuid, uuid, text, text) to service_role;
