-- ============================================================
-- PageCast Migration 015 - Privacy Request SLA Rules
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists public.privacy_sla_rules (
  id uuid primary key default uuid_generate_v4(),
  country_code text not null,
  region_code text,
  request_type text,
  response_days integer not null check (response_days > 0),
  warning_days integer not null default 7 check (warning_days >= 0),
  basis text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (country_code, region_code, request_type)
);

create index if not exists privacy_sla_rules_country_idx
  on public.privacy_sla_rules(country_code, region_code, request_type)
  where active = true;

alter table public.privacy_sla_rules enable row level security;

drop policy if exists "Admins view privacy SLA rules" on public.privacy_sla_rules;
create policy "Admins view privacy SLA rules"
  on public.privacy_sla_rules for select
  using (public.is_admin());

drop policy if exists "Admins manage privacy SLA rules" on public.privacy_sla_rules;
create policy "Admins manage privacy SLA rules"
  on public.privacy_sla_rules for all
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.privacy_request_response_days(
  input_country_code text,
  input_region_code text,
  input_request_type text
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(
    (
      select response_days
      from public.privacy_sla_rules
      where active = true
        and upper(country_code) = upper(coalesce(input_country_code, 'GLOBAL'))
        and (region_code is null or upper(region_code) = upper(coalesce(input_region_code, '')))
        and (request_type is null or request_type = input_request_type)
      order by
        case when request_type = input_request_type then 0 else 1 end,
        case when region_code is not null then 0 else 1 end
      limit 1
    ),
    (
      select response_days
      from public.privacy_sla_rules
      where active = true
        and country_code = 'GLOBAL'
        and region_code is null
        and request_type is null
      limit 1
    ),
    30
  );
$$;

create or replace function public.set_privacy_request_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.statutory_deadline_at is null then
    new.statutory_deadline_at :=
      new.created_at + (
        public.privacy_request_response_days(new.country_code, new.region_code, new.request_type) || ' days'
      )::interval;
  end if;

  return new;
end;
$$;

drop trigger if exists set_privacy_request_deadline_before_insert on public.privacy_requests;
create trigger set_privacy_request_deadline_before_insert
before insert on public.privacy_requests
for each row
execute function public.set_privacy_request_deadline();

insert into public.privacy_sla_rules (country_code, region_code, request_type, response_days, warning_days, basis)
values
  ('GLOBAL', null, null, 30, 7, 'Operational global baseline until counsel finalises market-specific requirements.'),
  ('GB', null, null, 30, 7, 'UK GDPR baseline: respond without undue delay and within one month.'),
  ('EU', null, null, 30, 7, 'GDPR baseline: respond without undue delay and within one month.'),
  ('US', 'CA', null, 45, 10, 'California CCPA/CPRA baseline for delete, correct, and know requests.'),
  ('MY', null, null, 21, 5, 'Malaysia PDPA operational baseline for data access handling.'),
  ('US', 'CA', 'opt_out_sale_share', 15, 5, 'California opt-out handling baseline.')
on conflict (country_code, region_code, request_type) do update
set response_days = excluded.response_days,
    warning_days = excluded.warning_days,
    basis = excluded.basis,
    active = true,
    updated_at = now();

update public.privacy_requests
set statutory_deadline_at =
  created_at + (
    public.privacy_request_response_days(country_code, region_code, request_type) || ' days'
  )::interval
where statutory_deadline_at is null;
