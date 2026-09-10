alter table public.task_runs
  add column if not exists aax_model_id uuid references public.aax_models(id) on delete set null;

create index if not exists idx_task_runs_aax_model_id on public.task_runs(aax_model_id);

alter table public.usage_logs
  add column if not exists aax_model_id uuid references public.aax_models(id) on delete set null,
  add column if not exists provider text,
  add column if not exists provider_model text,
  add column if not exists status text,
  add column if not exists task_id uuid references public.tasks(id) on delete set null,
  add column if not exists run_id uuid references public.task_runs(id) on delete set null,
  add column if not exists cost numeric;

create index if not exists idx_usage_logs_aax_model_created
  on public.usage_logs(aax_model_id, created_at desc);
