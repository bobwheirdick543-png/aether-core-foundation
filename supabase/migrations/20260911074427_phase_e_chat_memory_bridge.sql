CREATE OR REPLACE FUNCTION public.bridge_aax_chat_memory_candidate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv_project UUID; candidate_scope TEXT;
BEGIN
  SELECT project_id INTO conv_project FROM public.aax_conversations WHERE id = NEW.conversation_id AND owner_id = NEW.owner_id;
  candidate_scope := CASE WHEN conv_project IS NULL THEN 'global' ELSE 'project' END;
  INSERT INTO public.aether_memory_candidates (owner_id, project_id, scope, memory_type, content, status, reason, source_conversation_id, source_message_id, provenance)
  VALUES (NEW.owner_id, conv_project, candidate_scope, 'fact', NEW.content, NEW.status, 'Created from chat memory action', NEW.conversation_id, NEW.message_id, jsonb_build_object('legacy_candidate_id', NEW.id, 'bridge', 'aax_chat_memory_candidates'));
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.bridge_aax_chat_memory_candidate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_aax_chat_memory_candidate() TO service_role;
DROP TRIGGER IF EXISTS bridge_aax_chat_memory_candidate ON public.aax_chat_memory_candidates;
CREATE TRIGGER bridge_aax_chat_memory_candidate AFTER INSERT ON public.aax_chat_memory_candidates FOR EACH ROW EXECUTE FUNCTION public.bridge_aax_chat_memory_candidate();
