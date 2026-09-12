begin;

update public.aax_models
set capabilities = array(select distinct x from unnest(coalesce(capabilities, '{}'::text[]) || array['research']::text[]) as x),
    updated_at = now();

commit;