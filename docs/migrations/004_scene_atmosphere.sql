-- Migration 004 — Scene atmosphere audio fields
-- Run this in: Supabase Dashboard → SQL Editor
-- Date: 2026-05

alter table public.scenes
  add column if not exists ambience_url    text,
  add column if not exists music_url       text,
  add column if not exists ambience_volume real not null default 0.4,
  add column if not exists music_volume    real not null default 0.3;

comment on column public.scenes.ambience_url    is 'Supabase Storage public URL for the scene ambience/background sound loop';
comment on column public.scenes.music_url       is 'Supabase Storage public URL for the scene background music loop';
comment on column public.scenes.ambience_volume is 'Playback volume 0–1 for ambience layer (default 0.4)';
comment on column public.scenes.music_volume    is 'Playback volume 0–1 for music layer (default 0.3)';
