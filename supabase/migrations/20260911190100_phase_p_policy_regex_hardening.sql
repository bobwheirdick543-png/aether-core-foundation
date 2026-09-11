update public.security_policies set action_pattern='^optimization\.apply$' where policy_key='phase-p-optimization-apply';
update public.security_policies set action_pattern='^optimization\.rollback$' where policy_key='phase-p-optimization-rollback';
