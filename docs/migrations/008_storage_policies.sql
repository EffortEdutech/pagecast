-- Migration 008 — Supabase Storage buckets + policies
-- Run in: Supabase Dashboard → SQL Editor  (postgres role)
-- Creates the 'audio' and 'covers' buckets and sets public read access.

-- ── Buckets ──────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('audio',  'audio',  true, 52428800,  -- 50 MB
   array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']),
  ('covers', 'covers', true, 5242880,   -- 5 MB
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Policies: audio bucket ────────────────────────────────────────────────────

-- Anyone can read audio files
create policy "Public audio read"
  on storage.objects for select
  using (bucket_id = 'audio');

-- Authenticated users (creators) can upload audio
create policy "Creators can upload audio"
  on storage.objects for insert
  with check (
    bucket_id = 'audio'
    and auth.role() = 'authenticated'
  );

-- Owners can delete their audio files
create policy "Owners can delete audio"
  on storage.objects for delete
  using (
    bucket_id = 'audio'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Policies: covers bucket ───────────────────────────────────────────────────

create policy "Public covers read"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "Creators can upload covers"
  on storage.objects for insert
  with check (
    bucket_id = 'covers'
    and auth.role() = 'authenticated'
  );

create policy "Owners can delete covers"
  on storage.objects for delete
  using (
    bucket_id = 'covers'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Usage ────────────────────────────────────────────────────────────────────
-- Upload path convention (matches storage.ts helper):
--   audio/{userId}/{bookId}/{filename}.mp3
--   covers/{userId}/{bookId}/cover.webp
--
-- Public URL:
--   https://<project>.supabase.co/storage/v1/object/public/audio/{path}
