create table if not exists public.verification_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, research_session_id uuid references public.aether_research_sessions(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null, run_id uuid references public.task_runs(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled','waiting_review')),
  verifier_version text not null default 'g1.0.0', summary text, metrics jsonb not null default '{}'::jsonb, error text,
  idempotency_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
  unique(owner_id,idempotency_key)
);
create table if not exists public.verification_claims (
  id uuid primary key default gen_random_uuid(), verification_run_id uuid not null references public.verification_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, claim text not null, normalized_claim text not null,
  verification_state text not null default 'pending' check (verification_state in ('verified','needs_review','conflicting','unsupported','outdated','rejected','pending')),
  confidence numeric not null default 0 check (confidence between 0 and 1), evidence_strength numeric not null default 0 check (evidence_strength between 0 and 1),
  authority_score numeric not null default 0 check (authority_score between 0 and 1), freshness_score numeric not null default 0 check (freshness_score between 0 and 1),
  uncertainty jsonb not null default '[]'::jsonb, contradiction_count integer not null default 0 check (contradiction_count >= 0), date_mismatch_count integer not null default 0 check (date_mismatch_count >= 0),
  missing_evidence boolean not null default true, requires_review boolean not null default true, review_reason text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.verification_evidence (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.verification_claims(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, source_id uuid references public.aether_research_sources(id) on delete set null,
  source_url text, source_title text, excerpt text not null, supports_claim boolean not null,
  evidence_strength numeric not null default 0 check (evidence_strength between 0 and 1), authority_score numeric not null default 0 check (authority_score between 0 and 1),
  freshness_score numeric not null default 0 check (freshness_score between 0 and 1), published_at timestamptz, retrieved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.verification_decisions (
  id uuid primary key default gen_random_uuid(), claim_id uuid not null references public.verification_claims(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, actor_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('accept','needs_review','reject','reverify')), previous_state text not null, new_state text not null,
  reason text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists verification_runs_owner_created_idx on public.verification_runs(owner_id,created_at desc);
create index if not exists verification_runs_project_idx on public.verification_runs(project_id,created_at desc);
create index if not exists verification_claims_run_idx on public.verification_claims(verification_run_id,created_at);
create index if not exists verification_claims_owner_state_idx on public.verification_claims(owner_id,verification_state);
create index if not exists verification_evidence_claim_idx on public.verification_evidence(claim_id,created_at);
create index if not exists verification_evidence_source_idx on public.verification_evidence(source_id);
create index if not exists verification_decisions_claim_idx on public.verification_decisions(claim_id,created_at desc);
alter table public.verification_runs enable row level security;
alter table public.verification_claims enable row level security;
alter table public.verification_evidence enable row level security;
alter table public.verification_decisions enable row level security;
drop policy if exists verification_runs_owner_select on public.verification_runs;
drop policy if exists verification_runs_owner_insert on public.verification_runs;
drop policy if exists verification_runs_owner_update on public.verification_runs;
create policy verification_runs_owner_select on public.verification_runs for select using (owner_id = auth.uid());
create policy verification_runs_owner_insert on public.verification_runs for insert with check (owner_id = auth.uid());
create policy verification_runs_owner_update on public.verification_runs for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists verification_claims_owner_select on public.verification_claims;
drop policy if exists verification_claims_owner_insert on public.verification_claims;
drop policy if exists verification_claims_owner_update on public.verification_claims;
create policy verification_claims_owner_select on public.verification_claims for select using (owner_id = auth.uid());
create policy verification_claims_owner_insert on public.verification_claims for insert with check (owner_id = auth.uid());
create policy verification_claims_owner_update on public.verification_claims for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists verification_evidence_owner_select on public.verification_evidence;
drop policy if exists verification_evidence_owner_insert on public.verification_evidence;
create policy verification_evidence_owner_select on public.verification_evidence for select using (owner_id = auth.uid());
create policy verification_evidence_owner_insert on public.verification_evidence for insert with check (owner_id = auth.uid());
drop policy if exists verification_decisions_owner_select on public.verification_decisions;
drop policy if exists verification_decisions_owner_insert on public.verification_decisions;
create policy verification_decisions_owner_select on public.verification_decisions for select using (owner_id = auth.uid());
create policy verification_decisions_owner_insert on public.verification_decisions for insert with check (owner_id = auth.uid());
create or replace function public.set_verification_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists verification_runs_updated_at on public.verification_runs;
create trigger verification_runs_updated_at before update on public.verification_runs for each row execute function public.set_verification_updated_at();
drop trigger if exists verification_claims_updated_at on public.verification_claims;
create trigger verification_claims_updated_at before update on public.verification_claims for each row execute function public.set_verification_updated_at();
