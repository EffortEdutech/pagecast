# PageCast Legal Compliance Build Roadmap

This roadmap converts the global legal/compliance research into implementation work for the current PageCast monorepo.

## Current State

- Reader app has public store, pricing, login, library, book, and reader routes.
- Creator Studio has protected dashboard, studio editor, voices, assets, and settings.
- Supabase has core publishing, purchase, progress, profile, and asset tables.
- Missing: legal document versions, consent audit trail, rights metadata, report/takedown workflow, data/privacy request workflow, and admin compliance queue.

## Phase 1: Foundation

Status: in progress.

- Add public reader legal pages:
  - `/legal/privacy`
  - `/legal/terms`
  - `/legal/creator-terms`
  - `/legal/copyright`
  - `/legal/refund`
  - `/legal/ai-disclosure`
  - `/legal/contact`
- Add Creator Studio legal center at `/legal-center`.
- Add footer/navigation entry points.
- Add Supabase migration for:
  - `legal_documents`
  - `user_consents`
  - `marketing_consents`
  - `book_rights`
  - `asset_rights`
  - `publish_attestations`
  - `content_reports`
  - `takedown_requests`
  - `privacy_requests`
  - `jurisdiction_profiles`

Acceptance:

- Legal pages are reachable by readers and creators.
- Schema can store policy versions, consent, rights metadata, reports, and privacy requests.
- No publishing behavior changes yet.

## Phase 2: Consent Capture

- Add Terms/Privacy acceptance to reader signup.
- Add Creator Terms/Copyright warranty acceptance to creator login/onboarding.
- Store policy version accepted, timestamp, country/region, context, and user agent.
- Add marketing consent toggle separate from account consent.

Acceptance:

- New readers and creators cannot proceed without required consent.
- Consent history is queryable per user and document version.

## Phase 3: Creator Rights Workflow

- Add Book Rights panel in Book Settings.
- Add rights declaration to text import modal.
- Add rights declaration to asset upload flows.
- Add AI/synthetic audio disclosure fields.
- Add territory/language/audio-rights fields.

Acceptance:

- Creators can record rights provenance before publishing.
- Rights metadata follows each book and asset.

## Phase 4: Publish Gate

- Block first publish when required rights metadata is incomplete.
- Add publish attestation dialog.
- Store checklist snapshot and legal document versions.
- Add compliance badge to dashboard book cards.

Acceptance:

- UI and data-layer publish actions enforce legal readiness.
- Publish attempts create an audit trail.

## Phase 5: Reports, Takedowns, Privacy Requests

- Add report content button on book and reader pages.
- Add public takedown/contact forms.
- Add privacy request form.
- Add admin queue for reports, takedowns, and privacy requests.
- Add book statuses or moderation flags for `under_review`, `takedown_hold`, and `hidden`.

Acceptance:

- Readers and rights holders can report issues.
- Admins can track and resolve requests.

## Phase 6: Global Market Modules

- Add country/region compliance routing.
- Add cookie/privacy preference center if analytics/ads are used.
- Add jurisdiction-specific deadlines.
- Add EU/UK, US, Canada, Malaysia, and APAC launch checklists.

Acceptance:

- PageCast can turn on market-specific requirements before active marketing in each region.

