-- Migration 007 — Narrator-only mode for books
-- Run in: Supabase Dashboard → SQL Editor
-- Adds narrator_only_mode and narrator_voice_id to the books table.
-- When narrator_only_mode = true, the reader uses a single narrator voice
-- for all blocks (narration, dialogue, thought) instead of per-character voices.

alter table public.books
  add column if not exists narrator_only_mode boolean not null default false,
  add column if not exists narrator_voice_id  text;

comment on column public.books.narrator_only_mode is 'When true, one narrator voice reads all blocks (audiobook style)';
comment on column public.books.narrator_voice_id  is 'PageCast voice ID used when narrator_only_mode is enabled';
