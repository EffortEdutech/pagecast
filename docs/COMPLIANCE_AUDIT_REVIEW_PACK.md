# PageCast Compliance Audit Review Pack

Prepared for legal, privacy, security, and launch review.

## Scope

This pack covers the PageCast reader app, Creator Studio, legal intake surfaces, creator publishing controls, admin compliance workflows, consent tracking, privacy deadlines, exports, and retention review.

This is a product/legal operations baseline. It is not a substitute for advice from qualified counsel in each launch market.

## Control Inventory

| Area | Implemented control | Main files |
| --- | --- | --- |
| Legal policies | Public legal center with Privacy, Reader Terms, Creator Terms, Copyright, Refund, AI Disclosure, Contact | `apps/reader-app/src/app/legal/*` |
| Versioned policies | Current legal document versions seeded into `legal_documents` | `docs/migrations/016_legal_document_versions.sql` |
| Consent capture | Reader and creator consent modals write `user_consents` | `apps/reader-app/src/components/ConsentGate.tsx`, `apps/creator-studio/src/components/ConsentGate.tsx` |
| Cookie/preferences UX | Visitor privacy preference banner with necessary/custom/accept-all choices | `apps/reader-app/src/components/RegionalPrivacyBanner.tsx` |
| Signup regional context | Country, region, age confirmation, marketing opt-in, signup consent context | `docs/migrations/018_regional_ux_controls.sql`, `apps/reader-app/src/app/login/page.tsx` |
| Marketing consent | Marketing opt-in/out recorded in `marketing_consents` | `apps/reader-app/src/lib/supabase/preferences.ts` |
| Creator rights metadata | Book rights, audio rights, territory, language rights, attribution, AI/synthetic disclosure | `apps/creator-studio/src/components/editor/BookSettingsPanel.tsx` |
| Asset rights metadata | Upload/import rights declaration for audio, music, SFX, and images | `apps/creator-studio/src/components/editor/AssetRightsDeclaration.tsx` |
| Publish gate | Publishing blocked until required rights/compliance fields are satisfied | `apps/creator-studio/src/hooks/useBooks.ts`, `apps/creator-studio/src/app/(studio)/studio/[bookId]/page.tsx` |
| Public legal intake | Report, takedown, and privacy forms | `apps/reader-app/src/app/legal/*` |
| Intake hardening | Server-side validation, field truncation, UUID checks, basic rate limit | `apps/reader-app/src/app/api/legal/request/route.ts` |
| Admin queue | Compliance queue for reports, takedowns, privacy requests | `apps/creator-studio/src/app/(studio)/compliance-queue/page.tsx` |
| Case files | Case detail view with submitted facts, status, evidence, history, related rights | `apps/creator-studio/src/app/(studio)/compliance-queue/[kind]/[id]/page.tsx` |
| Evidence records | Admin evidence/proof table and UI | `docs/migrations/014_compliance_case_evidence.sql` |
| Audit logs | Status updates write `compliance_action_logs` | `apps/creator-studio/src/app/api/compliance/status/route.ts` |
| Notification outbox | Notification records saved; email skipped when no provider configured | `docs/migrations/013_compliance_action_log_notifications.sql` |
| Privacy SLA | SLA rules, deadline trigger, dashboard for overdue/due soon requests | `docs/migrations/015_privacy_request_sla.sql`, `apps/creator-studio/src/app/(studio)/compliance-sla/page.tsx` |
| Exports | Admin CSV export endpoint and records page | `apps/creator-studio/src/app/api/compliance/export/route.ts`, `apps/creator-studio/src/app/(studio)/compliance-records/page.tsx` |
| Retention review | Retention rules and non-destructive review flags | `docs/migrations/017_compliance_exports_retention.sql` |

## Database Migration Chain

The legal/compliance baseline depends on:

- `011_global_legal_compliance.sql`
- `012_compliance_admin_policies.sql`
- `013_compliance_action_log_notifications.sql`
- `014_compliance_case_evidence.sql`
- `015_privacy_request_sla.sql`
- `016_legal_document_versions.sql`
- `017_compliance_exports_retention.sql`
- `018_regional_ux_controls.sql`

## Counsel Review Questions

- Are the current Privacy Policy, Reader Terms, Creator Terms, Copyright/Takedown Policy, Refund Terms, and AI Disclosure acceptable for each planned launch market?
- Should PageCast use country-specific policy text or a single global policy with modules?
- Are the seeded privacy SLA rules correct for each target market and request type?
- Are retention periods appropriate for copyright claims, privacy requests, consent records, and admin audit logs?
- What evidence is required for rights-holder takedowns and creator counter-notices?
- What is the minimum age or guardian-consent model for PageCast readers in each market?
- Does synthetic voice/audio disclosure meet the requirements of the markets and providers PageCast uses?
- Should public-domain content require jurisdiction-specific public-domain proof before publication?
- Should PageCast add a formal repeat-infringer policy before launch?
- Does marketing consent handling meet email/SMS/platform marketing rules for target markets?

## Residual Risks

- Public legal intake rate limiting is in-memory. Production should use durable rate limiting or firewall rules.
- Evidence upload is not yet implemented; current evidence supports notes and URLs only.
- Email delivery is not active because Resend/SMTP is intentionally skipped.
- Cookie preference storage is local browser storage, not server-side consent storage.
- Legal document content is a product baseline and still needs counsel drafting/review.
- Admin role assignment still depends on database role values; operational process should be defined.
- No automated deletion/archive jobs exist for retention; dashboard flags review only.

## Launch Recommendation

PageCast has a strong compliance operations foundation for beta/internal launch and counsel review. For broad worldwide marketing, complete counsel review, durable rate limiting, evidence upload controls, and final market-specific legal text first.
