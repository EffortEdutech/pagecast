-- PageCast — Language Pack first-class content metadata
-- Apply after 021_image_generation.sql.

alter table public.books
  add column if not exists content_type text not null default 'cast',
  add column if not exists schema_version text not null default '1.0',
  add column if not exists languages jsonb,
  add column if not exists level text,
  add column if not exists practice_mode text;

alter table public.characters
  add column if not exists language text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'books_content_type_check'
      and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_content_type_check
      check (content_type in ('cast', 'language_pack'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'books_practice_mode_check'
      and conrelid = 'public.books'::regclass
  ) then
    alter table public.books
      add constraint books_practice_mode_check
      check (practice_mode is null or practice_mode in ('pause_and_speak'));
  end if;
end $$;
