-- AAX user conversations are model-scoped and persist independently per AAX generation.
create table if not exists public.aax_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid not null references public.aax_models(id) on delete restrict,
  title text not null default 'New conversation',
  archived boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aax_conversations_owner_model_idx
  on public.aax_conversations(owner_id, model_id, updated_at desc);

create table if not exists public.aax_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.aax_conversations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid not null references public.aax_models(id) on delete restrict,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists aax_conversation_messages_idx
  on public.aax_conversation_messages(conversation_id, created_at);

alter table public.aax_conversations enable row level security;
alter table public.aax_conversation_messages enable row level security;
grant select, insert, update, delete on public.aax_conversations to authenticated;
grant select, insert on public.aax_conversation_messages to authenticated;
grant all on public.aax_conversations to service_role;
grant all on public.aax_conversation_messages to service_role;

drop policy if exists "own aax conversations" on public.aax_conversations;
create policy "own aax conversations" on public.aax_conversations for all to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "own aax messages" on public.aax_conversation_messages;
create policy "own aax messages" on public.aax_conversation_messages for select to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "insert own aax messages" on public.aax_conversation_messages;
create policy "insert own aax messages" on public.aax_conversation_messages for insert to authenticated
  with check (owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Conversation learning remains a candidate until verification/curation approves it.
create index if not exists agent_learning_records_source_idx
  on public.agent_learning_records(source_type, source_id, created_at desc);
