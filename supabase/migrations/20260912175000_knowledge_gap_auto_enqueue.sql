create extension if not exists pgcrypto;

create or replace function public.enqueue_knowledge_gap_from_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
  subject text;
  scope jsonb;
  dedupe text;
  existing_count integer;
  recent_owner_count integer;
  task_id uuid;
  run_id uuid;
  job_id uuid;
  now_ts timestamptz := now();
begin
  if new.role <> 'user' then return new; end if;
  normalized := regexp_replace(lower(trim(coalesce(new.content,''))), '\s+', ' ', 'g');
  if length(normalized) < 24 then return new; end if;
  if normalized !~ '(what is|who is|how does|how do|why does|why is|explain|tell me about|research|look up|learn about|everything about|latest|current|compare|difference between|meaning of|define|documentation|docs|how to)' then
    return new;
  end if;
  if coalesce(new.metadata->>'backgroundKnowledgeGap','') = 'true' then return new; end if;
  select count(*) into recent_owner_count
  from public.aether_knowledge_acquisition_jobs
  where owner_id = new.owner_id and created_at > now_ts - interval '15 minutes'
    and status in ('queued','running','paused','waiting_approval');
  if recent_owner_count >= 3 then return new; end if;
  subject := left(regexp_replace(trim(new.content), '\s+', ' ', 'g'), 300);
  dedupe := 'chat-gap:' || encode(digest(lower(subject), 'sha256'), 'hex');
  select count(*) into existing_count
  from public.aether_knowledge_acquisition_jobs
  where dedupe_key = dedupe and status in ('queued','running','paused','waiting_approval');
  if existing_count > 0 then return new; end if;
  scope := jsonb_build_object(
    'core', jsonb_build_array(subject || ' identity and defining characteristics', subject || ' major facts and developments'),
    'essentialContext', jsonb_build_array(subject || ' essential context required to answer the request'),
    'relevantRelationships', jsonb_build_array(subject || ' directly relevant relationships or comparisons'),
    'terminology', jsonb_build_array('terminology needed to understand ' || subject),
    'verification', jsonb_build_array('cross-source agreement, dates, source quality and unresolved claims'),
    'exclusions', jsonb_build_array('unrelated domains','recursive expansion not necessary to answer the request')
  );
  insert into public.tasks(user_id, project_id, title, kind, status, priority, timeout_ms, detail, idempotency_key)
  values(new.owner_id, null, 'Knowledge gap: ' || left(subject, 120), 'knowledge-acquisition', 'queued', 10, 900000,
    jsonb_build_object('subject', subject, 'scope', scope, 'depth_tier','A','time_budget_ms',900000,'target_type','global','target_model_keys','{}','source_type','background','trigger','background_knowledge_gap','origin_message_id',new.id), dedupe)
  returning id into task_id;
  insert into public.task_runs(task_id, owner_id, agent_key, inputs, timeout_ms, idempotency_key)
  values(task_id, new.owner_id, 'knowledge-acquisition', jsonb_build_object('subject',subject,'scope',scope,'target_type','global','origin_message_id',new.id), 900000, dedupe || ':run')
  returning id into run_id;
  insert into public.aether_knowledge_acquisition_jobs(task_id, run_id, owner_id, title, subject, scope, depth_tier, time_budget_ms, target_type, source_type, dedupe_key, status, last_event_at)
  values(task_id, run_id, new.owner_id, 'Knowledge gap: ' || left(subject,120), subject, scope, 'A', 900000, 'global', 'background', dedupe, 'queued', now_ts)
  returning id into job_id;
  perform public.append_task_event(task_id, run_id, 'knowledge_acquisition.queued', null, 'queued', 'Automatic bounded knowledge-gap acquisition queued', jsonb_build_object('job_id',job_id,'origin_message_id',new.id,'trigger','background_knowledge_gap'), null);
  return new;
exception when others then
  raise warning 'knowledge gap enqueue skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.enqueue_knowledge_gap_from_chat_message() from public, anon, authenticated;
grant execute on function public.enqueue_knowledge_gap_from_chat_message() to postgres, service_role;

drop trigger if exists trg_aax_message_knowledge_gap on public.aax_conversation_messages;
create trigger trg_aax_message_knowledge_gap
after insert on public.aax_conversation_messages
for each row execute function public.enqueue_knowledge_gap_from_chat_message();