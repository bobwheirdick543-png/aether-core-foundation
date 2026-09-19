-- Number 19 alignment correction.
-- Do not change the Number 19 centralized-search architecture; only remove the
-- stale pre-Number-19 registry token that could be mistaken for a second provider.
update public.agents
set tools = array_remove(tools, 'web_search'),
    updated_at = now()
where agent_key in ('research','verification','knowledge-acquisition','curator','security');

insert into public.agent_permissions (agent_id, permission, allowed, requires_approval)
select a.id, 'web.search', true, false
from public.agents a
where a.agent_key in ('research','verification','knowledge-acquisition','curator','security')
on conflict (agent_id, permission)
do update set allowed = true, requires_approval = false;

comment on table public.agents is
  'Canonical durable agent registry. Live web research uses the single centralized web.search capability backed by the server-side Exa provider.';
