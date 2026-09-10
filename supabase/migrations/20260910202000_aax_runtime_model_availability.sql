create or replace function public.get_available_aax_model(p_model_key text)
returns table (
  id uuid,
  model_key text,
  display_name text,
  generation integer,
  revision integer,
  provider text,
  provider_model text,
  capabilities text[],
  specializations text[],
  context_window integer,
  output_limit integer,
  release_status text,
  available_at timestamptz,
  config jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    m.id, m.model_key, m.display_name, m.generation, m.revision,
    m.provider, m.provider_model, m.capabilities, m.specializations,
    m.context_window, m.output_limit, m.release_status, m.available_at, m.config
  from public.aax_models m
  where m.model_key = p_model_key
    and m.release_status = 'available'
    and (m.available_at is null or m.available_at <= now())
    and m.disabled_at is null
  limit 1;
$$;

revoke all on function public.get_available_aax_model(text) from public;
grant execute on function public.get_available_aax_model(text) to authenticated, service_role;

create index if not exists idx_aax_models_runtime_availability
  on public.aax_models (model_key, release_status, available_at)
  where disabled_at is null;
