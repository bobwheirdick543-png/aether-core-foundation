-- has_role is needed by authenticated RLS policies; constrain authenticated callers to their own role lookup.
create or replace function public.has_role(_user_id uuid,_role public.app_role)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role)
    and (auth.uid() is null or auth.uid()=_user_id);
$$;
revoke execute on function public.has_role(uuid,public.app_role) from public,anon;
grant execute on function public.has_role(uuid,public.app_role) to authenticated,service_role;
