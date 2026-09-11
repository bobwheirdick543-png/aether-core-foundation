create or replace function public.set_verification_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;

drop policy if exists verification_runs_owner_insert on public.verification_runs;
drop policy if exists verification_runs_owner_update on public.verification_runs;
drop policy if exists verification_claims_owner_insert on public.verification_claims;
drop policy if exists verification_claims_owner_update on public.verification_claims;
drop policy if exists verification_evidence_owner_insert on public.verification_evidence;
drop policy if exists verification_decisions_owner_insert on public.verification_decisions;
comment on table public.verification_runs is 'Phase G durable verification runs. Client access is read-only; server runtime owns writes.';
comment on table public.verification_claims is 'Phase G structured claims and verification states. Client access is read-only; server runtime owns writes.';
comment on table public.verification_evidence is 'Phase G source-linked evidence. Client access is read-only; server runtime owns writes.';
comment on table public.verification_decisions is 'Phase G auditable review decisions. Client access is read-only; server runtime owns writes.';
