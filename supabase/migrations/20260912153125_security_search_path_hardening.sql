-- Pin search_path on mutable-search-path functions reported by Supabase security advisors.
alter function public.touch_aax_chat_attachment() set search_path=public;
alter function public.aether_research_is_stale(timestamptz,timestamptz,integer) set search_path=public;
alter function public.cron_field_matches(text,integer) set search_path=public;
alter function public.cron_field_matches(text,integer,integer,integer) set search_path=public;
alter function public.next_cron_run(text,timestamptz,text) set search_path=public;
alter function public.bv_touch_updated_at() set search_path=public;
