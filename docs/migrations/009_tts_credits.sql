-- Migration 009 — TTS credit tracking in profiles
-- Tracks character count consumed per creator for metering / limits.

alter table public.profiles
  add column if not exists tts_chars_used  bigint not null default 0,
  add column if not exists tts_chars_limit bigint not null default 100000;

-- Increment helper (called from the TTS API route)
create or replace function public.increment_tts_chars(p_user_id uuid, p_chars int)
returns void
language plpgsql security definer
as $$
begin
  update public.profiles
  set    tts_chars_used = tts_chars_used + p_chars
  where  id = p_user_id;
end;
$$;
