-- ============================================================
-- PageCast Migration 014 - Compliance Case Evidence
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists public.compliance_case_evidence (
  id uuid primary key default uuid_generate_v4(),
  queue_kind text not null check (queue_kind in ('content_reports', 'takedown_requests', 'privacy_requests')),
  queue_item_id uuid not null,
  evidence_type text not null default 'note' check (evidence_type in ('note', 'url', 'document', 'screenshot', 'rights_proof', 'identity_proof', 'other')),
  title text not null,
  url text,
  notes text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists compliance_case_evidence_queue_idx
  on public.compliance_case_evidence(queue_kind, queue_item_id);

create index if not exists compliance_case_evidence_added_by_idx
  on public.compliance_case_evidence(added_by);

alter table public.compliance_case_evidence enable row level security;

drop policy if exists "Admins view compliance case evidence" on public.compliance_case_evidence;
create policy "Admins view compliance case evidence"
  on public.compliance_case_evidence for select
  using (public.is_admin());

drop policy if exists "Admins insert compliance case evidence" on public.compliance_case_evidence;
create policy "Admins insert compliance case evidence"
  on public.compliance_case_evidence for insert
  with check (public.is_admin());
