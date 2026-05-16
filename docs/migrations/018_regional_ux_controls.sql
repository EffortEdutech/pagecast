-- ============================================================
-- PageCast Migration 018 - Regional UX Controls
-- ============================================================

alter table public.profiles
  add column if not exists age_confirmation text,
  add column if not exists signup_consent_context text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    role,
    signup_source,
    country_code,
    region_code,
    marketing_opt_in,
    age_confirmation,
    signup_consent_context
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'reader'),
    nullif(new.raw_user_meta_data->>'signup_source', ''),
    nullif(upper(new.raw_user_meta_data->>'country_code'), ''),
    nullif(upper(new.raw_user_meta_data->>'region_code'), ''),
    coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false),
    nullif(new.raw_user_meta_data->>'age_confirmation', ''),
    nullif(new.raw_user_meta_data->>'signup_consent_context', '')
  )
  on conflict (id) do update set
    signup_source = coalesce(public.profiles.signup_source, excluded.signup_source),
    country_code = coalesce(public.profiles.country_code, excluded.country_code),
    region_code = coalesce(public.profiles.region_code, excluded.region_code),
    marketing_opt_in = public.profiles.marketing_opt_in or excluded.marketing_opt_in,
    age_confirmation = coalesce(public.profiles.age_confirmation, excluded.age_confirmation),
    signup_consent_context = coalesce(public.profiles.signup_consent_context, excluded.signup_consent_context);

  insert into public.marketing_consents (
    user_id,
    status,
    source,
    country_code,
    region_code
  )
  values (
    new.id,
    case
      when coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false)
      then 'opted_in'
      else 'opted_out'
    end,
    'reader_signup',
    nullif(upper(new.raw_user_meta_data->>'country_code'), ''),
    nullif(upper(new.raw_user_meta_data->>'region_code'), '')
  );

  return new;
end;
$$;

insert into public.jurisdiction_profiles (
  country_code,
  region_code,
  privacy_module,
  requires_cookie_consent,
  requires_child_privacy_gate,
  requires_dmca_flow,
  requires_dsa_flow,
  requires_ai_disclosure
)
values
  ('GLOBAL', null, 'global', true, true, false, false, true),
  ('MY', null, 'pdpa_my', true, true, false, false, true),
  ('GB', null, 'uk_gdpr', true, true, false, false, true),
  ('EU', null, 'gdpr', true, true, false, true, true),
  ('US', 'CA', 'ccpa_cpra', true, true, true, false, true)
on conflict (country_code, region_code) do update
set privacy_module = excluded.privacy_module,
    requires_cookie_consent = excluded.requires_cookie_consent,
    requires_child_privacy_gate = excluded.requires_child_privacy_gate,
    requires_dmca_flow = excluded.requires_dmca_flow,
    requires_dsa_flow = excluded.requires_dsa_flow,
    requires_ai_disclosure = excluded.requires_ai_disclosure,
    updated_at = now();
