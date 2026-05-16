-- ============================================================
-- PageCast Migration 012 - Compliance Admin Review Policies
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Admins can review and update legal/compliance queues.
drop policy if exists "Admins view all content reports" on public.content_reports;
create policy "Admins view all content reports"
  on public.content_reports for select
  using (public.is_admin());

drop policy if exists "Admins update content reports" on public.content_reports;
create policy "Admins update content reports"
  on public.content_reports for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins view all takedown requests" on public.takedown_requests;
create policy "Admins view all takedown requests"
  on public.takedown_requests for select
  using (public.is_admin());

drop policy if exists "Admins update takedown requests" on public.takedown_requests;
create policy "Admins update takedown requests"
  on public.takedown_requests for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins view all privacy requests" on public.privacy_requests;
create policy "Admins view all privacy requests"
  on public.privacy_requests for select
  using (public.is_admin());

drop policy if exists "Admins update privacy requests" on public.privacy_requests;
create policy "Admins update privacy requests"
  on public.privacy_requests for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins view all book rights" on public.book_rights;
create policy "Admins view all book rights"
  on public.book_rights for select
  using (public.is_admin());

drop policy if exists "Admins view all asset rights" on public.asset_rights;
create policy "Admins view all asset rights"
  on public.asset_rights for select
  using (public.is_admin());
