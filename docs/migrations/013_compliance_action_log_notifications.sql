-- ============================================================
-- PageCast Migration 013 - Compliance Action Log and Notifications
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists public.compliance_action_logs (
  id uuid primary key default uuid_generate_v4(),
  queue_kind text not null check (queue_kind in ('content_reports', 'takedown_requests', 'privacy_requests')),
  queue_item_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  action_type text not null default 'status_update',
  previous_status text,
  new_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists compliance_action_logs_queue_idx
  on public.compliance_action_logs(queue_kind, queue_item_id);

create index if not exists compliance_action_logs_actor_idx
  on public.compliance_action_logs(actor_id);

create table if not exists public.compliance_notifications (
  id uuid primary key default uuid_generate_v4(),
  queue_kind text not null check (queue_kind in ('content_reports', 'takedown_requests', 'privacy_requests')),
  queue_item_id uuid not null,
  action_log_id uuid references public.compliance_action_logs(id) on delete set null,
  recipient_email text,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  provider text,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists compliance_notifications_queue_idx
  on public.compliance_notifications(queue_kind, queue_item_id);

create index if not exists compliance_notifications_status_idx
  on public.compliance_notifications(status);

alter table public.compliance_action_logs enable row level security;
alter table public.compliance_notifications enable row level security;

drop policy if exists "Admins view compliance action logs" on public.compliance_action_logs;
create policy "Admins view compliance action logs"
  on public.compliance_action_logs for select
  using (public.is_admin());

drop policy if exists "Admins insert compliance action logs" on public.compliance_action_logs;
create policy "Admins insert compliance action logs"
  on public.compliance_action_logs for insert
  with check (public.is_admin());

drop policy if exists "Admins view compliance notifications" on public.compliance_notifications;
create policy "Admins view compliance notifications"
  on public.compliance_notifications for select
  using (public.is_admin());

drop policy if exists "Admins insert compliance notifications" on public.compliance_notifications;
create policy "Admins insert compliance notifications"
  on public.compliance_notifications for insert
  with check (public.is_admin());

drop policy if exists "Admins update compliance notifications" on public.compliance_notifications;
create policy "Admins update compliance notifications"
  on public.compliance_notifications for update
  using (public.is_admin())
  with check (public.is_admin());
