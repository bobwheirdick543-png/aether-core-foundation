create or replace function public.aether_api_quota_reserve(p_api_key_id uuid,p_request_record_id uuid,p_requested_tokens integer)
returns table(allowed boolean,reason text,reservation_id uuid,period_start date,token_limit bigint,tokens_reserved bigint,tokens_consumed bigint)
language plpgsql security definer set search_path=public
as $$
declare
  k public.aether_api_keys%rowtype;
  v_period date := date_trunc('month',now())::date;
  u public.aether_api_key_usage_periods%rowtype;
  reservation uuid;
  requested integer := greatest(1,p_requested_tokens);
begin
  select * into k from public.aether_api_keys where id=p_api_key_id for update;
  if not found or k.api_kind <> 'aax' then return query select false,'invalid_api_key',null::uuid,v_period,0::bigint,0::bigint,0::bigint; return; end if;
  if k.status <> 'active' or k.revoked_at is not null or (k.expires_at is not null and k.expires_at <= now()) then return query select false,'api_key_not_active',null::uuid,v_period,k.monthly_token_limit,0::bigint,0::bigint; return; end if;
  if not k.unlimited_tokens and requested > k.max_tokens_per_request then return query select false,'request_token_limit_exceeded',null::uuid,v_period,k.monthly_token_limit,0::bigint,0::bigint; return; end if;
  if not k.unlimited_tokens and requested > k.monthly_token_limit then return query select false,'monthly_token_quota_exhausted',null::uuid,v_period,k.monthly_token_limit,0::bigint,0::bigint; return; end if;
  if k.unlimited_tokens then
    insert into public.aether_api_key_usage_periods(api_key_id,period_start,token_limit,tokens_reserved,tokens_consumed,request_count) values(k.id,v_period,k.monthly_token_limit,0,0,1)
    on conflict(api_key_id,period_start) do update set request_count=public.aether_api_key_usage_periods.request_count+1,updated_at=now();
  else
    insert into public.aether_api_key_usage_periods(api_key_id,period_start,token_limit,tokens_reserved,tokens_consumed,request_count) values(k.id,v_period,k.monthly_token_limit,requested,0,1)
    on conflict(api_key_id,period_start) do update set tokens_reserved=public.aether_api_key_usage_periods.tokens_reserved+excluded.tokens_reserved,request_count=public.aether_api_key_usage_periods.request_count+1,updated_at=now()
    where public.aether_api_key_usage_periods.tokens_consumed+public.aether_api_key_usage_periods.tokens_reserved+excluded.tokens_reserved <= public.aether_api_key_usage_periods.token_limit;
    if not found then select * into u from public.aether_api_key_usage_periods where api_key_id=k.id and public.aether_api_key_usage_periods.period_start=v_period; return query select false,'monthly_token_quota_exhausted',null::uuid,v_period,u.token_limit,u.tokens_reserved,u.tokens_consumed; return; end if;
  end if;
  select * into u from public.aether_api_key_usage_periods where api_key_id=k.id and public.aether_api_key_usage_periods.period_start=v_period;
  insert into public.aether_api_token_reservations(api_key_id,request_record_id,period_start,reserved_tokens,status) values(k.id,p_request_record_id,v_period,case when k.unlimited_tokens then 1 else requested end,'reserved') returning id into reservation;
  return query select true,'ok',reservation,v_period,u.token_limit,u.tokens_reserved,u.tokens_consumed;
end;
$$;

create or replace function public.aether_api_quota_finalize(p_reservation_id uuid,p_actual_tokens integer,p_success boolean)
returns table(consumed_tokens integer,released_tokens integer,period_start date)
language plpgsql security definer set search_path=public
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
  final_status := case when actual > 0 then 'consumed' else 'released' end;
  update public.aether_api_token_reservations set consumed_tokens=actual,status=final_status,finalized_at=now() where id=r.id;
  update public.aether_api_key_usage_periods set tokens_reserved=greatest(0,tokens_reserved-r.reserved_tokens),tokens_consumed=tokens_consumed+actual,updated_at=now() where api_key_id=r.api_key_id and public.aether_api_key_usage_periods.period_start=r.period_start;
  return query select actual,released,r.period_start;
end;
$$;

create or replace function public.aether_api_monthly_usage(p_api_key_id uuid)
returns table(period_start date,token_limit bigint,tokens_reserved bigint,tokens_consumed bigint,request_count bigint,tokens_remaining bigint)
language sql security definer set search_path=public
as $$
  select u.period_start,u.token_limit,u.tokens_reserved,u.tokens_consumed,u.request_count,greatest(0,u.token_limit-u.tokens_reserved-u.tokens_consumed)
  from public.aether_api_key_usage_periods u
  where u.api_key_id=p_api_key_id and u.period_start=date_trunc('month',now())::date;
$$;
