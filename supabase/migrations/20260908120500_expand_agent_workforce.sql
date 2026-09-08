-- Expand internal AI Team to the full initial workforce (architecture only).
-- All agents start disabled. No fabricated telemetry.

INSERT INTO public.agents (agent_key, name, description, purpose, status, tools)
VALUES
  ('orchestrator', 'Orchestrator Agent', 'Coordinates multi-agent workflows and routes work to specialists.', 'Decide which agents run, in what order, and under which constraints.', 'disabled', ARRAY['task.route','workflow.compose','run.track']),
  ('knowledge-acquisition', 'Knowledge Acquisition Agent', 'Ingests external material and produces candidate knowledge packages.', 'Turn external sources into structured candidates for review.', 'disabled', ARRAY['source.parse','claims.extract','knowledge.compare']),
  ('notification', 'Notification & Delivery Agent', 'Delivers in-app and email notifications with explicit ownership.', 'Notify the correct recipient about real events only.', 'disabled', ARRAY['notify.create','notify.deliver']),
  ('security', 'Security & Compliance Agent', 'Monitors permission boundaries and policy violations.', 'Detect and flag violations; backend authorization remains authoritative.', 'disabled', ARRAY['security.inspect','violations.flag']),
  ('optimization', 'Optimization Agent', 'Analyses real performance telemetry and recommends improvements.', 'Recommend changes; administrator must approve controlled updates.', 'disabled', ARRAY['telemetry.read','recommendations.write'])
ON CONFLICT (agent_key) DO NOTHING;

-- Baseline least-privilege permissions for new agents
INSERT INTO public.agent_permissions (agent_id, permission, allowed, requires_approval)
SELECT a.id, p.permission, p.allowed, p.requires_approval
FROM public.agents a
JOIN (VALUES
  ('orchestrator', 'tasks.route', true, false),
  ('orchestrator', 'workflows.compose', true, false),
  ('orchestrator', 'knowledge.publish', false, false),
  ('orchestrator', 'roles.modify', false, false),
  ('knowledge-acquisition', 'sources.ingest', true, false),
  ('knowledge-acquisition', 'candidates.write', true, false),
  ('knowledge-acquisition', 'knowledge.publish', false, false),
  ('notification', 'notifications.create', true, false),
  ('notification', 'notifications.deliver', true, false),
  ('notification', 'knowledge.modify', false, false),
  ('notification', 'roles.modify', false, false),
  ('security', 'security.inspect', true, false),
  ('security', 'violations.flag', true, false),
  ('security', 'audit.delete', false, false),
  ('security', 'permissions.self_modify', false, false),
  ('optimization', 'telemetry.read', true, false),
  ('optimization', 'recommendations.write', true, false),
  ('optimization', 'config.auto_apply', false, false)
) AS p(agent_key, permission, allowed, requires_approval)
  ON p.agent_key = a.agent_key
ON CONFLICT (agent_id, permission) DO NOTHING;
