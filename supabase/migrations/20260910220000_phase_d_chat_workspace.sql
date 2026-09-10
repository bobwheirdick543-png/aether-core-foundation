create extension if not exists pg_trgm;

alter table public.aax_conversations
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists memory_enabled boolean not null default true,
  add column if not exists web_research_enabled boolean not null default false,
  add column if not exists archived_at timestamptz;

create index if not exists aax_conversations_owner_updated_idx on public.aax_conversations(owner_id, updated_at desc);
create index if not exists aax_conversations_project_idx on public.aax_conversations(project_id);
create index if not exists aax_conversations_title_trgm_idx on public.aax_conversations using gin(title gin_trgm_ops);

create table if not exists public.aax_chat_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.aax_conversations(id) on delete cascade,
  message_id uuid references public.aax_conversation_messages(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  sha256 text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending','processing','completed','failed','unsupported')),
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aax_chat_attachments_owner_idx on public.aax_chat_attachments(owner_id, created_at desc);
create index if not exists aax_chat_attachments_conversation_idx on public.aax_chat_attachments(conversation_id, created_at desc);

create table if not exists public.aax_chat_sources (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.aax_conversations(id) on delete cascade,
  message_id uuid references public.aax_conversation_messages(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text,
  domain text,
  snippet text,
  citation_index integer,
  created_at timestamptz not null default now()
);
create index if not exists aax_chat_sources_message_idx on public.aax_chat_sources(message_id, citation_index);
create index if not exists aax_chat_sources_owner_idx on public.aax_chat_sources(owner_id, created_at desc);

create table if not exists public.aax_chat_memory_candidates (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.aax_conversations(id) on delete cascade,
  message_id uuid not null references public.aax_conversation_messages(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  status text not null default 'candidate' check (status in ('candidate','approved','rejected','promoted')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists aax_chat_memory_candidates_owner_idx on public.aax_chat_memory_candidates(owner_id, created_at desc);

create table if not exists public.aax_chat_generation_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.aax_conversations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid references public.aax_models(id) on delete set null,
  user_message_id uuid references public.aax_conversation_messages(id) on delete set null,
  assistant_message_id uuid references public.aax_conversation_messages(id) on delete set null,
  status text not null default 'running' check (status in ('running','completed','failed','cancelled')),
  web_research boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists aax_chat_generation_runs_owner_idx on public.aax_chat_generation_runs(owner_id, started_at desc);
create index if not exists aax_chat_generation_runs_conversation_idx on public.aax_chat_generation_runs(conversation_id, started_at desc);

create or replace function public.touch_aax_chat_attachment() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists aax_chat_attachment_touch on public.aax_chat_attachments;
create trigger aax_chat_attachment_touch before update on public.aax_chat_attachments for each row execute function public.touch_aax_chat_attachment();

alter table public.aax_chat_attachments enable row level security;
alter table public.aax_chat_sources enable row level security;
alter table public.aax_chat_memory_candidates enable row level security;
alter table public.aax_chat_generation_runs enable row level security;

create policy "aax chat attachments owner read" on public.aax_chat_attachments for select to authenticated using (owner_id = auth.uid());
create policy "aax chat attachments owner insert" on public.aax_chat_attachments for insert to authenticated with check (owner_id = auth.uid());
create policy "aax chat attachments owner update" on public.aax_chat_attachments for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "aax chat attachments owner delete" on public.aax_chat_attachments for delete to authenticated using (owner_id = auth.uid());
create policy "aax chat sources owner read" on public.aax_chat_sources for select to authenticated using (owner_id = auth.uid());
create policy "aax chat sources owner insert" on public.aax_chat_sources for insert to authenticated with check (owner_id = auth.uid());
create policy "aax chat sources owner delete" on public.aax_chat_sources for delete to authenticated using (owner_id = auth.uid());
create policy "aax chat memory candidates owner read" on public.aax_chat_memory_candidates for select to authenticated using (owner_id = auth.uid());
create policy "aax chat memory candidates owner insert" on public.aax_chat_memory_candidates for insert to authenticated with check (owner_id = auth.uid());
create policy "aax chat memory candidates owner update" on public.aax_chat_memory_candidates for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "aax chat generation runs owner read" on public.aax_chat_generation_runs for select to authenticated using (owner_id = auth.uid());
create policy "aax chat generation runs owner insert" on public.aax_chat_generation_runs for insert to authenticated with check (owner_id = auth.uid());
create policy "aax chat generation runs owner update" on public.aax_chat_generation_runs for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aax-chat-attachments', 'aax-chat-attachments', false, 26214400, array['application/pdf','text/plain','text/markdown','text/csv','application/json','application/xml','text/xml','text/html','image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false, file_size_limit=26214400, allowed_mime_types=excluded.allowed_mime_types;

create policy "aax chat storage read own" on storage.objects for select to authenticated using (bucket_id = 'aax-chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "aax chat storage insert own" on storage.objects for insert to authenticated with check (bucket_id = 'aax-chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "aax chat storage update own" on storage.objects for update to authenticated using (bucket_id = 'aax-chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'aax-chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "aax chat storage delete own" on storage.objects for delete to authenticated using (bucket_id = 'aax-chat-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
