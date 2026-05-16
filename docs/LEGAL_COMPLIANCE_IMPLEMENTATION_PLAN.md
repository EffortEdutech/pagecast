# PageCast Legal and Compliance Implementation Plan

This is product and engineering planning, not legal advice. Because PageCast is marketed worldwide, the final copy and workflows should be reviewed by counsel familiar with the launch markets, especially Malaysia, the EU/UK, the US, Canada, Australia, and any country where paid creator monetization is promoted.

Primary references checked:

- Malaysia Personal Data Protection Commissioner: 7 PDPA principles.
- Malaysia Personal Data Protection (Amendment) Act 2024 notice.
- MyIPO Copyright Act resources.
- WIPO Lex hosted text for Malaysia Copyright Act 1987.
- European Commission GDPR guidance on personal data rights and consent.
- European Commission Digital Services Act guidance for online platforms.
- AI Act Service Desk / European Parliament guidance on AI-generated content transparency.
- California Attorney General CCPA/CPRA guidance.
- US FTC COPPA guidance for online services directed to children under 13 or with actual knowledge of child users.
- US Copyright Office DMCA designated-agent guidance.
- Office of the Privacy Commissioner of Canada PIPEDA guidance.

## Goals

- Make rights ownership, privacy, consent, and user trust visible inside the actual product flow.
- Reduce copyright and PDPA risk before books, audio, images, and user data enter the platform.
- Keep readers informed without blocking normal reading.
- Make creators accountable for uploaded content without making the studio painful to use.
- Create audit trails for consent, licenses, takedowns, publishing, and data requests.
- Use one high-trust global baseline, with jurisdiction-specific modules layered by user country, creator country, and market availability.

## Global Compliance Strategy

PageCast should not build one-off compliance only for Malaysia. The safer architecture is:

1. Global baseline for all users.
2. Stronger notices/rights when a user is in a stricter jurisdiction.
3. Market-specific operational controls before selling, advertising, or onboarding creators in that market.

### Global Baseline for Everyone

- Privacy notice before collecting personal data.
- Terms of Service for readers.
- Creator Terms for creators.
- Copyright Policy and takedown/report process.
- Separate marketing consent.
- Clear payment/refund/subscription terms.
- Data request form for access, correction, deletion, and consent withdrawal.
- Content report button on every public book and reader surface.
- Creator rights declarations for books and assets.
- Publish attestation before any book goes live.
- Audit logs for consent, policy versions, rights declarations, reports, and takedowns.
- Security baseline: least privilege, RLS, encrypted transport, secret management, no API key logging, dependency monitoring.

### Jurisdiction Modules

- Malaysia: PDPA principles, privacy notice, consent, disclosure limits, security, retention, data integrity, access/correction, cross-border transfer review.
- EU/EEA: GDPR rights, lawful basis, cookie consent where needed, data processing agreements, international transfer mechanism, breach workflow, DSA notice-and-action if PageCast qualifies as an online platform in the EU.
- UK: UK GDPR/Data Protection Act expectations, Children's Code if the service is likely to be accessed by children.
- US: state privacy laws where thresholds are met, CCPA/CPRA for California where applicable, DMCA safe-harbor workflow, COPPA if directed to children under 13 or actual knowledge of under-13 users.
- Canada: PIPEDA-style consent, access, correction, safeguards, openness, accountability.
- Australia/New Zealand/Singapore/other APAC: privacy notice, consent/collection limits, cross-border transfer and breach-response obligations according to launch market.
- AI/TTS: EU AI Act-style transparency for synthetic audio/content, provider terms compliance, voice consent where voices are cloned or custom-trained.

## Market Launch Gate

Before actively marketing in a country or region, complete this gate:

- Confirm privacy law applicability and thresholds.
- Confirm copyright/takedown requirements.
- Confirm consumer protection/refund/payment rules.
- Confirm child/minor rules.
- Confirm tax/payment/creator payout implications.
- Confirm whether local representative, DPO, or data-protection contact is needed.
- Confirm cross-border data transfer mechanism.
- Confirm policy language availability if local-language notices are required or commercially expected.

Recommended launch order:

1. Global baseline in English.
2. Malaysia + general international users.
3. EU/UK readiness before targeted EU/UK marketing.
4. US readiness before targeted US marketing, especially DMCA/COPPA/CCPA.
5. Canada/Australia/Singapore modules as paid marketing expands.

## Where Compliance Should Appear

### Public Reader Surfaces

- Footer on marketing/store pages:
  - Privacy Policy
  - Terms of Service
  - Copyright Policy
  - Content Removal / Takedown
  - Contact / Data Request

- Signup and login:
  - Required acceptance of Terms and Privacy Policy.
  - Optional marketing consent, separate from account consent.
  - Link to privacy notice before submitting personal data.
  - Country/region capture or inference for compliance routing, with manual correction in account settings.

- Checkout and pricing:
  - Clear payment terms before Stripe checkout.
  - Refund policy link.
  - Subscription renewal/cancellation terms if subscriptions launch.

- Book landing page:
  - Content rating, language, author/creator name, price/free status.
  - Attribution/license notes when relevant.
  - Report content button.

- Reader engine:
  - Report content button in menu.
  - Accessibility/privacy note for reading progress sync.
  - Child mode privacy/content safeguards if marketed for children.

- Account/library area:
  - Privacy settings.
  - Download/access personal data request.
  - Correct profile data.
  - Delete/deactivate account request.
  - Marketing consent toggle.
  - Cookie/privacy preference center where cookies or analytics are used.

### Creator Studio Surfaces

- Creator signup/onboarding:
  - Creator Terms acceptance.
  - Copyright ownership warranty.
  - AI/TTS voice usage acknowledgment.
  - Payment/revenue terms if monetization is enabled.
  - Creator country and payout country capture.

- Dashboard:
  - Compliance status badge per book: Draft, Needs Rights Info, Ready for Review, Published, Takedown Hold.

- Book settings:
  - Rights metadata section:
    - Content ownership: Original, Licensed, Public Domain, Commissioned, AI-generated, Mixed.
    - Copyright owner.
    - Source/proof notes.
    - Attribution text.
    - License expiry.
    - Public-domain basis and jurisdiction.
  - Content rating and audience suitability.

- Text import modal:
  - Short reminder: only import text you own or have permission to use.
  - Checkbox for large imports: "I have the rights to import and adapt this text."
  - Store acceptance timestamp.

- Asset upload modal:
  - Rights declaration per uploaded file.
  - File source/license/proof fields.
  - File type and size validation.
  - Warning for music/SFX needing both composition and recording rights.

- Voice/TTS settings:
  - Provider terms reminder.
  - Voice cloning prohibition unless explicit consent exists.
  - If custom/cloned voices are added later: consent upload and speaker identity fields.
  - Synthetic audio disclosure setting for books that use AI-generated narration.

- Publish dialog:
  - Mandatory rights checklist before first publish.
  - Privacy/content checklist:
    - No personal data included without consent.
    - No copyrighted third-party material without rights.
    - Content rating completed.
    - Asset licenses recorded.
  - Final publish attestation stored as immutable audit record.

- Settings / Legal Center:
  - Creator Terms
  - Privacy Policy
  - Copyright Policy
  - Takedown Process
  - Data Processing summary
  - AI-generated audio/content disclosure policy
  - Contact support/legal

### Admin and Operations Surfaces

- Admin compliance queue:
  - Books missing rights metadata.
  - Reported content.
  - Takedown requests.
  - Repeat-infringer tracking.
  - Suspended/hidden books.

- Data request queue:
  - Access request.
  - Correction request.
  - Account deletion request.
  - Consent withdrawal.
  - Region-specific statutory deadline tracking.

- Audit logs:
  - Terms acceptance.
  - Privacy notice acceptance.
  - Marketing consent changes.
  - Rights declarations.
  - Publish attestations.
  - Takedown/report actions.
  - Admin moderation decisions.

## Data Model Additions

### Policies and Consent

- `legal_documents`
  - `id`
  - `type`: `terms`, `privacy`, `creator_terms`, `copyright_policy`, `refund_policy`
  - `version`
  - `title`
  - `content`
  - `published_at`
  - `effective_at`

- `user_consents`
  - `id`
  - `user_id`
  - `document_type`
  - `document_version`
  - `accepted_at`
  - `ip_address`
  - `user_agent`
  - `consent_context`: `signup`, `creator_onboarding`, `checkout`, `publish`
  - `country_code`
  - `region_code`

- `marketing_consents`
  - `id`
  - `user_id`
  - `status`
  - `updated_at`
  - `source`

- `privacy_requests`
  - `id`
  - `user_id`
  - `email`
  - `country_code`
  - `request_type`: `access`, `correction`, `deletion`, `portability`, `withdraw_consent`, `opt_out_sale_share`
  - `status`
  - `statutory_deadline_at`
  - `details`
  - `created_at`
  - `completed_at`

### Content Rights

- `book_rights`
  - `book_id`
  - `rights_category`
  - `copyright_owner`
  - `source_url`
  - `license_type`
  - `license_notes`
  - `attribution_text`
  - `public_domain_basis`
  - `jurisdiction`
  - `license_expires_at`
  - `declared_by`
  - `declared_at`
  - `contains_ai_generated_content`
  - `contains_synthetic_audio`
  - `ai_disclosure_text`

- `asset_rights`
  - `asset_id`
  - `book_id`
  - `rights_category`
  - `copyright_owner`
  - `source_url`
  - `license_type`
  - `attribution_text`
  - `proof_file_url`
  - `declared_by`
  - `declared_at`

- `publish_attestations`
  - `id`
  - `book_id`
  - `creator_id`
  - `checklist_snapshot`
  - `document_versions`
  - `attested_at`

### Reports and Requests

- `content_reports`
  - `id`
  - `book_id`
  - `block_id`
  - `reporter_user_id`
  - `reporter_email`
  - `reason`
  - `details`
  - `status`
  - `created_at`
  - `resolved_at`

- `takedown_requests`
  - `id`
  - `claimant_name`
  - `claimant_email`
  - `book_id`
  - `asset_id`
  - `claim_type`
  - `evidence`
  - `status`
  - `created_at`
  - `resolved_at`

- `data_subject_requests`
  - `id`
  - `user_id`
  - `email`
  - `request_type`: `access`, `correction`, `deletion`, `withdraw_consent`
  - `status`
  - `details`
  - `created_at`
  - `completed_at`

- `jurisdiction_profiles`
  - `country_code`
  - `region_code`
  - `privacy_module`
  - `requires_cookie_consent`
  - `requires_child_privacy_gate`
  - `requires_dmca_flow`
  - `requires_dsa_flow`
  - `requires_ai_disclosure`
  - `updated_at`

## Implementation Phases

### Phase 1: Baseline Legal Presence

- Add public legal pages to reader app:
  - `/legal/privacy`
  - `/legal/terms`
  - `/legal/copyright`
  - `/legal/refund`
  - `/legal/contact`
- Add `/legal/ai-disclosure` for synthetic narration/content disclosures.
- Add footer links to landing, store, pricing, login, book pages.
- Add Terms/Privacy acceptance checkbox to reader signup/login where signup exists.
- Add Creator Terms and Copyright warranty to creator onboarding/login flow.
- Add basic Report Content form from book page and reader page.
- Add country/region field to account settings for compliance routing.

Acceptance:

- Users can see legal documents before submitting personal data.
- Readers can report a book.
- Creators must acknowledge creator/copyright terms before using studio.

### Phase 2: Creator Rights Workflow

- Add rights metadata panel to Book Settings.
- Add rights declaration to Text Import modal.
- Add rights declaration to Asset Upload flows.
- Add publish checklist and publish attestation record.
- Add compliance badge on creator dashboard/book cards.

Acceptance:

- A book cannot be published until rights metadata and publish attestation are complete.
- Asset uploads collect source/license information.
- Publish action stores a timestamped snapshot of the creator's attestation.

### Phase 3: PDPA Controls

- Add account privacy settings.
- Add marketing consent toggle.
- Add data request form.
- Add retention policy implementation notes for accounts, logs, purchases, uploaded assets, and deleted books.
- Ensure sensitive API keys are not logged or stored server-side unless explicitly intended.
- Generalize this phase into privacy-rights controls that also support GDPR, UK GDPR, CCPA/CPRA, PIPEDA, and similar laws.

Acceptance:

- Users can request access, correction, deletion, or consent withdrawal.
- Consent history is versioned.
- Privacy notice versions are tracked.

### Phase 4: Admin and Operational Compliance

- Build admin queue for content reports, takedown requests, and data requests.
- Add status changes for books: `published`, `hidden`, `takedown_hold`, `archived`.
- Add repeat-infringer tracking.
- Add moderation notes and audit logs.
- Add region-specific deadline tracking for privacy requests and takedown/report workflows.

Acceptance:

- Admins can hide reported content.
- Takedown and data requests have statuses, owner, timestamps, and resolution notes.
- Repeat-infringer policy can be enforced.

### Phase 5: Hardening and Review

- Legal review of all policy copy and consent language for each active launch market.
- Security review of RLS policies and API routes.
- Automated tests for publish gate, report form, consent recording, and rights validation.
- Accessibility review for legal/consent flows.
- Data map and vendor review for Supabase, Stripe, hosting, TTS providers, analytics, support, and email tools.

Acceptance:

- Production launch checklist includes legal signoff.
- CI includes unit tests, build, and dependency audit.
- No book can bypass required rights checks through UI or API.

## Suggested First Build Tickets

1. Add static legal pages and footer links in reader app.
2. Add creator legal center page in creator studio.
3. Add `legal_documents` and `user_consents` migrations.
4. Add creator copyright attestation to onboarding.
5. Add `book_rights` migration and Book Settings rights panel.
6. Add publish gate requiring rights metadata and attestation.
7. Add report content form and `content_reports` table.
8. Add automated tests for publish gate and consent-required flows.
9. Add country/region compliance routing.
10. Add AI/synthetic audio disclosure fields and reader-facing labels.
11. Add privacy request queue with statutory deadline tracking.
