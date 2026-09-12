begin;

create or replace function public.attach_knowledge_acquisition_report_to_pending_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job_id text := coalesce(new.metadata->>'acquisitionJobId','');
  v_candidate_id text := coalesce(new.metadata->>'candidateId','');
  v_report jsonb := jsonb_build_object(
    'reportId', new.id,
    'reportPending', false,
    'attachment', jsonb_build_object(
      'bucket', 'aether-reports',
      'path', new.metadata->>'reportPath',
      'contentType', 'application/pdf',
      'filename', concat('aether-knowledge-', v_job_id, '.pdf')
    )
  );
begin
  if v_job_id = '' then return new; end if;
  update public.notifications
     set metadata = coalesce(metadata,'{}'::jsonb) || v_report,
         body = case when position('PDF report is ready' in body) > 0 then body else body || ' The PDF report is ready for review.' end,
         updated_at = now()
   where event_type = 'knowledge_acquisition.awaiting_approval'
     and status = 'pending'
     and metadata->>'acquisitionJobId' = v_job_id
     and (v_candidate_id = '' or resource_id::text = v_candidate_id);
  return new;
end;
$function$;

revoke all on function public.attach_knowledge_acquisition_report_to_pending_notifications() from public, anon, authenticated;

drop trigger if exists trg_attach_knowledge_acquisition_report on public.reports;
create trigger trg_attach_knowledge_acquisition_report
after insert on public.reports
for each row execute function public.attach_knowledge_acquisition_report_to_pending_notifications();

insert into supabase_migrations.schema_migrations(version,statements,name,created_by,idempotency_key,rollback)
select '20260912173500',array['attach acquisition report metadata and PDF attachment to pending approval notifications'],'knowledge_acquisition_report_notification_attachment','bobwheirdick543@gmail.com',null,array[]::text[]
where not exists(select 1 from supabase_migrations.schema_migrations where version='20260912173500');

commit;
