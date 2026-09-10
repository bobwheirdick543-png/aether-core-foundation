create table if not exists public.aax_evaluations (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.aax_models(id) on delete cascade,
  suite_key text not null default 'manual', status text not null default 'completed' check (status in ('queued','running','completed','failed','cancelled')),
  cases jsonb not null default '[]'::jsonb, results jsonb not null default '[]'::jsonb, summary jsonb not null default '{}'::jsonb, metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.aax_evaluations add column if not exists suite_key text not null default 'manual';
alter table public.aax_evaluations add column if not exists status text not null default 'completed';
alter table public.aax_evaluations add column if not exists cases jsonb not null default '[]'::jsonb;
alter table public.aax_evaluations add column if not exists started_at timestamptz;
alter table public.aax_evaluations add column if not exists completed_at timestamptz;
alter table public.aax_evaluations add column if not exists updated_at timestamptz not null default now();
create index if not exists aax_evaluations_model_created_idx on public.aax_evaluations(model_id, created_at desc);
create index if not exists aax_evaluations_model_status_idx on public.aax_evaluations(model_id,status,created_at desc);
alter table public.aax_evaluations enable row level security;
drop policy if exists "admins can read aax evaluations" on public.aax_evaluations;
drop policy if exists "admins can create aax evaluations" on public.aax_evaluations;
drop policy if exists aax_evaluations_admin_all on public.aax_evaluations;
create policy aax_evaluations_admin_all on public.aax_evaluations for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter table public.aax_models add column if not exists parent_model_id uuid references public.aax_models(id);
alter table public.aax_models add column if not exists improvements jsonb not null default '[]'::jsonb;
alter table public.aax_models add column if not exists specialization_profile jsonb not null default '{}'::jsonb;
create index if not exists aax_models_parent_idx on public.aax_models(parent_model_id);
alter table public.aax_knowledge_items add column if not exists specialization text;
alter table public.aax_knowledge_items add column if not exists integrated_aax_version integer;
create index if not exists aax_knowledge_items_specialization_idx on public.aax_knowledge_items(model_id,specialization);
alter table public.aax_knowledge_changes add column if not exists target_aax_version integer;
create index if not exists aax_knowledge_changes_target_version_idx on public.aax_knowledge_changes(target_model_id,target_aax_version);
alter table public.aax_training_jobs add column if not exists requested_by uuid references auth.users(id);
alter table public.aax_training_jobs add column if not exists approved_by uuid references auth.users(id);
alter table public.aax_training_jobs add column if not exists approved_at timestamptz;

create or replace function public.activate_due_aax_releases()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
  update public.aax_models set release_status='available', available_at=scheduled_release_at, updated_at=now()
  where release_status in ('scheduled','announced') and scheduled_release_at is not null and scheduled_release_at<=now() and disabled_at is null;
  get diagnostics changed=row_count; return changed;
end; $$;
revoke all on function public.activate_due_aax_releases() from public;
grant execute on function public.activate_due_aax_releases() to service_role;

create or replace function public.get_available_aax_model(p_model_key text)
returns table(id uuid, model_key text, display_name text, generation integer, revision integer, provider text, provider_model text, capabilities text[], specializations text[], context_window integer, output_limit integer, release_status text, available_at timestamptz, config jsonb)
language plpgsql security definer set search_path=public as $$
begin
  update public.aax_models set release_status='available', available_at=scheduled_release_at, updated_at=now()
  where model_key=p_model_key and release_status in ('scheduled','announced') and scheduled_release_at is not null and scheduled_release_at<=now() and disabled_at is null;
  return query select m.id,m.model_key,m.display_name,m.generation,m.revision,m.provider,m.provider_model,m.capabilities,m.specializations,m.context_window,m.output_limit,m.release_status,m.available_at,m.config
  from public.aax_models m where m.model_key=p_model_key and m.release_status='available' and (m.available_at is null or m.available_at<=now()) and m.disabled_at is null limit 1;
end; $$;
revoke all on function public.get_available_aax_model(text) from public;
grant execute on function public.get_available_aax_model(text) to authenticated, service_role;

create or replace function public.compute_aax_usage_cost()
returns trigger language plpgsql security definer set search_path=public as $$
declare cfg jsonb; input_rate numeric; output_rate numeric;
begin
  if new.cost is not null or new.aax_model_id is null then return new; end if;
  select config into cfg from public.aax_models where id=new.aax_model_id;
  input_rate := nullif((cfg->>'input_cost_per_1k')::numeric,0); output_rate := nullif((cfg->>'output_cost_per_1k')::numeric,0);
  if input_rate is not null or output_rate is not null then new.cost := (coalesce(new.tokens_in,0)/1000.0)*coalesce(input_rate,0)+(coalesce(new.tokens_out,0)/1000.0)*coalesce(output_rate,0); end if;
  return new;
exception when others then return new;
end; $$;
drop trigger if exists trg_compute_aax_usage_cost on public.usage_logs;
create trigger trg_compute_aax_usage_cost before insert on public.usage_logs for each row execute function public.compute_aax_usage_cost();
