# PageCast Compliance Manual Test Script

Run this script after migrations and before release.

## Reader Legal Forms

1. Open `/legal/report`.
2. Submit a content report with a reason and details.
3. Open Creator Studio `/compliance-queue`.
4. Confirm the report appears.
5. Open the case file and add evidence.
6. Change status to `reviewing`.
7. Confirm action log and notification outbox record appear.

## Takedown Request

1. Open `/legal/takedown`.
2. Submit claimant name, email, claim type, and evidence.
3. Confirm it appears in `/compliance-queue`.
4. Open the case file.
5. Add a rights proof evidence URL.
6. Change status to `reviewing`.

## Privacy Request And SLA

1. Open `/legal/privacy-request`.
2. Submit a request with country `MY`.
3. Confirm deadline is about 21 days.
4. Submit a request with country `US`, region `CA`.
5. Confirm deadline is about 45 days.
6. Open `/compliance-sla`.
7. Confirm open requests are sorted by urgency.

## Consent Tracking

1. Log in as a reader with no consent records.
2. Confirm consent modal appears.
3. Accept and continue.
4. Refresh and confirm it does not reappear.
5. Log in as a creator with no consent records.
6. Confirm creator consent modal appears.
7. Accept and confirm `user_consents` contains required records.

## Regional UX

1. Open reader app in a fresh/incognito browser.
2. Confirm privacy preferences banner appears.
3. Choose necessary only.
4. Refresh and confirm banner does not reappear.
5. Clear local storage and test custom choices.

## Creator Publish Gate

1. Create or open a draft Cast.
2. Leave rights category unspecified.
3. Attempt to publish and confirm gate blocks publication.
4. Add rights category, owner/source details as applicable, audio rights confirmation, and AI disclosure if needed.
5. Publish and confirm publish attestation is recorded.

## Admin Exports And Retention

1. Open `/compliance-records`.
2. Export content reports CSV.
3. Export user consents CSV.
4. Confirm non-admin account cannot open the page or export endpoint.
5. Confirm retention review table loads active rules.

## Public Intake Rate Limit

1. Submit more than five legal requests of the same type within ten minutes from the same browser/IP.
2. Confirm later requests return a friendly error.
3. Wait for the rate limit window and confirm submission works again.
