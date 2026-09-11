-- Phase O policy regex hardening. Stored PostgreSQL regexes use a single escape for literal dots.
update public.security_policies set action_pattern='^(roles\.|permissions\.|security\.policy\.).*',updated_at=now() where policy_key='phase-o.roles-deny';
update public.security_policies set action_pattern='^(secrets\.|credentials\.).*',updated_at=now() where policy_key='phase-o.secrets-approval';
update public.security_policies set action_pattern='^(data\.export|knowledge\.publish|knowledge\.rollback).*',updated_at=now() where policy_key='phase-o.data-export-approval';
update public.security_policies set action_pattern='^agent\.(activate|disable|rollback|version\.).*',updated_at=now() where policy_key='phase-o.agent-lifecycle-approval';
update public.security_policies set action_pattern='^(audit\.delete|audit\.purge|security\.event\.delete).*',updated_at=now() where policy_key='phase-o.audit-deny';
update public.security_policies set action_pattern='^sandbox\.(open|close|inspect).*',updated_at=now() where policy_key='phase-o.sandbox-allow';
