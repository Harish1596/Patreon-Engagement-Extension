# Extension Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not delegate without authorization. Steps use checkbox (`- [ ]`) syntax for tracking. This document authorizes no implementation, deployment or publication by itself.

**Goal:** Measure participating active installations and feature usage, and accept user-triggered technical problem reports, without user accounts, contact details or Patreon activity details.

**Architecture:** A background-owned telemetry module validates and queues approved events, then sends them to a small serverless relay that forwards them to GA4. GA4 provides storage and reporting; the relay has no custom database. Usage consent and individual diagnostic submissions are independent.

**Tech Stack:** Existing vanilla JavaScript MV3 extension, `chrome.storage.local`, `chrome.storage.session`, alarms, HTTPS fetch, GA4 Web Measurement Protocol, and a serverless relay. Proposed relay host: Cloudflare Workers; hosting/account/domain selection remains a deployment decision for the owner.

**Spec:** The accepted requirements and reviewed design are recorded below. The user accepted persistent random installation IDs and profile-cloning limitations; queue, retention, hosting and event defaults below are implementation proposals. Review this plan before production implementation.

## Requirements and decisions

- Never require users to log in, create an account or provide an email, including for problem reporting.
- Measure meaningful feature use, not which posts, collections, creators or pages users visit.
- Use `crypto.randomUUID()` once after usage consent; persist the ID in `chrome.storage.local`, never sync it. Use it as GA4 `client_id`, not a separate cross-device `user_id`.
- Accept profile cloning, reinstallations, multiple profiles and consent resets as limitations of installation estimates. Uninstallation clears local identity, not already submitted GA4 records.
- Usage collection is optional and off by default, including for existing installations. Do not retroactively upload pre-consent activity.
- Error reporting is explicitly user-triggered and contains only technical fields. No free text, attachments or automatic raw exception upload.
- No Patreon URLs, titles, creator names, post IDs, content, filenames, image addresses, cookies, credentials, exact document sizes, chapter counts, full user-agent strings or arbitrary stack traces in telemetry.
- The persistent ID is pseudonymous data. Do not describe the system as collecting no data or being fully anonymous.
- The network receiver necessarily sees connection metadata. Configure and document application and provider logging; never promise that infrastructure cannot see IP addresses.

## Measurement contract

An **active installation** is a consenting installation that actually applies non-default Reader customization on a visible supported post, hides a recognized engagement bar on a visible post, or initiates a user-requested export. Opening the browser or popup alone does not qualify. Hidden/background collection preparation must not qualify as Reader activity.

Count distinct usage `client_id` values over each daily, seven-day or thirty-day window in the property reporting timezone. Do not sum daily distinct counts to obtain weekly/monthly counts. Label figures **participating active installations**, never people, total installed users or all users. GA4 may estimate distinct counts, reporting may be delayed, and opt-in introduces selection bias. Error submissions must not change these counts.

| Event | Trigger | Allowed event-specific fields |
| --- | --- | --- |
| `pr_feature_used` | Actual Reader customization or bar hiding; at most once per feature per UTC day | `feature`: `reader` or `engagement_bar` |
| `pr_setting_changed` | A user commits a settings change; debounce continuous input | `control`: `reader_enabled`, `bar_hidden`, `font`, `text_size`, `post_color`, `paragraph_spacing`, `line_spacing`, `reset` |
| `pr_download_started` | One explicit post/collection export attempt | `scope`: `post`/`collection`; `format`: `pdf`/`epub`/`markdown`; `packaging`: `single`/`zip` |
| `pr_download_outcome` | One terminal result for that attempt | Same export fields; `outcome`: `complete`, `partial`, `failed`, `cancelled`, `interrupted`, `unconfirmed`; optional approved `error_code`/`stage` |
| `pr_problem_reported` | User reviews and explicitly submits diagnostics | Approved `feature`, `stage`, `error_code`; export format/packaging only when applicable; approved technical failure category where necessary |

All events carry `schema_version`, packaged `extension_version` and `event_class` (`usage` or `diagnostic`). Only diagnostics include broad `browser_family` and `browser_major`; unknown browser identification is explicitly `unknown`, not a fingerprinting exercise. Never transmit setting values or exact text-size/font selections.

Use the existing installation UUID only for usage. Each diagnostic submission uses a new random, non-persistent GA client ID even when usage is enabled. A random report/event reference is permissible for local duplicate suppression, but is not a registered custom reporting dimension and must not encode page/job/download IDs. Diagnostic-only submissions never create a persistent installation ID.

The active-installation report filters for `pr_feature_used` and `pr_download_started` with `event_class=usage`. Setting changes and diagnostic events do not qualify. Do not use the property's unfiltered default Users card. Daily suppression controls event volume, not a claim about number of pages or times read.

## Privacy, transport and retention contract

- Trusted contexts own telemetry state and identity. Restrict `storage.local` access with `setAccessLevel` only after migrating existing content-script preference reads/writes through validated background messages; do not break Reader settings to protect telemetry.
- Treat content messages as untrusted. Validate extension sender, permitted page context and complete schema without retaining sender URLs. Reject additional fields rather than forwarding arbitrary objects.
- Propose queue limits of **100 events**, **128 KiB** serialized total and **24 hours** maximum age. Apply oldest-first eviction and purge stale events before transmission.
- Use one serialized background queue mutation path and shared initialization promise. Persist across worker restarts; never create identity per worker start. Recheck consent immediately before network dispatch.
- Disabling usage revokes future collection, cancels usage uploads where possible and removes the usage ID, usage queue, daily suppression and usage session state. An in-flight request may already have arrived. Re-enabling creates a fresh ID. An explicitly submitted diagnostic remains independently authorized.
- Persist a consent revision with queued usage events; reject old-revision batches after revocation, including disable/re-enable races. Expired or cancelled consent must not be bypassed by stale content scripts.
- Proposed flush: on new queued work and a one-minute alarm while pending, with a ten-second network timeout. Retry transient relay/network failures at most three times with jittered backoff, within expiry; honor bounded `Retry-After`. Drop permanently invalid/rejected payloads. Stop alarms when no work remains.
- Fetch only a fixed HTTPS relay endpoint from the worker using `credentials: omit`, `referrerPolicy: no-referrer`, and no redirects. Ask for only the relay origin permission at consent/report time; denial must leave normal features working. No remote SDK, remote code or GA script injected into Patreon.
- Relay validates schema, UUIDs, enum values, supported schema/extension versions, payload size and allowed batch length. It constructs the GA payload itself and never forwards arbitrary headers, cookies, incoming IPs or client-supplied GA credentials/property IDs.
- Store GA secrets only as relay deployment secrets. No production secret in the repository, ZIP, URLs shown in logs or extension bundle. An endpoint is public: CORS and extension-origin checks are not authentication, and a bundled shared token is not secret. Apply provider-level request/cost limits and document residual forged-event risk without fingerprinting users.
- Relay and extension provide best-effort delivery. Use local operation/event deduplication, but do not promise exactly-once delivery without a durable deduplication store. A lost acknowledgment or worker crash can lose/duplicate events. Report totals/rates are estimates.
- Proposed GA4 settings: separate extension property from store listing; disable advertising features, Google Signals, ad personalization and ad account links; deny ad-user-data/ad-personalization consent in applicable requests; register only low-cardinality event dimensions. Never register UUIDs as custom dimensions.
- Propose **2-month user/event retention** and disable reset on new activity. This does not limit the lifetime of standard aggregated GA reports. Document separate provider logs, access controls and deletion settings before launch.
- Keep development and production properties/secrets separate. Test/unpacked builds must not silently contaminate production analytics.

## Review focus

1. Consent withdrawal racing an upload or an old tab: future usage must stop and old-revision events must not resume (Tasks 3–4).
2. Hidden collection fetch tabs and repeated SPA rendering: no artificial Reader activity or duplicate qualifying events (Task 5).
3. Worker restart or browser shutdown during export: preserve identity, bounded queue and honest unconfirmed outcomes (Tasks 3 and 5).
4. Malicious/error-shaped payloads containing URLs or private text: reject them at both extension and relay boundaries (Tasks 2–3 and 6).
5. Statistics declined but a problem explicitly reported: send approved diagnostics without persistent identity or active-count contamination (Tasks 1 and 6).

## File ownership

Proposed new files:

- `extension/shared/telemetry-schema.js`: fixed event vocabulary and sanitization/validation; no network or preferences logic.
- `extension/background/telemetry.js`: consent, identity, queue, deduplication, delivery and transport status.
- `extension/shared/telemetry-config.js`: public relay origin, schema/build mode; no secrets.
- `relay/worker.js`, `relay/wrangler.jsonc`, `relay/README.md`: stateless forwarding, deployment template and logging/limits runbook. Use a separate relay test command without making extension packaging depend on deployment.
- `tests/tooling/telemetry.test.cjs`, `tests/tooling/telemetry-relay.test.cjs`, `tests/telemetry.spec.js`: privacy, lifecycle, relay and browser behavior.
- `docs/analytics.md`: event dictionary, GA configuration, reporting definitions, proof results and operational limits.

Existing ownership remains: `background/media.js` loads modules and routes messages; `background/archives.js` knows browser-confirmed collection download state; `content/export.js` and `content/collection-export.js` own export UI; `content/reader.js` and `content/content.js` know applied Reader/bar behavior; `popup/` owns preferences. Update package allowlists in `scripts/package-extension.js` for runtime modules, excluding the relay/tests/configuration secrets.

## Task 1: Prove the GA4 metrics before building production telemetry

**Files:** Create `docs/analytics.md`; use disposable test tooling rather than production event hooks.

**Interfaces:** Establish the documented mapping from the event contract to filtered GA4 reports. Obtain property/stream identifiers and a relay hosting decision from the owner; do not fabricate or commit credentials.

- [ ] Create a development GA4 Web stream and configure permitted dimensions and privacy settings.
- [ ] Validate sample payloads against the GA validation endpoint, including UUID `client_id`. Verify session/activity requirements experimentally; do not invent engagement duration or page views to populate default GA cards.
- [ ] Submit controlled A/A/B usage events plus a one-time diagnostic identity. Verify one distinct participating installation for A, two for A+B, and unchanged usage counts after the diagnostic. Repeated A across dates must deduplicate over the combined window.
- [ ] Verify registered feature, version, stage and error-code breakdowns appear in actual processed reports; record processing delays and any thresholding/approximation.
- [ ] Record the exact report filters and result evidence, without IDs/secrets, in `docs/analytics.md`. If distinct qualifying installations cannot be reported correctly, stop and revise the design before production work.
- [ ] Commit the proof documentation. Success is verified reporting, not merely HTTP 2xx or an empty validation error list.

## Task 2: Implement the permitted schema and stateless relay

**Files:** Create `shared/telemetry-schema.js`, `relay/worker.js`, `relay/wrangler.jsonc`, `relay/README.md`, and `tests/tooling/telemetry-relay.test.cjs`; add relevant syntax/tooling commands to existing scripts as needed.

**Interfaces:** `PatreonTelemetrySchema.validateEvent(value)` returns a newly constructed approved event or `null`. Relay `POST /events` accepts `{schema_version:1, client_id, event_class, events:[...]}`; at most 20 events, at most 64 KiB request body, and one class/client identity per batch. It returns bounded generic accepted/rejected/retryable responses and no Google response body. Acknowledgment means accepted for forwarding, not verified GA ingestion.

- [ ] Write failing Node tests for valid fixtures, unknown fields, URLs/private strings in enum slots, malformed UUIDs, mixed classes, oversized requests, arbitrary upstream credentials, timeout and upstream failure.
- [ ] Run `node --test tests/tooling/telemetry-relay.test.cjs` and confirm expected failures.
- [ ] Implement the schema, relay forwarding, timeout and safe responses with fake upstream fetch tests. Document provider abuse controls, logging and residual duplication risk; no fake browser-origin authentication claims.
- [ ] Run the Node tests and relevant syntax check; assert outbound GA bodies/headers omit input IPs, user agents, credentials and disallowed properties.
- [ ] Commit the independently tested schema/relay. Production deployment is a separate owner-authorized action.

## Task 3: Implement consent, identity and bounded background delivery

**Files:** Create `background/telemetry.js`, `shared/telemetry-config.js`, `tests/tooling/telemetry.test.cjs`; modify `background/media.js`, `manifest.json` and packaging allowlist.

**Interfaces:** `PatreonTelemetry.setUsageConsent(enabled)`, `getStatus()`, `recordUsage(name, params, localContext)`, `submitDiagnostic(approvedReport)`, `flush()`. All return promises; a telemetry failure is a bounded result and never an unhandled rejection. `localContext` supports only local deduplication, owner activity and consent revision; it is never transmitted. `getStatus()` exposes consent/configuration/submission state, not the stored ID to page contexts.

- [ ] Write failing tests for default-off/no UUID/no traffic; concurrent initialization; restart/update persistence; disable/re-enable revision races; uninstall/reinstall simulation; limits of 100 events/128 KiB/24 hours; permission denial; queue eviction; crash recovery; bounded retries and alarm cleanup.
- [ ] Run `node --test tests/tooling/telemetry.test.cjs` and confirm expected failures.
- [ ] Implement background-only ownership, validated message dispatch and transport per the contract. Separate usage and diagnostic batches; deleting usage state must not opt users into future reports.
- [ ] Test private-field rejection and ensure production transport is disabled without explicit production configuration. Confirm telemetry alarm names do not collide with cache retention alarms.
- [ ] Run tooling tests, `npm run check`, and packaging tests; commit.

## Task 4: Add consent UI and protect stored identity

**Files:** Modify `popup/popup.html`, `popup/popup.js`, `popup/popup.css`, `content/content.js`, `background/media.js`; create `tests/telemetry.spec.js`; extend `tests/popup.spec.js` and preference tests.

**Interfaces:** Popup reads status and requests consent through the background API. Content contexts request only existing allowed Reader preferences and submit validated preference updates. All preference access must be migrated before trusted-only local storage access is enabled.

- [ ] Write browser tests for clear unchecked consent, no retroactive activity, relay-origin permission refusal, keyboard use, explanatory privacy link, persistent setting, revocation during upload and stale tabs after re-enabling.
- [ ] Run focused tests to confirm expected failures.
- [ ] Prepare a compact UI comp following established project design preferences, then implement the approved treatment. Preserve existing Reader toggles; do not add an account screen or block normal use behind consent.
- [ ] Migrate direct content storage access and regression-test Reader persistence, defaults, reset and cross-tab preference updates before restricting `storage.local` to trusted contexts.
- [ ] Run `npm test -- tests/popup.spec.js tests/telemetry.spec.js` plus relevant Reader specs, then commit.

## Task 5: Instrument actual features and export outcomes

**Files:** Modify `content/reader.js`, `content/content.js`, `content/export.js`, `content/collection-export.js`, `background/archives.js` and telemetry tests.

**Interfaces:** Use Task 3 `recordUsage`. Local operation references deduplicate started/terminal events and are not transmitted. One explicit user retry is a new attempt; automatic internal retries/chapter work are not new collection attempts.

- [ ] Write failing tests for visible applied Reader styles, real hidden bars, untouched defaults, hidden fetch tabs, repeated DOM mutations, SPA navigation, multiple tabs and UTC day rollover. A UTC deduplication boundary does not redefine the GA report timezone.
- [ ] Write export tests for start/complete/partial/failure/cancel/interruption/unconfirmed, duplicate browser notifications and worker restart. Treat source skips and automatic retries separately from whole-attempt failure. Never infer completed from file handoff.
- [ ] Implement minimal hooks at existing ownership boundaries; debounce setting changes and persist capped daily feature suppression across worker restarts.
- [ ] For standalone posts, emit only completion states the current architecture can establish; use unconfirmed rather than assume anchor-triggered downloads completed. Do not expand download permissions/access solely to improve a statistic.
- [ ] Assert transmitted fixtures contain no titles, URLs, filenames, post IDs, per-chapter counts or local operation references. Exercise regression specs for collection completion/reporting and post export.
- [ ] Run relevant browser/tooling tests and `npm run check`; commit.

## Task 6: Add reviewed technical problem submission

**Files:** Modify post/collection export UI owners and styles; propagate safe error codes from relevant background/PDF paths; extend schema, telemetry and browser tests.

**Interfaces:** Stable `error_code`/`stage` values accompany errors separately from their user-facing message. `submitDiagnostic` receives only schema-approved fields and allocates a fresh report identity after explicit submission. Schema expansion requires matching relay validation and documentation.

- [ ] Write failing tests for diagnostics with usage disabled, preview field accuracy, denied host permission, repeated clicks, duplicate submission during pending state, network timeout and unknown failures containing private text.
- [ ] Add Report this problem beside supported errors, with a preview and explicit send action, no form/free text/login/email/attachment requirement. Do not transmit before the final action.
- [ ] Add stable error codes at known failure boundaries; map unknown errors to a generic code plus static extension module identifier. Do not parse arbitrary messages into telemetry or upload Unicode/content fragments by default.
- [ ] Keep report identity and payload bounded until sent/expired; show honest success as submitted/accepted, not that the developer read or GA permanently stored it. Allow deliberate retry after failure without silently queuing unlimited copies.
- [ ] Run privacy and relevant PDF/export/browser tests; verify diagnostic-only submission creates no persistent usage ID and no qualifying usage event; commit.

## Task 7: Complete reporting, release documentation and validation

**Files:** Update `docs/analytics.md`, `PRIVACY.md`, `README.md`, `PRODUCT.md`, `TESTING.md`, `docs/testing-history.md`, `changelog.md`, relevant usage/release documents and maintained page reference if new Reader/error surfaces establish boundaries. Update package/version metadata only when preparing the actual release.

- [ ] Document event definitions, opt-in bias, ID lifecycle, distinction between active installations and people, clone/reinstall limits, best-effort delivery, diagnostic independence and aggregated-report retention.
- [ ] Configure production reports using the proven usage-event filters, controlled dimensions and explicit timezone. Display downloads and outcomes separately; rates must disclose unknown/missing outcomes instead of silently treating them as failures/successes.
- [ ] Review actual infrastructure logging and abuse/cost limits. Verify secret handling, outbound metadata and provider retention before enabling the endpoint. Dashboard access is developer-only; no user authentication is introduced.
- [ ] Run `npm run check`, `npm run test:tooling`, the browser suite and appropriate installed Brave/Chrome regression tests. Add an installed telemetry test proving real consent/permission behavior and no traffic before consent, with a controlled test relay/property.
- [ ] Validate production-shaped events against GA's debug endpoint and the development property. Inspect real requests, verify filtered counts and prevent test traffic in production. Record evidence and limits, not inferred success.
- [ ] Update Chrome Web Store privacy/disclosure fields and listing claims for owner review before submission. Existing users must receive a prominent data-practice explanation and remain opted out until consent.
- [ ] Commit documentation and release changes atomically. Package and validate the extension with runtime modules included and relay/secrets/tests excluded. Deploy/publish only when authorized.

## Acceptance criteria

- No account/email flow exists, and all reading/export features work with statistics disabled and relay unavailable.
- Same participating installation deduplicates across activity and restarts; two controlled installations count separately; diagnostic-only submissions do not affect usage counts.
- Reader/bar measurements include actual saved-feature use and exclude hidden collection workers.
- Telemetry payloads contain only schema-approved pseudonymous usage or technical fields, never Patreon/page/download details.
- User-triggered reports work independently of usage consent, without persistent identity or raw messages/stacks.
- Revocation and consent revision tests pass; bounded queues and best-effort delivery limits are documented.
- GA reports are verified using processed data, private configuration is not packaged, and privacy/store documentation matches behavior.

## Sources checked November 10, 2026

- [Chrome extension GA4 integration](https://developer.chrome.com/docs/extensions/how-to/integrate/google-analytics-4).
- [Measurement Protocol reference](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag).
- [Event validation](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events).
- [GA retention and aggregate-report limits](https://support.google.com/analytics/answer/7667196?hl=en).
- [Chrome Web Store disclosures](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements).
