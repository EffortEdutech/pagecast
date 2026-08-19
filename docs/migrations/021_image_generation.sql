-- Migration 021 — Character portraits + image generation jobs
--
-- Adds character reference-portrait fields (used for Gemini image-to-image
-- character consistency: a reference portrait is generated once per
-- character, held in a review state until the creator approves it, then
-- reused as an input image on every scene that character appears in) and a
-- separate run/job queue for background image generation — deliberately
-- NOT sharing tts_runs/tts_jobs (020), per product decision to keep audio
-- and image generation infra independent.

-- ── Character portrait fields ───────────────────────────────────────────────

alter table public.characters
  add column if not exists portrait_url    text,
  add column if not exists portrait_status text not null default 'none', -- none | generating | pending_review | approved | failed
  add column if not exists portrait_prompt text;

-- ── image_runs / image_jobs ──────────────────────────────────────────────────

create table public.image_runs (
  id             uuid primary key default uuid_generate_v4(),
  book_id        uuid not null references public.books(id) on delete cascade,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  run_type       text not null,    -- character_portraits | scene_and_cover_images
  status         text not null default 'queued', -- queued | running | completed | completed_with_errors | failed | cancelled
  total_jobs     int not null default 0,
  completed_jobs int not null default 0,
  failed_jobs    int not null default 0,
  skipped_jobs   int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);

create index image_runs_book_id_idx  on public.image_runs(book_id);
create index image_runs_owner_id_idx on public.image_runs(owner_id);
create index image_runs_status_idx   on public.image_runs(status);

create trigger image_runs_updated_at
  before update on public.image_runs
  for each row execute procedure public.set_updated_at();

create table public.image_jobs (
  id                uuid primary key default uuid_generate_v4(),
  run_id            uuid not null references public.image_runs(id) on delete cascade,
  book_id           uuid not null references public.books(id) on delete cascade,
  job_type          text not null,   -- character_portrait | scene_image | cover_image
  character_id      uuid,            -- set for character_portrait jobs
  character_name    text,
  chapter_id        uuid,            -- set for scene_image jobs
  chapter_title     text,
  scene_id          uuid,            -- set for scene_image jobs
  scene_title       text,
  reference_character_names text[],  -- character names whose portraits were used as reference input
  prompt            text,
  status            text not null default 'queued', -- queued | running | succeeded | failed | skipped
  error             text,
  attempts          int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz
);

create index image_jobs_run_id_idx  on public.image_jobs(run_id);
create index image_jobs_book_id_idx on public.image_jobs(book_id);
create index image_jobs_status_idx  on public.image_jobs(status);

create trigger image_jobs_updated_at
  before update on public.image_jobs
  for each row execute procedure public.set_updated_at();

alter table public.image_runs enable row level security;
alter table public.image_jobs enable row level security;

create policy "Creators manage their own image runs"
  on public.image_runs for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Creators manage jobs on their own image runs"
  on public.image_jobs for all
  using (exists (select 1 from public.image_runs r where r.id = run_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.image_runs r where r.id = run_id and r.owner_id = auth.uid()));
