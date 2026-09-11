-- Phase M hardening: every agent execution is subject to the central runtime permission boundary.
insert into public.agent_permissions(agent_id,permission,allowed,requires_approval) select id,'agent.execute',true,false from public.agents on conflict(agent_id,permission) do nothing;
