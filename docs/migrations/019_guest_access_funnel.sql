-- ============================================================
-- PageCast Migration 019 - Guest Access Funnel
-- ============================================================

alter table public.books
  add column if not exists guest_access boolean not null default false,
  add column if not exists guest_access_rank integer,
  add column if not exists guest_access_label text not null default 'Guest Cast';

create index if not exists books_guest_access_idx
  on public.books(guest_access, guest_access_rank)
  where status = 'published';

-- Curate the first three currently published free books for guest access.
-- Adjust these rows manually later from Supabase/Creator tooling if desired.
with ranked_guest_books as (
  select id, row_number() over (order by created_at asc) as rank
  from public.books
  where status = 'published'
    and is_free = true
  order by created_at asc
  limit 3
)
update public.books b
set guest_access = true,
    guest_access_rank = ranked_guest_books.rank,
    guest_access_label = 'Start Free'
from ranked_guest_books
where b.id = ranked_guest_books.id;
