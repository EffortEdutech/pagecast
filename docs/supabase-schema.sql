-- ============================================================
-- PageCast — Supabase Schema
-- Run this in Supabase SQL Editor (Project: zdlbcvscytujdomxzwei)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────
create type public.user_role     as enum ('reader', 'creator', 'admin');
create type public.book_status   as enum ('draft', 'published', 'archived');
create type public.block_type    as enum ('narration', 'dialogue', 'thought', 'quote', 'pause', 'sfx');
create type public.asset_type    as enum ('audio', 'image', 'cover');

-- ────────────────────────────────────────────────────────────
-- HELPER: updated_at trigger function
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- TABLE: profiles
-- Mirrors auth.users — one row per Supabase Auth user
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  avatar_url   text,
  role         public.user_role not null default 'reader',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create profile on new Auth user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'reader')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- TABLE: books
-- ────────────────────────────────────────────────────────────
create table public.books (
  id              uuid primary key default uuid_generate_v4(),
  author_id       uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  subtitle        text,
  description     text,
  cover_gradient  text default 'from-purple-900 to-blue-900',
  cover_emoji     text default '📖',
  genre           text,
  age_rating      text default 'All ages',
  tags            text[] default '{}',
  status          public.book_status not null default 'draft',
  price           numeric(10,2) not null default 0.00,
  is_free         boolean not null default true,
  total_chapters  int not null default 0,
  estimated_time  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index books_author_id_idx on public.books(author_id);
create index books_status_idx    on public.books(status);

create trigger books_updated_at
  before update on public.books
  for each row execute procedure public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABLE: characters
-- ────────────────────────────────────────────────────────────
create table public.characters (
  id           uuid primary key default uuid_generate_v4(),
  book_id      uuid not null references public.books(id) on delete cascade,
  name         text not null,
  role         text,                -- e.g. 'narrator', 'protagonist', 'side'
  color        text default '#5C5A6A',
  voice_label  text,               -- e.g. 'Deep Male', 'Soft Female'
  voice_pitch  numeric(3,2) default 1.0,
  voice_rate   numeric(3,2) default 1.0,
  avatar_emoji text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index characters_book_id_idx on public.characters(book_id);

-- ────────────────────────────────────────────────────────────
-- TABLE: chapters
-- ────────────────────────────────────────────────────────────
create table public.chapters (
  id          uuid primary key default uuid_generate_v4(),
  book_id     uuid not null references public.books(id) on delete cascade,
  title       text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index chapters_book_id_idx on public.chapters(book_id);

create trigger chapters_updated_at
  before update on public.chapters
  for each row execute procedure public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABLE: scenes
-- ────────────────────────────────────────────────────────────
create table public.scenes (
  id          uuid primary key default uuid_generate_v4(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  title       text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index scenes_chapter_id_idx on public.scenes(chapter_id);
create index scenes_book_id_idx    on public.scenes(book_id);

create trigger scenes_updated_at
  before update on public.scenes
  for each row execute procedure public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABLE: blocks
-- JSONB content handles all 6 block types:
--   narration  → { text }
--   dialogue   → { character_id, character_name, text }
--   thought    → { character_id, character_name, text }
--   quote      → { character_id, character_name, text }
--   pause      → { duration_ms }
--   sfx        → { label, duration_ms }
-- ────────────────────────────────────────────────────────────
create table public.blocks (
  id          uuid primary key default uuid_generate_v4(),
  scene_id    uuid not null references public.scenes(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  type        public.block_type not null,
  content     jsonb not null default '{}',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index blocks_scene_id_idx on public.blocks(scene_id);
create index blocks_book_id_idx  on public.blocks(book_id);
create index blocks_content_idx  on public.blocks using gin(content);

create trigger blocks_updated_at
  before update on public.blocks
  for each row execute procedure public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABLE: purchases
-- Free books → insert row with price_paid = 0
-- ────────────────────────────────────────────────────────────
create table public.purchases (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  book_id      uuid not null references public.books(id) on delete cascade,
  price_paid   numeric(10,2) not null default 0.00,
  purchased_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create index purchases_user_id_idx on public.purchases(user_id);
create index purchases_book_id_idx on public.purchases(book_id);

-- ────────────────────────────────────────────────────────────
-- TABLE: reading_progress
-- ────────────────────────────────────────────────────────────
create table public.reading_progress (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  book_id      uuid not null references public.books(id) on delete cascade,
  chapter_idx  int not null default 0,
  scene_idx    int not null default 0,
  block_idx    int not null default 0,
  updated_at   timestamptz not null default now(),
  unique (user_id, book_id)
);

create index reading_progress_user_id_idx on public.reading_progress(user_id);

create trigger reading_progress_updated_at
  before update on public.reading_progress
  for each row execute procedure public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TABLE: assets
-- For future: uploaded audio files, cover images, etc.
-- ────────────────────────────────────────────────────────────
create table public.assets (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  book_id     uuid references public.books(id) on delete set null,
  type        public.asset_type not null,
  filename    text not null,
  url         text not null,
  size_bytes  bigint,
  mime_type   text,
  created_at  timestamptz not null default now()
);

create index assets_owner_id_idx on public.assets(owner_id);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

alter table public.profiles         enable row level security;
alter table public.books            enable row level security;
alter table public.characters       enable row level security;
alter table public.chapters         enable row level security;
alter table public.scenes           enable row level security;
alter table public.blocks           enable row level security;
alter table public.purchases        enable row level security;
alter table public.reading_progress enable row level security;
alter table public.assets           enable row level security;

-- ────────────────────────────────────────────────────────────
-- profiles RLS
-- ────────────────────────────────────────────────────────────
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ────────────────────────────────────────────────────────────
-- books RLS
-- ────────────────────────────────────────────────────────────
-- Anyone (authenticated) can see published books
create policy "Published books are visible to all"
  on public.books for select
  using (status = 'published' or author_id = auth.uid());

-- Creators can insert their own books
create policy "Creators can insert books"
  on public.books for insert
  with check (auth.uid() = author_id);

-- Creators can update their own books
create policy "Creators can update their own books"
  on public.books for update
  using (auth.uid() = author_id);

-- Creators can delete their own books
create policy "Creators can delete their own books"
  on public.books for delete
  using (auth.uid() = author_id);

-- ────────────────────────────────────────────────────────────
-- characters RLS (inherit from book ownership)
-- ────────────────────────────────────────────────────────────
create policy "Characters visible if book visible"
  on public.characters for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

create policy "Creators manage their book characters"
  on public.characters for all
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.author_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- chapters RLS
-- ────────────────────────────────────────────────────────────
create policy "Chapters visible if book visible"
  on public.chapters for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

create policy "Creators manage their book chapters"
  on public.chapters for all
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.author_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- scenes RLS
-- ────────────────────────────────────────────────────────────
create policy "Scenes visible if book visible"
  on public.scenes for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

create policy "Creators manage their book scenes"
  on public.scenes for all
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.author_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- blocks RLS
-- ────────────────────────────────────────────────────────────
create policy "Blocks visible if book visible"
  on public.blocks for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.status = 'published' or b.author_id = auth.uid())
    )
  );

create policy "Creators manage their book blocks"
  on public.blocks for all
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.author_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- purchases RLS
-- ────────────────────────────────────────────────────────────
create policy "Users can view their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

create policy "Users can insert their own purchases"
  on public.purchases for insert
  with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- reading_progress RLS
-- ────────────────────────────────────────────────────────────
create policy "Users can view their own reading progress"
  on public.reading_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert their own reading progress"
  on public.reading_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own reading progress"
  on public.reading_progress for update
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- assets RLS
-- ────────────────────────────────────────────────────────────
create policy "Owners manage their own assets"
  on public.assets for all
  using (auth.uid() = owner_id);

-- ════════════════════════════════════════════════════════════
-- SEED DATA — Test user profiles
-- These UUIDs must match the users created in Supabase Auth
-- ════════════════════════════════════════════════════════════

insert into public.profiles (id, email, display_name, role)
values
  ('98165438-24f6-49ca-9d4f-466fa2f9a672', 'reader1@pagecast.test',  'Reader One',   'reader'),
  ('9e42d3d4-bc51-4e9d-82da-f16a981479c3', 'reader2@pagecast.test',  'Reader Two',   'reader'),
  ('d7f8afb1-d371-4888-9701-579931b2fb25', 'creator1@pagecast.test', 'Creator One',  'creator'),
  ('12f2abc4-3ae2-4bb7-b64f-867648639511', 'creator2@pagecast.test', 'Creator Two',  'creator')
on conflict (id) do update set
  display_name = excluded.display_name,
  role         = excluded.role;
