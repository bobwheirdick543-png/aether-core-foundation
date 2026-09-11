-- Phase J: activate the bounded Report/PDF Agent in the persistent registry.
UPDATE public.agents
SET status='enabled',
    tools=ARRAY['verified.read','pdf.generate','archive.write','report.download.authorize'],
    config=jsonb_build_object('phase','J','provider_independent',true,'production_knowledge_write',false),
    updated_at=now()
WHERE agent_key='report';

INSERT INTO public.agent_permissions (agent_id,permission,allowed,requires_approval)
SELECT id,'reports.archive',true,false FROM public.agents WHERE agent_key='report'
ON CONFLICT (agent_id,permission) DO UPDATE SET allowed=true,requires_approval=false;
INSERT INTO public.agent_permissions (agent_id,permission,allowed,requires_approval)
SELECT id,'reports.download',true,false FROM public.agents WHERE agent_key='report'
ON CONFLICT (agent_id,permission) DO UPDATE SET allowed=true,requires_approval=false;
INSERT INTO public.agent_permissions (agent_id,permission,allowed,requires_approval)
SELECT id,'knowledge.publish',false,false FROM public.agents WHERE agent_key='report'
ON CONFLICT (agent_id,permission) DO UPDATE SET allowed=false,requires_approval=false;
