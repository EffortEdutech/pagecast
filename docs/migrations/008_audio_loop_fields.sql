-- Migration 008 — Audio loop flags, scene image URL, block audio URL
-- Run in: Supabase Dashboard → SQL Editor

-- Scene: loop toggles (default true = loops) + scene image URL persisted to DB
alter table public.scenes
  add column if not exists ambience_loop boolean not null default true,
  add column if not exists music_loop    boolean not null default true,
  add column if not exists scene_image   text;

comment on column public.scenes.ambience_loop is 'Whether the ambience audio loops (default true)';
comment on column public.scenes.music_loop    is 'Whether the music audio loops (default true)';
comment on column public.scenes.scene_image   is 'Public URL of the scene background image';

-- Blocks: dedicated column for the pre-recorded/TTS audio file URL
alter table public.blocks
  add column if not exists audio_url text;

comment on column public.blocks.audio_url is 'Supabase Storage public URL for the block voice/sfx audio';
