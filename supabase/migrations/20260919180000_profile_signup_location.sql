-- Persist signup location and timezone metadata for new Aether accounts.
-- Country/state are profile data; timezone is a display aid and never replaces
-- the browser/device timezone fallback used by notification rendering.

alter table public.profiles
  add column if not exists country_code text,
  add column if not exists country_name text,
  add column if not exists state_code text,
  add column if not exists state_name text,
  add column if not exists timezone text;

create index if not exists idx_profiles_country_code on public.profiles(country_code);
create index if not exists idx_profiles_state_code on public.profiles(state_code);

create or replace function public.sync_signup_location_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id,
    display_name,
    country_code,
    country_name,
    state_code,
    state_name,
    timezone
  )
  values (
    new.id,
    nullif(trim(coalesce(m->>'display_name','')), ''),
    nullif(trim(coalesce(m->>'country_code','')), ''),
    nullif(trim(coalesce(m->>'country_name','')), ''),
    nullif(trim(coalesce(m->>'state_code','')), ''),
    nullif(trim(coalesce(m->>'state_name','')), ''),
    nullif(trim(coalesce(m->>'timezone','')), '')
  )
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    country_code = coalesce(excluded.country_code, public.profiles.country_code),
    country_name = coalesce(excluded.country_name, public.profiles.country_name),
    state_code = coalesce(excluded.state_code, public.profiles.state_code),
    state_name = coalesce(excluded.state_name, public.profiles.state_name),
    timezone = coalesce(excluded.timezone, public.profiles.timezone);

  return new;
end;
$$;

drop trigger if exists trg_sync_signup_location_to_profile on auth.users;

create trigger trg_sync_signup_location_to_profile
after insert on auth.users
for each row
execute function public.sync_signup_location_to_profile();
