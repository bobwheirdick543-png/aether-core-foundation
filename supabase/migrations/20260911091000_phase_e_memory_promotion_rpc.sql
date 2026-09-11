CREATE OR REPLACE FUNCTION public.promote_aether_memory_candidate(p_candidate_id UUID, p_actor_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.aether_memory_candidates%ROWTYPE; new_memory UUID;
BEGIN
  SELECT * INTO c FROM public.aether_memory_candidates WHERE id = p_candidate_id FOR UPDATE;
  IF NOT FOUND OR c.owner_id <> p_actor_id OR c.status <> 'candidate' THEN RAISE EXCEPTION 'Memory candidate is unavailable'; END IF;
  IF c.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = c.project_id AND p.owner_id = p_actor_id) THEN RAISE EXCEPTION 'Project is not owned by the current user'; END IF;
  INSERT INTO public.aether_memories (owner_id, project_id, scope, memory_type, content, persistence_mode, reason, confidence, source_conversation_id, source_message_id, source_task_id)
  VALUES (c.owner_id, c.project_id, c.scope, c.memory_type, c.content, 'approved_candidate', c.reason, c.confidence, c.source_conversation_id, c.source_message_id, c.source_task_id)
  RETURNING id INTO new_memory;
  UPDATE public.aether_memory_candidates SET status = 'promoted', reviewed_by = p_actor_id, reviewed_at = now(), memory_id = new_memory, updated_at = now() WHERE id = c.id;
  INSERT INTO public.aether_memory_events (owner_id, memory_id, candidate_id, event_type, actor_id, source_conversation_id, source_task_id, metadata)
  VALUES (c.owner_id, new_memory, c.id, 'candidate_approved', p_actor_id, c.source_conversation_id, c.source_task_id, jsonb_build_object('promotion','candidate_to_memory'));
  RETURN new_memory;
END; $$;
REVOKE ALL ON FUNCTION public.promote_aether_memory_candidate(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_aether_memory_candidate(UUID, UUID) TO service_role;
