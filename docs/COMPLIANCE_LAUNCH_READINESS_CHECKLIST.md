# PageCast Compliance Launch Readiness Checklist

Use this checklist before a public worldwide launch.

## Required Before Public Marketing

- [ ] Counsel approves Privacy Policy, Reader Terms, Creator Terms, Copyright/Takedown Policy, Refund Terms, AI Disclosure, and Legal Contact.
- [ ] Counsel approves launch countries and any country-specific notices.
- [ ] Admin account assignment process is documented.
- [ ] At least two trusted admins can access `/compliance-queue`, `/compliance-sla`, and `/compliance-records`.
- [ ] Public legal forms are smoke-tested in production.
- [ ] CSV exports are smoke-tested in production.
- [ ] Privacy SLA rules are reviewed and updated for launch countries.
- [ ] Retention rules are reviewed and updated by counsel.
- [ ] Creator publish gate is tested with original, licensed, public-domain, AI-generated, and synthetic-audio cases.
- [ ] Rights proof/evidence workflow is tested by an admin.

## Security And Abuse Controls

- [ ] Replace in-memory legal intake rate limit with durable rate limiting.
- [ ] Add bot protection if spam appears.
- [ ] Confirm Supabase RLS policies block non-admin queue access.
- [ ] Confirm non-admin users cannot export CSV records.
- [ ] Confirm legal request details and emails are not logged to public logs.
- [ ] Configure production monitoring for API errors on legal/admin routes.

## Operational Readiness

- [ ] Decide who receives legal/privacy notifications while email automation is skipped.
- [ ] Define takedown review playbook.
- [ ] Define privacy request identity verification playbook.
- [ ] Define counter-notice process.
- [ ] Define data breach response owner and escalation path.
- [ ] Define retention review cadence.
- [ ] Define process for updating legal document versions and forcing re-consent.

## Nice To Have Before Scale

- [ ] Private evidence file upload with signed URLs.
- [ ] Email provider integration for compliance notifications.
- [ ] Admin note categories and assignment/owner fields.
- [ ] Automated reminders for privacy SLA deadlines.
- [ ] Export bundle per case file.
- [ ] Region-specific cookie preference persistence to server-side consent records.
