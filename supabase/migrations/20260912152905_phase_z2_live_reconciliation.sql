-- Phase Z2 live reconciliation.
-- Mirrors verified live-project fixes: atomic rate windows, exact quota finalization,
-- request-body-hash idempotency, lifecycle authentication and privileged-function grants.

create or replace function public.aether_api_rate_allowed(p_api_key_id uuid,p_limit integer,p_window_seconds integer default 60)
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
create or replace function public.aether_api_rate_allowed(p_api_key_id uuid,p_limit integer)
returns boolean language sql security definer set search_path=public
as $$ select public.aether_api_rate_allowed(p_api_key_id,p_limit,60); $$;
create or replace function public.aether_api_quota_finalize(p_reservation_id uuid,p_actual_tokens integer,p_success boolean)
returns table(consumed_tokens integer,released_tokens integer,period_start date)
language plpgsql security definer set search_path=public
as $$
declare r public.aether_api_token_reservations%rowtype; key_unlimited boolean; actual integer:=greatest(0,coalesce(p_actual_tokens,0)); released integer:=0; final_status text;
begin
  select * into r from public.aether_api_token_reservations tr where tr.id=p_reservation_id for update;
  if not found then return; end if;
  if r.status<>'reserved' then return query select r.consumed_tokens,0,r.period_start; return; end if;
  select k.unlimited_tokens into key_unlimited from public.aether_api_keys k where k.id=r.api_key_id;
  if not coalesce(p_success,false) then actual:=0; end if;
  if coalesce(key_unlimited,false) then
    final_status:=case when actual>0 then 'consumed' else 'released' end;
    update public.aether_api_token_reservations tr set consumed_tokens=actual,status=final_status,finalized_at=now() where tr.id=r.id;
    update public.aether_api_key_usage_periods u set tokens_consumed=u.tokens_consumed+actual,updated_at=now() where u.api_key_id=r.api_key_id and u.period_start=r.period_start;
    return query select actual,0,r.period_start; return;
  end if;
  released:=greatest(0,r.reserved_tokens-case when p_success then least(actual,r.reserved_tokens) else 0 end);
  final_status:=case when p_success and actual>0 then 'consumed' else 'released' end;
  update public.aether_api_token_reservations tr set consumed_tokens=case when p_success then actual else 0 end,status=final_status,finalized_at=now() where tr.id=r.id;
  update public.aether_api_key_usage_periods u set tokens_reserved=greatest(0,u.tokens_reserved-r.reserved_tokens),tokens_consumed=u.tokens_consumed+case when p_success then actual else 0 end,updated_at=now() where u.api_key_id=r.api_key_id and u.period_start=r.period_start;
  return query select case when p_success then actual else 0 end,released,r.period_start;
end;
$$;
create or replace function public.aether_api_idempotency_claim(p_api_key_id uuid,p_owner_id uuid,p_idempotency_key text,p_request_hash text)
returns table(claimed boolean,request_hash text,status_code integer,response_body jsonb,expires_at timestamptz)
language plpgsql security definer set search_path=public
as $$
declare existing public.aether_api_idempotency%rowtype; was_inserted boolean:=false;
begin
  delete from public.aether_api_idempotency i where i.api_key_id=p_api_key_id and i.idempotency_key=p_idempotency_key and i.expires_at<=now();
  insert into public.aether_api_idempotency(api_key_id,owner_id,idempotency_key,request_hash,status_code,response_body) values(p_api_key_id,p_owner_id,p_idempotency_key,p_request_hash,202,null) on conflict(api_key_id,idempotency_key) do nothing;
  was_inserted:=found;
  select i.* into existing from public.aether_api_idempotency i where i.api_key_id=p_api_key_id and i.idempotency_key=p_idempotency_key;
  if existing.request_hash<>p_request_hash then raise exception using errcode='P0001',message='idempotency_conflict'; end if;
  return query select was_inserted,existing.request_hash,existing.status_code,existing.response_body,existing.expires_at;
end;
$$;
create or replace function public.aether_api_z2_authenticate(p_key_hash text)
returns table(api_key_id uuid,owner_id uuid,project_id uuid,scopes text[],rate_limit_per_minute integer,api_kind text,model_id uuid,model_key text,model_generation integer,model_revision integer,environment text,application_name text,status text,monthly_token_limit bigint,unlimited_tokens boolean,max_tokens_per_request integer,max_input_tokens integer,max_output_tokens integer)
language plpgsql security definer set search_path=public
as $$
begin
  update public.aether_api_keys k set last_used_at=now(),updated_at=now(),status=case when k.expires_at is not null and k.expires_at<=now() then 'expired' else k.status end where k.key_hash=p_key_hash and k.api_kind='aax';
  return query select k.id,k.owner_id,k.project_id,k.scopes,k.rate_limit_per_minute,k.api_kind,k.model_id,k.model_key,k.model_generation,k.model_revision,k.environment,k.application_name,k.status,k.monthly_token_limit,k.unlimited_tokens,k.max_tokens_per_request,k.max_input_tokens,k.max_output_tokens from public.aether_api_keys k where k.key_hash=p_key_hash and k.api_kind='aax' and k.status='active' and k.revoked_at is null and (k.expires_at is null or k.expires_at>now());
end;
$$;
revoke execute on function public.aether_api_rate_allowed(uuid,integer) from public,anon,authenticated;
revoke execute on function public.aether_api_rate_allowed(uuid,integer,integer) from public,anon,authenticated;
revoke execute on function public.aether_api_quota_finalize(uuid,integer,boolean) from public,anon,authenticated;
revoke execute on function public.aether_api_idempotency_claim(uuid,uuid,text,text) from public,anon,authenticated;
revoke execute on function public.aether_api_z2_authenticate(text) from public,anon,authenticated;
