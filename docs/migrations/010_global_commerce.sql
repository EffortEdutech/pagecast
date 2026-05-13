-- Global commerce readiness for pageCast.
-- Pricing is stored and charged in USD.

alter table public.profiles
  add column if not exists signup_source text,
  add column if not exists stripe_customer_id text;

alter table public.books
  add column if not exists slug text,
  add column if not exists language text not null default 'en';

create unique index if not exists books_slug_idx
  on public.books(slug)
  where slug is not null;

alter table public.purchases
  add column if not exists stripe_session_id text,
  add column if not exists currency text not null default 'usd';

create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  status text not null,
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view their own subscriptions" on public.subscriptions;
create policy "Users can view their own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name, role, signup_source)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'reader'),
    nullif(new.raw_user_meta_data->>'signup_source', '')
  )
  on conflict (id) do update set
    signup_source = coalesce(public.profiles.signup_source, excluded.signup_source);
  return new;
end;
$$;
