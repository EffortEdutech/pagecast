# PageCast Compliance Production Hardening

This checklist captures the remaining production controls around the legal and compliance surfaces.

## Implemented Baseline

- Public legal intake goes through `/api/legal/request`.
- Public intake validates required fields, truncates oversized input, rejects invalid UUID references, and applies a basic IP/kind rate limit.
- Admin compliance exports require an authenticated `profiles.role = 'admin'`.
- Admin status updates require `profiles.role = 'admin'`, write action logs, and record notification outcomes.
- Compliance records are flagged for retention review, not deleted automatically.

## Before Launch

- Move public legal intake rate limiting to durable infrastructure such as Upstash Redis or Vercel Firewall rules.
- Add bot protection or turnstile/captcha to public legal forms if spam appears.
- Add upload storage for case evidence with signed URLs, file type allow-listing, and malware scanning.
- Review `profiles.role = 'admin'` assignment process and restrict direct database edits to trusted operators.
- Add production log redaction for emails, details, evidence, and privacy request content.
- Review every seeded retention/SLA/legal document value with counsel before worldwide marketing campaigns.

## Evidence Upload Rules

- Keep uploads private by default.
- Store file metadata separately from public URLs.
- Allow only expected file types: PDF, PNG, JPG, TXT, DOCX.
- Prefer expiring signed URLs for admin viewing.
- Keep deletion/manual archive actions separate from normal queue handling.
