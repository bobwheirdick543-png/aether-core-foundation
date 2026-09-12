create table if not exists public.aether_api_idempotency_keys (
  api_key_id uuid not null references public.aether_api_keys(id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'in_progress',
  request_record_id uuid references public.aether_api_request_records(id) on delete set null,
  response_body jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (api_key_id,idempotency_key),
  check (char_length(idempotency_key) between 1 and 255),
  check (status in ('in_progress','completed','failed'))
);
create index if not exists aether_api_idempotency_expiry_idx on public.aether_api_idempotency_keys(expires_at);
alter table public.aether_api_idempotency_keys enable row level security;
revoke all on public.aether_api_idempotency_keys from anon,authenticated;

create or replace function public.aether_api_idempotency_claim(p_api_key_id uuid,p_idempotency_key text)
returns table(claimed boolean,status text,request_record_id uuid,response_body jsonb)
language plpgsql security definer set search_path=public
as $$
declare existing public.aether_api_idempotency_keys%rowtype;
begin
  delete from public.aether_api_idempotency_keys where expires_at<=now();
  insert into public.aether_api_idempotency_keys(api_key_id,idempotency_key,status)
  values(p_api_key_id,p_idempotency_key,'in_progress')
  on conflict(api_key_id,idempotency_key) do nothing;
  if found then return query select true,'in_progress',null::uuid,null::jsonb; return; end if;
  select * into existing from public.aether_api_idempotency_keys where api_key_id=p_api_key_id and idempotency_key=p_idempotency_key;
  return query select false,existing.status,existing.request_record_id,existing.response_body;
end;
$$;

create or replace function public.aether_api_idempotency_complete(p_api_key_id uuid,p_idempotency_key text,p_request_record_id uuid,p_response_body jsonb,p_success boolean)
returns void language plpgsql security definer set search_path=public
as $$
begin
  update public.aether_api_idempotency_keys set status=case when p_success then 'completed' else 'failed' end,request_record_id=p_request_record_id,response_body=case when p_success then p_response_body else null end,updated_at=now() where api_key_id=p_api_key_id and idempotency_key=p_idempotency_key;
end;
$$;
