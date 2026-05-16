-- ============================================================
-- PageCast Migration 017 - Compliance Exports and Records Retention
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists public.records_retention_rules (
  id uuid primary key default uuid_generate_v4(),
  record_type text not null unique,
  retention_days integer not null check (retention_days > 0),
  review_warning_days integer not null default 30 check (review_warning_days >= 0),
  action text not null default 'review' check (action in ('review', 'archive', 'delete_after_approval')),
  basis text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists records_retention_rules_active_idx
  on public.records_retention_rules(active, record_type);

alter table public.records_retention_rules enable row level security;

drop policy if exists "Admins view records retention rules" on public.records_retention_rules;
create policy "Admins view records retention rules"
  on public.records_retention_rules for select
  using (public.is_admin());

drop policy if exists "Admins manage records retention rules" on public.records_retention_rules;
create policy "Admins manage records retention rules"
  on public.records_retention_rules for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.records_retention_rules (record_type, retention_days, review_warning_days, action, basis)
values
  ('content_reports', 1095, 60, 'review', 'Operational baseline: retain abuse/safety reports for 3 years, then review.'),
  ('takedown_requests', 2190, 90, 'review', 'Operational baseline: retain rights claims for 6 years, then review.'),
  ('privacy_requests', 2190, 90, 'review', 'Operational baseline: retain privacy request evidence for 6 years, then review.'),
  ('compliance_action_logs', 2555, 120, 'review', 'Operational baseline: retain admin audit trail for 7 years, then review.'),
  ('compliance_notifications', 1095, 60, 'review', 'Operational baseline: retain notification outbox records for 3 years, then review.'),
  ('compliance_case_evidence', 2190, 90, 'review', 'Operational baseline: retain case evidence for 6 years, then review.'),
  ('user_consents', 2555, 120, 'review', 'Operational baseline: retain consent evidence for 7 years, then review.')
on conflict (record_type) do update
set retention_days = excluded.retention_days,
    review_warning_days = excluded.review_warning_days,
    action = excluded.action,
    basis = excluded.basis,
    active = true,
    updated_at = now();
