alter table public.aax_training_jobs add column if not exists current_stage text not null default 'queued';
alter table public.aax_training_jobs add column if not exists completed_agents text[] not null default '{}';
alter table public.aax_training_jobs add column if not exists target_self_analysis jsonb;
alter table public.aax_training_jobs add column if not exists report_delivery jsonb not null default '{}'::jsonb;
alter table public.aax_training_jobs add column if not exists last_event_at timestamptz;
alter table public.aax_training_jobs add column if not exists collective_package jsonb;
alter table public.aax_training_jobs add column if not exists report_id uuid references public.reports(id) on delete set null;
create index if not exists aax_training_jobs_stage_idx on public.aax_training_jobs(current_stage, updated_at desc);
