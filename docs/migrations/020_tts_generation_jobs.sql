-- Migration 020 — TTS generation jobs & runs
-- Backs the client-driven background TTS queue: a "run" is one click of
-- "Generate All Missing Audio" on a book; it fans out into one "job" per
-- block. The client-side queue runner updates job/run status as it works
-- through the queue (throttled per-provider), so the /tts-status page can
-- show live progress even across page reloads (state lives in Supabase,
-- not just React state).

create table public.tts_runs (
  id             uuid primary key default uuid_generate_v4(),
  book_id        uuid not null references public.books(id) on delete cascade,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  status         text not null default 'queued', -- queued | running | completed | completed_with_errors | failed | cancelled
  total_jobs     int not null default 0,
  completed_jobs int not null default 0,
  failed_jobs    int not null default 0,
  skipped_jobs   int not null default 0,
  provider       text,             -- dominant provider, for display only — individual jobs may vary by character
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz
);

create index tts_runs_book_id_idx  on public.tts_runs(book_id);
create index tts_runs_owner_id_idx on public.tts_runs(owner_id);
create index tts_runs_status_idx   on public.tts_runs(status);

create trigger tts_runs_updated_at
  before update on public.tts_runs
  for each row execute procedure public.set_updated_at();

create table public.tts_jobs (
  id              uuid primary key default uuid_generate_v4(),
  run_id          uuid not null references public.tts_runs(id) on delete cascade,
  book_id         uuid not null references public.books(id) on delete cascade,
  chapter_id      uuid,
  chapter_title   text,
  scene_id        uuid,
  block_id        uuid not null,
  character_name  text,
  provider        text,
  voice_id        text,
  char_count      int not null default 0,
  status          text not null default 'queued', -- queued | running | succeeded | failed | skipped
  error           text,
  attempts        int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz
);

create index tts_jobs_run_id_idx  on public.tts_jobs(run_id);
create index tts_jobs_book_id_idx on public.tts_jobs(book_id);
create index tts_jobs_status_idx  on public.tts_jobs(status);

create trigger tts_jobs_updated_at
  before update on public.tts_jobs
  for each row execute procedure public.set_updated_at();

alter table public.tts_runs enable row level security;
alter table public.tts_jobs enable row level security;

create policy "Creators manage their own TTS runs"
  on public.tts_runs for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Creators manage jobs on their own TTS runs"
  on public.tts_jobs for all
  using (exists (select 1 from public.tts_runs r where r.id = run_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.tts_runs r where r.id = run_id and r.owner_id = auth.uid()));
