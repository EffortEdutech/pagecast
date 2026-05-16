# Legal and Compliance Platform Benchmarks for PageCast

This benchmark compares PageCast against platforms with similar risk patterns. It is product guidance, not legal advice.

## Closest Platform Types

PageCast is not exactly one existing category. It combines:

- YouTube-style user publishing: creators upload public content and third parties may report infringement.
- KDP/Google Play Books-style ebook publishing: books need metadata, rights, quality rules, public-domain handling, and content review.
- ACX/Spotify for Authors-style audiobook publishing: creators must control audio rights, narrator/voice rights, territories, and distribution permissions.
- Wattpad-style story community: original stories, fan-fiction/plagiarism risk, creator-owned content, and reader reporting.

## Benchmarks

### YouTube

Useful for:

- Copyright takedown workflow.
- Copyright strikes.
- Counter-notification workflow.
- Repeat-infringer policy.
- Public reporting and content moderation operations.

What to copy for PageCast:

- A visible copyright complaint form.
- A repeat-infringer policy.
- Takedown and counter-notice workflow.
- Creator notifications when content is removed.
- Appeal/counter-notice process.
- Clear separation between copyright takedowns and general content-policy reports.

What not to copy yet:

- Automated Content ID. PageCast likely does not have enough scale or reference data for this initially.

PageCast equivalent:

- Copyright strike on a book/asset.
- Hide or unpublish book after valid notice.
- Repeat infringement can suspend creator publishing.

### Amazon KDP

Useful for:

- Ebook publishing rules.
- Public-domain restrictions.
- Metadata quality.
- Customer experience standards.
- Rights proof and post-publication review.

What to copy for PageCast:

- Require creators to confirm they own or control publishing rights.
- Reject/remove content that infringes copyright or misleads customers.
- Require public-domain books to include added value, provenance, or differentiated presentation.
- Reserve right to request proof of rights.
- Treat metadata, title, cover, and description as part of compliance.

PageCast equivalent:

- Book Settings rights panel.
- Metadata review before publish.
- Public-domain source and jurisdiction fields.
- “Freely available online” is not automatically allowed.

### ACX / Audible

Useful for:

- Audiobook-specific rights.
- Rights holder model.
- Audio production agreements.
- Territory/language concepts.
- Audio rights separate from ebook/print rights.

What to copy for PageCast:

- Require creator to confirm they control audio rights, not just text rights.
- Track territory, language, and distribution rights.
- Separate manuscript copyright from audiobook/sound recording rights.
- Track narrator/producer permissions if human narration is uploaded.

PageCast equivalent:

- `book_rights` should include text rights and audio adaptation rights.
- `asset_rights` should track uploaded narration, music, SFX, and cover art.
- Voice/TTS page should require custom voice consent if voice cloning is added.

### Spotify for Authors / Spotify Audiobooks

Useful for:

- Audiobook purchases.
- Author/publisher profile tools.
- Direct publishing and distribution terms.
- User access can be revoked for legal claims.

What to copy for PageCast:

- Make clear that creators retain ownership but grant PageCast platform/distribution rights.
- State that PageCast can remove or revoke access to content after valid legal claims.
- Require creators to promise they have rights, permissions, consents, and approvals.
- Keep audiobook metadata and copyright ownership fields.

PageCast equivalent:

- Creator Terms license grant.
- Reader purchase terms allowing removal/refund handling if a legal claim forces takedown.

### Google Play Books

Useful for:

- Publisher content policy.
- Content review.
- Temporary disabling during policy review.
- Copyright complaint routing.

What to copy for PageCast:

- Temporarily disable preview/access while a book is under serious copyright review.
- Give policy enforcement team/admin tools.
- Route legal claims separately from general support.

PageCast equivalent:

- `takedown_hold` status.
- Admin compliance queue.
- Claimant and creator notices.

### Apple Books

Useful for:

- Content dispute form.
- DRM/copyright support page.

What to copy for PageCast:

- Simple official content dispute page.
- Clear path for rights holders to submit claims.

PageCast equivalent:

- `/legal/copyright`
- `/legal/report`

### Wattpad

Useful for:

- Story-sharing community expectations.
- Creator ownership messaging.
- Plagiarism/fan-fiction risk.
- Practical limitation: platforms cannot manually pre-screen every story.

What to copy for PageCast:

- State creators keep ownership.
- Require creators not to upload content they do not own or have permission to use.
- Offer copyright license choices later if PageCast supports free/social publishing.
- Provide plagiarism/reporting tools.

What to improve beyond Wattpad:

- PageCast should collect rights metadata before monetized publishing, because PageCast includes paid books and audio adaptation, which raise risk.

## What PageCast Should Adopt

### Reader-Facing

- Terms of Service.
- Privacy Policy.
- Copyright Policy.
- Refund/Purchase Terms.
- Report Content button.
- AI-generated/synthetic audio disclosure where applicable.
- Attribution/license notes on book pages when relevant.

### Creator-Facing

- Creator Terms.
- Rights declaration before import.
- Rights declaration before asset upload.
- Book rights panel.
- Asset rights panel.
- Publish attestation.
- AI voice/TTS consent warning.
- Territory/language/audio-rights fields.

### Admin-Facing

- Takedown queue.
- Content report queue.
- Repeat-infringer tracking.
- Rights proof request workflow.
- `takedown_hold` / `hidden` / `published` statuses.
- Privacy/data request queue.

## Practical Policy Model

PageCast should publish these legal documents:

- Reader Terms.
- Creator Terms.
- Privacy Policy.
- Cookie Policy if analytics/ads are used.
- Copyright and Takedown Policy.
- Content Guidelines.
- AI and Synthetic Audio Disclosure Policy.
- Purchase/Refund Terms.

## Product Enforcement Model

Recommended states:

- `draft`: only creator can see.
- `needs_rights_info`: cannot publish.
- `ready_to_publish`: compliance fields complete.
- `published`: visible in store.
- `under_review`: content report or admin review.
- `takedown_hold`: hidden because of legal claim.
- `archived`: creator or admin removed.

Recommended creator account actions:

- warning
- rights proof requested
- publishing paused
- content removed
- payout held for disputed content
- account suspended

## Sources Reviewed

- YouTube Help: copyright removal requests and copyright management tools.
- Amazon KDP: Content Guidelines and Guide to Kindle Content Quality.
- ACX: rights holder workflow, rights holder checklist, and book posting agreement.
- Spotify: Audiobook Purchase Terms, Spotify for Authors upload/support pages, and Spotify for Authors Terms.
- Google Play Books Partner Center: Publisher Content Policies.
- Apple Books Partner Support: Copyright and digital rights management/content dispute.
- US Copyright Office: DMCA designated agent information.

