-- Make the admin/user AAX API-key distinction persistent and explicit.
-- The existing api_kind remains "aax" so the external AAX authentication contract is unchanged.
update public.aether_api_keys
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{principalType}',
  to_jsonb(case
    when exists (
      select 1 from public.user_roles ur
      where ur.user_id = public.aether_api_keys.owner_id
        and ur.role = 'admin'
    ) then 'admin'
    else 'user'
  end),
  true
)
where api_kind = 'aax';

create index if not exists idx_aether_api_keys_aax_principal_type
  on public.aether_api_keys ((metadata->>'principalType'))
  where api_kind = 'aax';
