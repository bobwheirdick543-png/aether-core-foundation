begin;

create or replace function public.notify_knowledge_acquisition_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_recipient uuid;
  v_notification_id uuid;
  v_link text := '/admin/knowledge-acquisition';
  v_subject text := format('Knowledge acquisition awaiting verification: %s', new.subject);
  v_body text := format('The bounded research mission completed at %s%% of its defined scope. Nothing has been globally distributed. Review and approve or reject the candidate.', round(new.coverage * 100));
  v_admin record;
  v_email text;
begin
  if new.status <> 'waiting_approval' or old.status = 'waiting_approval' then return new; end if;
  for v_recipient in select new.owner_id union select ur.user_id from public.user_roles ur where ur.role='admin'::public.app_role loop
    insert into public.notifications(recipient_id,audience,event_type,title,body,resource_type,resource_id,link,status,idempotency_key,metadata)
    values(v_recipient,case when v_recipient=new.owner_id then 'user' else 'admin' end,'knowledge_acquisition.awaiting_approval',v_subject,v_body,'knowledge_acquisition',new.candidate_id,v_link,'pending',format('ka-approval:%s:%s',new.id,v_recipient),jsonb_build_object('acquisitionJobId',new.id,'candidateId',new.candidate_id,'reportIds',new.report_ids,'reportPending',coalesce(cardinality(new.report_ids),0)=0))
    on conflict (recipient_id,idempotency_key) do nothing
    returning id into v_notification_id;
    if v_notification_id is not null then
      insert into public.notification_deliveries(notification_id,channel,destination,status,attempts,idempotency_key,next_attempt_at)
      values(v_notification_id,'in_app',v_recipient::text,'pending',0,format('notification:%s:in_app',v_notification_id),now())
      on conflict do nothing;
      select np.email_address into v_email from public.notification_preferences np where np.user_id=v_recipient and np.email_enabled=true limit 1;
      if v_email is null then select au.email into v_email from auth.users au where au.id=v_recipient limit 1; end if;
      if v_email is not null and length(trim(v_email))>3 then
        insert into public.notification_deliveries(notification_id,channel,destination,status,attempts,idempotency_key,next_attempt_at)
        values(v_notification_id,'email',lower(trim(v_email)),'pending',0,format('notification:%s:email',v_notification_id),now())
        on conflict do nothing;
      end if;
    end if;
  end loop;
  return new;
end;
$function$;

drop trigger if exists knowledge_acquisition_approval_notification on public.aether_knowledge_acquisition_jobs;
create trigger knowledge_acquisition_approval_notification
after update of status on public.aether_knowledge_acquisition_jobs
for each row execute function public.notify_knowledge_acquisition_approval();

revoke all on function public.notify_knowledge_acquisition_approval() from public,anon,authenticated;
grant execute on function public.notify_knowledge_acquisition_approval() to service_role;

insert into supabase_migrations.schema_migrations(version,statements,name,created_by,idempotency_key,rollback)
select '20260912172500',array['approval-state transition creates durable in-app notification','email delivery is queued when configured or auth email is available','notification metadata records whether PDF report ids are ready'],'knowledge_acquisition_notifications','bobwheirdick543@gmail.com',null,array[]::text[]
where not exists(select 1 from supabase_migrations.schema_migrations where version='20260912172500');

commit;