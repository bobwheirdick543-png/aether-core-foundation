CREATE OR REPLACE FUNCTION public.replace_aether_memory(p_memory_id UUID, p_actor_id UUID, p_content TEXT, p_reason TEXT DEFAULT '', p_confidence NUMERIC DEFAULT NULL, p_importance NUMERIC DEFAULT 0.5, p_memory_type TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_memory public.aether_memories%ROWTYPE; new_memory UUID;
BEGIN
  IF char_length(trim(p_content)) < 1 OR char_length(trim(p_content)) > 12000 THEN RAISE EXCEPTION 'Memory content must be between 1 and 12000 characters'; END IF;
  SELECT * INTO old_memory FROM public.aether_memories WHERE id = p_memory_id FOR UPDATE;
  IF NOT FOUND OR old_memory.owner_id <> p_actor_id OR old_memory.status <> 'active' THEN RAISE EXCEPTION 'Memory is unavailable'; END IF;
  IF old_memory.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = old_memory.project_id AND p.owner_id = p_actor_id) THEN RAISE EXCEPTION 'Project is not owned by the current user'; END IF;
  INSERT INTO public.aether_memories (owner_id, project_id, scope, memory_type, content, persistence_mode, reason, confidence, importance, version, previous_memory_id, source_conversation_id, source_message_id, source_task_id)
  VALUES (old_memory.owner_id, old_memory.project_id, old_memory.scope, COALESCE(p_memory_type, old_memory.memory_type), trim(p_content), old_memory.persistence_mode, COALESCE(p_reason, old_memory.reason), p_confidence, LEAST(GREATEST(COALESCE(p_importance, old_memory.importance),0),1), old_memory.version + 1, old_memory.id, old_memory.source_conversation_id, old_memory.source_message_id, old_memory.source_task_id) RETURNING id INTO new_memory;
  UPDATE public.aether_memories SET status = 'superseded', updated_at = now() WHERE id = old_memory.id;
  INSERT INTO public.aether_memory_events (owner_id, memory_id, event_type, actor_id, source_conversation_id, source_task_id, metadata) VALUES (old_memory.owner_id, old_memory.id, 'superseded', p_actor_id, old_memory.source_conversation_id, old_memory.source_task_id, jsonb_build_object('replaced_by',new_memory));
  INSERT INTO public.aether_memory_events (owner_id, memory_id, event_type, actor_id, source_conversation_id, source_task_id, metadata) VALUES (old_memory.owner_id, new_memory, 'created', p_actor_id, old_memory.source_conversation_id, old_memory.source_task_id, jsonb_build_object('version',old_memory.version + 1,'previous_memory_id',old_memory.id));
  RETURN new_memory;
END; $$;
REVOKE ALL ON FUNCTION public.replace_aether_memory(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_aether_memory(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO service_role;
