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

-- Keep the durable registry/tool contract synchronized with the permission boundary.
update public.agents
set tools = case
  when 'web.search' = any(tools) then tools
  else array_append(tools, 'web.search')
end,
updated_at = now()
where agent_key in ('orchestrator','research','verification','knowledge-acquisition','curator','security');

update public.agents
set tools = array_remove(tools, 'web.search'),
    updated_at = now()
where agent_key = 'orchestrator';

-- Active operational versions must describe the same tool surface as the registry.
update public.agent_versions av
set definition = jsonb_set(
                  jsonb_set(av.definition, '{tools}', to_jsonb(a.tools), true),
                  '{responsibilities}', to_jsonb(a.tools), true
                ),
    config_hash = md5(
      jsonb_set(
        jsonb_set(av.definition, '{tools}', to_jsonb(a.tools), true),
        '{responsibilities}', to_jsonb(a.tools), true
      )::text
    )
from public.agents a
where av.agent_id = a.id
  and av.lifecycle_state in ('active','tested','validated','maintenance')
  and a.agent_key in ('research','verification','knowledge-acquisition','curator','security');

