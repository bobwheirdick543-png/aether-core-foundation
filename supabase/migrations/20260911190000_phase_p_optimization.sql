create table if not exists public.optimization_scans (
 id uuid primary key default gen_random_uuid(),
 requested_by uuid references auth.users(id) on delete set null,
 scope text not null default 'platform',
 window_start timestamptz not null,
 window_end timestamptz not null,
 status text not null default 'queued' check (status in ('queued','running','completed','failed')),
 telemetry_snapshot jsonb not null default '{}'::jsonb,
 metrics jsonb not null default '{}'::jsonb,
 recommendation_count integer not null default 0,
 error_message text,
 idempotency_key text not null unique,
 started_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (window_end > window_start)
);
create table if not exists public.optimization_recommendations (
 id uuid primary key default gen_random_uuid(),
 scan_id uuid not null references public.optimization_scans(id) on delete cascade,
 agent_key text,
 category text not null check (category in ('latency','failures','retries','resources','workflow','config')),
 title text not null,
 description text not null,
 evidence jsonb not null default '{}'::jsonb,
 suggested_change jsonb not null default '{}'::jsonb,
 severity text not null check (severity in ('low','medium','high')),
 status text not null default 'pending' check (status in ('pending','approved','rejected','applied','rolled_back')),
 fingerprint text not null,
 decided_by uuid references auth.users(id) on delete set null,
 decided_at timestamptz,
 decision_reason text,
 applied_at timestamptz,
 rolled_back_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(scan_id,fingerprint)
);
create table if not exists public.optimization_actions (
 id uuid primary key default gen_random_uuid(),
 recommendation_id uuid not null references public.optimization_recommendations(id) on delete cascade,
 action_type text not null check (action_type in ('apply','rollback')),
 status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
 idempotency_key text not null unique,
 requested_by uuid references auth.users(id) on delete set null,
 before_version_id uuid references public.agent_versions(id) on delete set null,
 after_version_id uuid references public.agent_versions(id) on delete set null,
 before_state jsonb not null default '{}'::jsonb,
 after_state jsonb not null default '{}'::jsonb,
 error_message text,
 created_at timestamptz not null default now(),
 started_at timestamptz,
 completed_at timestamptz
);
create index if not exists optimization_scans_status_created_idx on public.optimization_scans(status,created_at desc);
create index if not exists optimization_recommendations_status_idx on public.optimization_recommendations(status,created_at desc);
create index if not exists optimization_recommendations_scan_idx on public.optimization_recommendations(scan_id);
create index if not exists optimization_actions_recommendation_idx on public.optimization_actions(recommendation_id,created_at desc);
alter table public.optimization_scans enable row level security;
alter table public.optimization_recommendations enable row level security;
alter table public.optimization_actions enable row level security;
drop policy if exists optimization_scans_admin_select on public.optimization_scans;
create policy optimization_scans_admin_select on public.optimization_scans for select to authenticated using (public.has_role(auth.uid(),'admin'));
drop policy if exists optimization_recommendations_admin_select on public.optimization_recommendations;
create policy optimization_recommendations_admin_select on public.optimization_recommendations for select to authenticated using (public.has_role(auth.uid(),'admin'));
drop policy if exists optimization_actions_admin_select on public.optimization_actions;
create policy optimization_actions_admin_select on public.optimization_actions for select to authenticated using (public.has_role(auth.uid(),'admin'));
revoke insert,update,delete on public.optimization_scans from anon,authenticated;
revoke insert,update,delete on public.optimization_recommendations from anon,authenticated;
revoke insert,update,delete on public.optimization_actions from anon,authenticated;
do $$
begin
 if exists (select 1 from public.agents where agent_key='optimization') then
   update public.agents set status='enabled',description='Analyses real performance telemetry and produces governed optimization recommendations with durable approval and rollback.' where agent_key='optimization';
   insert into public.agent_permissions(agent_id,permission,allowed,requires_approval) select id,'optimization.scan',true,false from public.agents where agent_key='optimization' on conflict (agent_id,permission) do update set allowed=true,requires_approval=false;
   insert into public.agent_permissions(agent_id,permission,allowed,requires_approval) select id,'optimization.recommend',true,false from public.agents where agent_key='optimization' on conflict (agent_id,permission) do update set allowed=true,requires_approval=false;
   insert into public.agent_permissions(agent_id,permission,allowed,requires_approval) select id,'optimization.apply',true,true from public.agents where agent_key='optimization' on conflict (agent_id,permission) do update set allowed=true,requires_approval=true;
   insert into public.agent_permissions(agent_id,permission,allowed,requires_approval) select id,'optimization.rollback',true,true from public.agents where agent_key='optimization' on conflict (agent_id,permission) do update set allowed=true,requires_approval=true;
 end if;
end $$;
insert into public.security_policies(policy_key,version,status,priority,action_pattern,resource_type_pattern,effect,severity,conditions,description)
values ('phase-p-optimization-apply',1,'active',70,'^optimization\\.apply$','^agent$','allow','high','{"requires_admin":true}'::jsonb,'Phase P changes require an approved durable recommendation and administrator execution.') on conflict do nothing;
insert into public.security_policies(policy_key,version,status,priority,action_pattern,resource_type_pattern,effect,severity,conditions,description)
values ('phase-p-optimization-rollback',1,'active',70,'^optimization\\.rollback$','^agent$','allow','high','{"requires_admin":true}'::jsonb,'Phase P rollback requires administrator execution.') on conflict do nothing;
