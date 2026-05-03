-- Migration 005: add voice_id to characters table
-- Run in Supabase SQL Editor
-- voice_id stores the internal PageCast voice key (e.g. 'ai_female_soft')
-- voice_label stores the human-readable label (e.g. 'Aria -- Female Soft')

alter table public.characters
  add column if not exists voice_id text not null default 'ai_female_soft';
