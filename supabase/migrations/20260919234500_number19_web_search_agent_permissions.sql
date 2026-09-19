-- Number 19 completion: every agent that performs live-web research uses the same
-- server-side Exa capability through the authorized Aether web-search boundary.
-- The credential itself remains EXA_API_KEY on the server and is never persisted here.

insert into public.agent_permissions (agent_id, permission, allowed, requires_approval)
select a.id, 'web.search', true, false
from public.agents a
where a.agent_key in (
  'orchestrator',
  'research',
  'verification',
  'knowledge-acquisition',
  'curator',
  'security'
)
on conflict (agent_id, permission)
do update set
  allowed = excluded.allowed,
  requires_approval = excluded.requires_approval;

comment on table public.agent_permissions is
  'Durable agent permissions. web.search is the centralized live-web capability backed by the server-side Exa integration.';
