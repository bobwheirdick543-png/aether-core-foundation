-- Phase K: durable, auditable notification delivery.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  email_address text,
  event_types text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

alter table public.notifications add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists idempotency_key text;
alter table public.notification_deliveries add column if not exists idempotency_key text;
alter table public.notification_deliveries add column if not exists next_attempt_at timestamptz;
alter table public.notification_deliveries add column if not exists delivered_at timestamptz;
create unique index if not exists notification_idempotency_idx on public.notifications(recipient_id,idempotency_key) where idempotency_key is not null;
create unique index if not exists notification_delivery_idempotency_idx on public.notification_deliveries(notification_id,channel,idempotency_key) where idempotency_key is not null;
create index if not exists notification_deliveries_due_idx on public.notification_deliveries(status,next_attempt_at);

alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences for select using (user_id=auth.uid());
drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences for update using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences for insert with check (user_id=auth.uid());
revoke all on public.notification_deliveries from anon, authenticated;
revoke all on public.notification_preferences from anon;
