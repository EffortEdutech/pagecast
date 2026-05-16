# PageCast Testing and Legal Readiness Checklist

This checklist is scoped to the current two-app Next.js workspace:

- `apps/creator-studio`: creator dashboard, text/PDF import, block editor, voices, assets, TTS, publishing.
- `apps/reader-app`: store, book landing pages, paid/free access, library, reader engine, playback, progress.

## Functional Testing

- Creator auth: login, callback handling, protected studio routes, logout.
- Creator dashboard: load author books, create book, duplicate book, delete book confirmation, publish/unpublish.
- Book settings: title, description, cover, genre, age rating, language, price, free/paid toggle, narrator-only mode.
- Text import: prose, script, markdown, PageCast tags, single-line PDF extraction, malformed input, empty input, large paste.
- PDF import: valid PDF, scanned/non-text PDF, very large PDF, corrupted PDF, rejected file types.
- Editor blocks: add, edit, delete, reorder, chapter/scene add/delete/rename, character assignment, voice assignment.
- Audio: upload recorded audio, delete audio, preview audio, generated TTS success/error states, missing API key, provider errors.
- Assets: upload image/audio, file type limits, file size limits, preview, delete, storage permissions.
- Publish pipeline: QA gate for missing audio, status update, published book appears in reader store, unpublished book disappears.
- Reader store: browse published books, free book access, paid book checkout, failed checkout, webhook-created purchase, library unlock.
- Reader engine: all block types render, play/pause, skip, speed, volumes, reading/audiobook/cinematic modes, resume progress.
- Sync: Supabase progress/bookmarks sync, local fallback, unauthenticated behavior, non-UUID demo/story guards.

## Usability and UI/UX Testing

- First-run creator flow is understandable from login to first published story.
- Common creator task path: create book -> import text -> assign voices -> preview -> publish.
- Common reader task path: discover book -> inspect landing page -> acquire -> read/listen -> resume later.
- Empty, loading, success, warning, and error states are visible and actionable.
- Forms show validation before destructive or paid actions.
- Touch targets work on mobile and tablet widths.
- Keyboard navigation reaches core controls, dialogs trap focus, Escape closes modals.
- Text is readable across dark/light/sepia themes and dyslexia font mode.
- Long titles, long author names, and long block text do not overflow.
- Audio controls communicate current state without relying on color only.

## Compatibility Testing

- Desktop widths: 1440, 1280, 1024.
- Tablet widths: 834, 768.
- Mobile widths: 430, 390, 360.
- Browsers: Chromium first for automation; then manual smoke in Safari and Firefox.
- OS/device smoke: Windows desktop, macOS Safari, iOS Safari, Android Chrome.
- Input modes: mouse, keyboard, touch, screen reader basics.
- Browser APIs: Web Speech API unavailable, autoplay blocked, localStorage blocked, cookies disabled.
- Network: offline, slow 3G, intermittent upload, expired Supabase session.

## Performance and Network Testing

- Landing/store page first load and route transitions.
- Creator studio load time with many books and a long manuscript.
- Editor responsiveness with hundreds of blocks.
- Reader engine responsiveness with long chapters and scene media.
- TTS route timeout, provider 4xx/5xx, retry behavior, credit accounting.
- Storage uploads under poor network conditions.
- Stripe checkout redirect latency and webhook idempotency.
- Bundle size review for PDF/TTS/editor dependencies.
- Console and network error scan during core flows.

## Security Testing

- Supabase RLS: creators can only read/write their own drafts and assets.
- Published book read policy exposes only intended published content.
- Reader access gate blocks unpaid paid books without purchase/subscription.
- Preview bypass is restricted to intended creator/studio contexts.
- Service role key is never exposed to the browser.
- TTS API keys are not logged, persisted server-side, or returned in errors.
- File upload validation covers MIME type, extension, size, path traversal, and overwrite behavior.
- Stripe webhook validates signatures and is idempotent.
- API routes validate request bodies and reject malformed JSON.
- XSS checks for imported manuscript text, titles, descriptions, character names, and asset labels.
- Dependency audit is tracked. Next.js was bumped from `14.2.5` to `14.2.35`, which removed the critical audit finding; npm still reports 5 remaining moderate/high advisories per app that require a breaking Next/eslint-config upgrade path to fully clear.

## Automated Tests Started

- `apps/creator-studio/src/lib/textParser.test.ts`: parser normalization, prose parsing, PageCast tags, export formatting.
- `apps/reader-app/src/lib/format.test.ts`: reader price formatting.
- `apps/reader-app/src/store/readerStore.test.ts`: ownership, progress, bookmarks, playback state reset.

## Legal and Compliance Handling

This is product-risk guidance, not legal advice. Before public launch, have Malaysian counsel review the final privacy notice, content terms, creator agreement, and data-processing setup.

Primary references checked: Malaysia Personal Data Protection Commissioner guidance on the 7 PDPA principles, the Personal Data Protection (Amendment) Act 2024 notice, MyIPO's Copyright Act resources, and WIPO Lex's hosted Malaysia Copyright Act 1987 text.

### Copyright and Content Rights

- Require creators to confirm they own or have licensed every uploaded manuscript, image, music, SFX, and voice/audio file.
- Add content provenance fields per book/asset: original, licensed, public domain, commissioned, AI-generated, or third-party.
- Store license evidence: source URL, license type, author/owner, purchase receipt, permission document, attribution text, and expiry if any.
- Do not treat "found online" as usable content.
- For public-domain works, record jurisdiction, author death/publication facts, edition used, and proof source. Public domain differs by country.
- For adapted works, translations, abridgements, dramatizations, and narrated versions, check whether separate rights are needed.
- For music/SFX, track both composition and sound-recording rights.
- For AI voice/TTS, follow provider terms and do not clone voices without explicit consent.
- Add notice-and-takedown workflow: report form, temporary disable path, evidence review, counter-notice path, repeat-infringer policy.

### Malaysia PDPA

- Publish a privacy notice before collecting personal data.
- Collect only necessary account, payment, analytics, and creator-payout data.
- Obtain consent where required and keep consent records.
- Explain purposes: account creation, purchases, story publishing, analytics, support, fraud prevention, TTS/storage providers.
- Limit disclosure to needed processors: Supabase, Stripe, TTS providers, hosting, analytics, support tools.
- Apply security controls: access control, RLS, encryption in transit, secret management, logging hygiene, least privilege.
- Define retention periods for accounts, purchases, uploaded assets, logs, support tickets, and deleted books.
- Provide access/correction request handling for users.
- Keep data accurate and let users update profile/billing details where practical.
- Handle cross-border processing because hosting/payment/TTS vendors may process outside Malaysia.
- Prepare breach response and notification workflow aligned to current PDPA amendments and JPDP guidance.

## Recommended Next Automation

- Add Playwright E2E smoke tests for both apps once stable test credentials/env vars are available.
- Add API route tests for Stripe checkout/webhook and book access with mocked Supabase/Stripe.
- Add upload validation tests for PDF/audio/image routes.
- Add accessibility checks with `@axe-core/playwright` for core pages.
- Add CI scripts: lint, unit tests, build, dependency audit, and E2E smoke.
