-- ============================================================
-- PageCast Migration 011 - Global Legal and Compliance Foundation
-- ============================================================

create extension if not exists "uuid-ossp";

-- Optional profile fields for compliance routing.
alter table public.profiles
  add column if not exists country_code text,
  add column if not exists region_code text,
  add column if not exists marketing_opt_in boolean not null default false;

-- Legal documents and versioning.
create table if not exists public.legal_documents (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  version text not null,
  title text not null,
  content text not null,
  published_at timestamptz,
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  unique (type, version)
);

create index if not exists legal_documents_type_idx on public.legal_documents(type);

create table if not exists public.user_consents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  document_type text not null,
  document_version text not null,
  consent_context text not null,
  country_code text,
  region_code text,
  ip_address inet,
  user_agent text,
  accepted_at timestamptz not null default now()
);

create index if not exists user_consents_user_id_idx on public.user_consents(user_id);
create index if not exists user_consents_document_idx on public.user_consents(document_type, document_version);

create table if not exists public.marketing_consents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('opted_in', 'opted_out')),
  source text not null default 'account',
  country_code text,
  region_code text,
  updated_at timestamptz not null default now()
);

create index if not exists marketing_consents_user_id_idx on public.marketing_consents(user_id);

-- Content rights metadata.
create table if not exists public.book_rights (
  book_id uuid primary key references public.books(id) on delete cascade,
  rights_category text not null default 'unspecified',
  copyright_owner text,
  source_url text,
  license_type text,
  license_notes text,
  attribution_text text,
  public_domain_basis text,
  jurisdiction text,
  territory text,
  language_rights text,
  audio_rights_confirmed boolean not null default false,
  contains_ai_generated_content boolean not null default false,
  contains_synthetic_audio boolean not null default false,
  ai_disclosure_text text,
  license_expires_at timestamptz,
  declared_by uuid references public.profiles(id) on delete set null,
  declared_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists book_rights_declared_by_idx on public.book_rights(declared_by);

create table if not exists public.asset_rights (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid references public.assets(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  rights_category text not null default 'unspecified',
  copyright_owner text,
  source_url text,
  license_type text,
  license_notes text,
  attribution_text text,
  proof_file_url text,
  declared_by uuid references public.profiles(id) on delete set null,
  declared_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists asset_rights_asset_id_idx on public.asset_rights(asset_id);
create index if not exists asset_rights_book_id_idx on public.asset_rights(book_id);

create table if not exists public.publish_attestations (
  id uuid primary key default uuid_generate_v4(),
  book_id uuid not null references public.books(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  checklist_snapshot jsonb not null default '{}',
  document_versions jsonb not null default '{}',
  attested_at timestamptz not null default now()
);

create index if not exists publish_attestations_book_id_idx on public.publish_attestations(book_id);
create index if not exists publish_attestations_creator_id_idx on public.publish_attestations(creator_id);

-- Reports, takedowns, and privacy requests.
create table if not exists public.content_reports (
  id uuid primary key default uuid_generate_v4(),
  book_id uuid references public.books(id) on delete set null,
  block_id uuid references public.blocks(id) on delete set null,
  reporter_user_id uuid references public.profiles(id) on delete set null,
  reporter_email text,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists content_reports_book_id_idx on public.content_reports(book_id);
create index if not exists content_reports_status_idx on public.content_reports(status);

create table if not exists public.takedown_requests (
  id uuid primary key default uuid_generate_v4(),
  claimant_name text not null,
  claimant_email text not null,
  book_id uuid references public.books(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  claim_type text not null default 'copyright',
  evidence text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'rejected', 'counter_notice')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists takedown_requests_book_id_idx on public.takedown_requests(book_id);
create index if not exists takedown_requests_status_idx on public.takedown_requests(status);

create table if not exists public.privacy_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  country_code text,
  region_code text,
  request_type text not null check (request_type in ('access', 'correction', 'deletion', 'portability', 'withdraw_consent', 'opt_out_sale_share')),
  status text not null default 'open' check (status in ('open', 'verifying', 'processing', 'completed', 'rejected')),
  statutory_deadline_at timestamptz,
  details text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists privacy_requests_user_id_idx on public.privacy_requests(user_id);
create index if not exists privacy_requests_status_idx on public.privacy_requests(status);

create table if not exists public.jurisdiction_profiles (
  id uuid primary key default uuid_generate_v4(),
  country_code text not null,
  region_code text,
  privacy_module text not null default 'global',
  requires_cookie_consent boolean not null default false,
  requires_child_privacy_gate boolean not null default false,
  requires_dmca_flow boolean not null default false,
  requires_dsa_flow boolean not null default false,
  requires_ai_disclosure boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (country_code, region_code)
);

-- RLS.
alter table public.legal_documents enable row level security;
alter table public.user_consents enable row level security;
alter table public.marketing_consents enable row level security;
alter table public.book_rights enable row level security;
alter table public.asset_rights enable row level security;
alter table public.publish_attestations enable row level security;
alter table public.content_reports enable row level security;
alter table public.takedown_requests enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.jurisdiction_profiles enable row level security;

create policy "Published legal documents are public"
  on public.legal_documents for select
  using (published_at is not null and effective_at <= now());

create policy "Users view their own consents"
  on public.user_consents for select
  using (auth.uid() = user_id);

create policy "Users insert their own consents"
  on public.user_consents for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "Users manage their own marketing consent"
  on public.marketing_consents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Book rights visible with book"
  on public.book_rights for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

create policy "Creators manage their book rights"
  on public.book_rights for all
  using (
    exists (select 1 from public.books b where b.id = book_id and b.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.books b where b.id = book_id and b.author_id = auth.uid())
  );

create policy "Creators manage asset rights for their assets"
  on public.asset_rights for all
  using (
    exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid())
    or exists (select 1 from public.books b where b.id = book_id and b.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid())
    or exists (select 1 from public.books b where b.id = book_id and b.author_id = auth.uid())
  );

create policy "Creators view their publish attestations"
  on public.publish_attestations for select
  using (auth.uid() = creator_id);

create policy "Creators insert their publish attestations"
  on public.publish_attestations for insert
  with check (
    auth.uid() = creator_id
    and exists (select 1 from public.books b where b.id = book_id and b.author_id = auth.uid())
  );

create policy "Anyone can submit content reports"
  on public.content_reports for insert
  with check (true);

create policy "Users view their own content reports"
  on public.content_reports for select
  using (auth.uid() = reporter_user_id);

create policy "Anyone can submit takedown requests"
  on public.takedown_requests for insert
  with check (true);

create policy "Users manage their own privacy requests"
  on public.privacy_requests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id or user_id is null);

create policy "Jurisdiction profiles are public"
  on public.jurisdiction_profiles for select
  using (true);

