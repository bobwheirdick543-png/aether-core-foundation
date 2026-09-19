begin;

alter table public.tasks add column if not exists execution_ended_at timestamptz;
alter table public.task_runs add column if not exists execution_ended_at timestamptz;

create index if not exists tasks_execution_ended_idx
  on public.tasks(execution_ended_at)
  where execution_ended_at is not null;

create index if not exists task_runs_execution_ended_idx
  on public.task_runs(execution_ended_at)
  where execution_ended_at is not null;

commit;
