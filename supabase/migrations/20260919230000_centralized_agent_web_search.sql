-- Number 19: one shared web-search capability for every agent that requires live web research.
-- The provider credential remains server-side in EXA_API_KEY; agents never receive the key.
insert into public.agent_permissions (agent_id, permission, allowed, requires_approval)
select a.id, 'web.search', true, false
from public.agents a
where a.agent_key in ('orchestrator','research','verification','knowledge-acquisition')
on conflict (agent_id, permission)
do update set allowed = excluded.allowed, requires_approval = excluded.requires_approval;

comment on table public.agent_permissions is 'Durable agent permissions. web.search is the centralized live-web capability backed by the server-side Exa integration.';
