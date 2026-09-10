create index if not exists aax_training_jobs_target_status_created_idx
  on public.aax_training_jobs (target_model_id, pipeline_status, created_at desc);

create index if not exists aax_knowledge_events_job_created_idx
  on public.aax_knowledge_events (training_job_id, created_at asc);
