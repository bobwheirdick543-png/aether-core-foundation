-- Phase N hardening: activate the orchestrator boundary and grant only its declared execution permission.
insert into public.agent_permissions(agent_id,permission,allowed,requires_approval)
select id,'orchestration.execute',true,false from public.agents where agent_key='orchestrator'
on conflict(agent_id,permission) do update set allowed=excluded.allowed,requires_approval=excluded.requires_approval;
insert into public.agent_permissions(agent_id,permission,allowed,requires_approval)
select id,'orchestration.execute',true,false from public.agents where agent_key in ('research','verification','knowledge-acquisition','curator','report','notification','security','optimization','module')
on conflict(agent_id,permission) do update set allowed=excluded.allowed,requires_approval=excluded.requires_approval;
update public.agents set status='enabled',updated_at=now() where agent_key='orchestrator' and status='disabled';
