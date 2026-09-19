-- Number 19 correction: the orchestrator coordinates web-capable agents but does not
-- perform direct web search itself. Remove the stale permission/tool grant from the
-- earlier centralized-search migrations. All specialist agents that expose web.search
-- keep the same permission and server-side Exa provider.

delete from public.agent_permissions ap
using public.agents a
where ap.agent_id = a.id
  and a.agent_key = 'orchestrator'
  and ap.permission = 'web.search';

update public.agents
set tools = array_remove(tools, 'web.search'),
    updated_at = now()
where agent_key = 'orchestrator';

insert into public.agent_permissions (agent_id, permission, allowed, requires_approval)
select a.id, 'web.search', true, false
from public.agents a
where a.agent_key in ('research','verification','knowledge-acquisition','curator','security')
on conflict (agent_id, permission)
do update set
  allowed = excluded.allowed,
  requires_approval = excluded.requires_approval;

update public.agents
set tools = case
  when 'web.search' = any(tools) then tools
  else array_append(tools, 'web.search')
end,
updated_at = now()
where agent_key in ('research','verification','knowledge-acquisition','curator','security');

comment on table public.agent_permissions is
  'Durable agent permissions. web.search is the single live-web capability backed by the server-side Exa integration; the orchestrator only coordinates specialists.';
