-- Reconcile the persistent AAX catalogue with the canonical Ascension generations.
-- This is idempotent: existing administrator configuration is preserved.
insert into public.aax_models
  (model_key, display_name, generation, revision, description, capabilities, context_window, output_limit, release_status)
values
  ('aax-1.0','Aether Ascension 1.0',1,0,'Aether Ascension first generation.','{reasoning,conversation,knowledge,tools}',128000,4096,'draft'),
  ('aax-2.0','Aether Ascension 2.0',2,0,'Aether Ascension second generation.','{reasoning,conversation,knowledge,tools,structured-output}',128000,4096,'draft'),
  ('aax-3.1','Aether Ascension 3.1',3,1,'Aether Ascension third generation revision one.','{reasoning,conversation,research,tools,vision,knowledge,structured-output,multimodal}',128000,4096,'draft'),
  ('aax-4.0','Aether Ascension 4.0',4,0,'Aether Ascension fourth generation.','{reasoning,conversation,knowledge,tools,structured-output,vision,multimodal,long-context}',128000,4096,'draft'),
  ('aax-5.1','Aether Ascension 5.1',5,1,'Aether Ascension fifth generation revision one.','{reasoning,conversation,knowledge,tools,structured-output,vision,multimodal,long-context,advanced-reasoning}',128000,4096,'draft')
on conflict (model_key) do nothing;

insert into public.ai_stat_current(entity_type, entity_id, metric_key, value)
select 'aax_model', m.id, metric, 0
from public.aax_models m
cross join unnest(array[
  'intelligence','speed','response_time','accuracy','reasoning_quality','knowledge_depth',
  'problem_solving','adaptability','learning_rate','reliability','tool_proficiency',
  'context_retention','instruction_following','research_quality','verification_strength',
  'knowledge_connectivity','communication_quality','overall'
]) metric
on conflict (entity_type, entity_id, metric_key) do nothing;

create index if not exists idx_aax_models_global_available
  on public.aax_models (release_status, available_at, generation desc, revision desc)
  where disabled_at is null;

-- Existing rows created by the original catalogue migration may have nullable output limits; reconcile them to the canonical UI default.
update public.aax_models set output_limit = 4096, updated_at = now() where output_limit is null;
