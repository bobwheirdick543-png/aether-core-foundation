-- Prevent AAX models from being marked available without a real provider mapping.
create or replace function public.aax_models_release_guard()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if new.release_status='available' and new.disabled_at is null and (nullif(trim(new.provider),'') is null or nullif(trim(new.provider_model),'') is null) then
    raise exception 'AAX model cannot be released as available without a real provider and provider_model mapping';
  end if;
  return new;
end;
$$;
revoke execute on function public.aax_models_release_guard() from public,anon,authenticated;
drop trigger if exists trg_aax_models_release_guard on public.aax_models;
create trigger trg_aax_models_release_guard before insert or update of release_status,provider,provider_model,disabled_at on public.aax_models for each row execute function public.aax_models_release_guard();
