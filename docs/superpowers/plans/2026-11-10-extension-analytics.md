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

Set both development and production property reporting timezones to **UTC**. Count distinct usage `client_id` values over each UTC calendar day, trailing seven UTC calendar days or trailing thirty UTC calendar days; mark the current day provisional. Do not sum daily distinct counts to obtain weekly/monthly counts. Label figures **participating active installations**, never people, total installed users or all users. GA4 may estimate distinct counts, reporting may be delayed, and opt-in introduces selection bias. Error submissions must not change these counts.

| Event | Trigger | Allowed event-specific fields |
| --- | --- | --- |
| `pr_feature_used` | Actual Reader customization or bar hiding; at most once per feature per UTC day | `feature`: `reader` or `engagement_bar` |
| `pr_setting_changed` | A user commits a settings change; debounce continuous input | `control`: `reader_enabled`, `bar_hidden`, `font`, `text_size`, `post_color`, `paragraph_spacing`, `line_spacing`, `reset` |
| `pr_download_started` | One explicit post/collection export attempt | `scope`: `post`/`collection`; `format`: `pdf`/`epub`/`markdown`; `packaging`: `single`/`zip` |
| `pr_download_outcome` | One terminal result for that attempt | Same export fields; `outcome`: `complete`, `partial`, `failed`, `cancelled`, `interrupted`, `unconfirmed`; optional approved `error_code`/`stage` |
| `pr_problem_reported` | User reviews and explicitly submits diagnostics | Approved `feature`, `stage`, `error_code`; export format/packaging only when applicable; approved technical failure category where necessary |

All events carry `schema_version`, packaged `extension_version` and `event_class` (`usage` or `diagnostic`). Each event also carries immutable `occurred_at_ms` as transport metadata, not a registered custom dimension. Only diagnostics include broad `browser_family` and `browser_major`; unknown browser identification is explicitly `unknown`, not a fingerprinting exercise. Never transmit setting values or exact text-size/font selections.

Use the existing installation UUID only for usage. Each diagnostic submission uses a new random, non-persistent GA client ID even when usage is enabled. A random report/event reference is permissible for local duplicate suppression, but is not a registered custom reporting dimension and must not encode page/job/download IDs. Diagnostic-only submissions never create a persistent installation ID.

The active-installation report applies **event-scoped** filters for `pr_feature_used` and `pr_download_started` with `event_class=usage`, then counts distinct clients among those matching events. Do not use a user-scoped segment that includes other events/dates merely because that client qualified elsewhere. Setting changes and diagnostic events do not qualify. Do not use the property's unfiltered default Users card. Daily suppression controls event volume, not a claim about number of pages or times read.

## Activity, timestamps and outcome rules

- Re-evaluate real applied Reader/bar state on initial reconciliation, `visibilitychange` to visible, `pageshow`, SPA reconciliation and a UTC day-boundary check while visible. Hidden work alone never qualifies; a background-loaded post can qualify once the user actually views it. Confirm recognized target/style application rather than merely checking the preference Boolean. Deduplicate across tabs in the worker.
- Reject all incognito usage at the background boundary using sender/tab context. Never reuse the regular installation ID in private browsing. An explicit diagnostic remains possible with a fresh temporary identity and approved technical fields only; do not transmit an incognito flag. Generic diagnostics from an extension-owned page must not recover private tab details.
- The worker assigns immutable `occurred_at_ms` when it accepts a qualifying event, not at upload/retry time. Store it with the event; generate no pre-consent events. The relay accepts safe integer timestamps no older than 24 hours and no more than five minutes ahead of its clock. Expire invalid-clock/old events without substituting a new time; report the resulting measurement limitation.
- Each GA request groups only events sharing client identity, class and original occurrence timestamp, mapping it to request `timestamp_micros = occurred_at_ms * 1000`. Split a queued batch when timestamps differ; never assign one flush time to different historical events. Validate timestamp boundaries and actual processed report dates in the proof. No extra fine-grained browsing timestamps are recorded.
- Each explicit export attempt has a random **local-only** attempt reference, original consent revision, start time, target set, generation state and part results. Persist only the minimal telemetry attempt bookkeeping in trusted storage, without titles, URLs or filenames. Terminal deduplication survives worker restart. If usage was off at start, or its revision changes, do not emit a later outcome for that attempt.
- Do not finalize an attempt until generation has stopped and every started browser download has resolved, or the attempt reaches **24 hours from start**. A cancelled generator can still have an earlier part saving. At the deadline finalize unresolved state as `unconfirmed`; later browser notifications must not emit a replacement terminal telemetry event. Telemetry finalization must never cancel downloads or override the local report UI; normal browser notifications may continue updating that UI independently.
- Determine one terminal outcome in this order: `unconfirmed` if generation is still unresolved at the deadline or any handed-off part remains unresolved/missing at finalization; otherwise `complete` if generation finished and every targeted export was included in browser-confirmed completed output; otherwise `partial` if at least one part completed but some targeted output was not completed; otherwise `cancelled` for explicit cancellation; otherwise `interrupted` if any browser download was interrupted; otherwise `failed`. Prediscovered locked/unsupported exclusions are outside the target set; newly discovered missing targets prevent `complete`. Preserve the existing local report distinctions even where telemetry reduces them to one outcome.
- An explicit user retry starts a new local attempt; automatic generation/network retries and individual chapters do not. Suppress duplicate browser notifications. Standalone anchor-triggered downloads without confirmation become `unconfirmed` once generation/handoff finishes; do not wait unnecessarily when no supported completion signal exists.
- Initially report **outcome distributions by terminal occurrence date** and started-attempt counts separately. Do not divide same-day outcomes by same-day starts or claim cohort conversion/success rates. Cross-day completion, missing events and best-effort delivery prevent that inference without extra correlation. A 24-hour timeout produces an outcome timestamp at finalization, never a backdated invented completion time.

## Diagnostic vocabulary and submission lifecycle

Schema version 1 accepts only the following diagnostic values. Unknown failures map to `UNKNOWN` rather than embedding an exception message. New codes require tests, documentation and coordinated relay/extension schema support.

- `feature`: `reader`, `engagement_bar`, `post_export`, `collection_export`, `extension`.
- `stage`: `preferences`, `reader_apply`, `bar_apply`, `discovery`, `source_fetch`, `image_fetch`, `conversion`, `pdf_render`, `packaging`, `browser_download`, `extension_context`, `unknown`.
- `error_code`: `PREFERENCES_LOAD_FAILED`, `PREFERENCES_SAVE_FAILED`, `READER_APPLY_FAILED`, `BAR_APPLY_FAILED`, `COLLECTION_DISCOVERY_FAILED`, `POST_BODY_UNSUPPORTED`, `SOURCE_FETCH_FAILED`, `IMAGE_FETCH_FAILED`, `PDF_UNSUPPORTED_CHARACTER`, `PDF_INPUT_LIMIT`, `PDF_OUTPUT_LIMIT`, `PDF_RENDER_TIMEOUT`, `PDF_RENDER_FAILED`, `ARCHIVE_BUILD_FAILED`, `DOWNLOAD_INTERRUPTED`, `DOWNLOAD_STATUS_UNAVAILABLE`, `EXTENSION_CONTEXT_INVALIDATED`, `UNKNOWN`.
- Optional `module`: `preferences`, `reader`, `engagement_bar`, `post_export`, `collection_export`, `media`, `pdf`, `archive`, `unknown`. Optional `failure_category`: `network`, `permission`, `timeout`, `resource_limit`, `unsupported_text`, `unsupported_body`, `browser_save`, `context_lost`, `unknown`. Omit fields that cannot be established.
- `browser_family`: `chrome`, `brave`, `edge`, `chromium`, `firefox`, `unknown`; `browser_major`: an integer from 1 to 9999 or `unknown`. Use available coarse browser information; no extra permissions, probes, installed-software enumeration or claims of exact Brave identification when unavailable. Existing format/packaging enums apply; no arbitrary HTTP bodies, status text or content characters.

A report moves through `preview -> queued -> sending -> accepted` or `failed/expired`. The same submission reference suppresses double-clicks/retries locally until resolved; an intentional new report gets a new reference. Show queued separately from accepted, and permit cancellation while queued. Acceptance is relay acceptance for forwarding, not verified GA ingestion. A diagnostic preview is local-only, held in trusted session storage for at most two hours, capped at ten snapshots, and is not automatically uploaded.

The popup provides a Report a problem fallback with the latest approved technical snapshot from the current extension context. If none is available, preview a generic `UNKNOWN` report with stage/module `unknown`; never claim to recover an error from an invalidated old content script. Tell the user to refresh the Patreon page when reconnection is necessary. No text entry, URL capture or account is needed, and opening the fallback alone sends nothing. Pass only an opaque local snapshot reference to the bundled preview URL, never an error string or Patreon details. Include the new preview runtime files in packaging tests/allowlists.

## Privacy, transport and retention contract

- Trusted contexts own telemetry state and identity. Restrict `storage.local` access with `setAccessLevel` only after migrating existing content-script preference reads, writes and change notifications through validated background messages; do not break Reader settings to protect telemetry.
- Treat content messages as untrusted. Validate extension sender, permitted page context and complete schema without retaining sender URLs. Reject additional fields rather than forwarding arbitrary objects.
- Queue limits are **100 events**, **128 KiB** serialized total and **24 hours** maximum age: usage has at most **80 events/96 KiB**, and explicit diagnostics have a reserved **20 events/32 KiB**. Usage can evict only older usage, never diagnostic reports. Within the diagnostic reservation reject a new submission visibly when full rather than silently evict an accepted queued report. Purge expired events before admission/transmission and expose expired/failed state locally. Split transmissions to relay byte/event limits; a single oversized event is rejected.
- Use one serialized background queue mutation path and shared initialization promise. Persist across worker restarts; never create identity per worker start. Recheck consent immediately before network dispatch.
- Disabling usage revokes future collection, cancels usage uploads where possible and removes the usage ID, usage queue, daily suppression and usage session state. An in-flight request may already have arrived. Re-enabling creates a fresh ID. An explicitly submitted diagnostic remains independently authorized.
- Persist a consent revision with queued usage events; reject old-revision batches after revocation, including disable/re-enable races. Expired or cancelled consent must not be bypassed by stale content scripts.
- Proposed flush: on new queued work and a one-minute alarm while pending, with a ten-second network timeout. Retry transient relay/network failures at most three times with jittered backoff, within expiry; honor bounded `Retry-After`. Drop permanently invalid/rejected payloads. Stop alarms when no work remains.
- Fetch only a fixed HTTPS relay endpoint from the worker using `credentials: omit`, `referrerPolicy: no-referrer`, and no redirects. Ask for only the relay origin permission at consent/report time; denial must leave normal features working. Invoke `permissions.request()` directly within an extension-owned consent/final-submit click handler before any asynchronous hop; never request it later from a worker message. An in-page Report button opens a bundled extension-owned preview, whose Send click requests permission before submission. Browser host permission is not analytics consent. Handle permission removal by suspending uploads and showing a user-action recovery path; never request permission from an alarm. No remote SDK, remote code or GA script injected into Patreon.
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
- [ ] Submit controlled A/A/B usage events plus a one-time diagnostic identity. Verify one distinct participating installation for A, two for A+B, and unchanged usage counts after the diagnostic. Repeated A across dates must deduplicate over the combined window. Include a client with a qualifying event only on day one and a settings/diagnostic-only event on day two: the day-two active count must exclude it. Verify a day-one queued event uploaded on day two still appears on day one, including UTC midnight boundaries.
- [ ] Verify registered feature, version, stage and error-code breakdowns appear in actual processed reports; record processing delays and any thresholding/approximation.
- [ ] Record the exact report filters and result evidence, without IDs/secrets, in `docs/analytics.md`. If distinct qualifying installations cannot be reported correctly, stop and revise the design before production work.
- [ ] Commit the proof documentation. Success is verified reporting, not merely HTTP 2xx or an empty validation error list.

## Task 2: Implement the permitted schema and stateless relay

**Files:** Create `extension/shared/telemetry-schema.js`, `relay/worker.js`, `relay/wrangler.jsonc`, `relay/README.md`, and `tests/tooling/telemetry-relay.test.cjs`; add relevant syntax/tooling commands to existing scripts as needed.

**Interfaces:** `PatreonTelemetrySchema.validateEvent(value)` returns a newly constructed approved event or `null`. Relay `POST /events` accepts `{schema_version:1, client_id, event_class, events:[...]}`; at most 20 events, at most 64 KiB request body, and one class/client identity per batch. Each event includes validated `occurred_at_ms`; regroup by original timestamp before GA forwarding. It returns bounded generic accepted/rejected/retryable responses and no Google response body. Acknowledgment means accepted for forwarding, not verified GA ingestion.

- [ ] Write failing Node tests for valid fixtures, unknown fields, URLs/private strings in enum slots, malformed UUIDs, mixed classes, timestamp splitting/expiry/future-clock limits, oversized requests, arbitrary upstream credentials, timeout and upstream failure. Pin every diagnostic enum and reject raw error text.
- [ ] Run `node --test tests/tooling/telemetry-relay.test.cjs` and confirm expected failures.
- [ ] Implement the schema, relay forwarding, timeout and safe responses with fake upstream fetch tests. Document provider abuse controls, logging and residual duplication risk; no fake browser-origin authentication claims.
- [ ] Run the Node tests and relevant syntax check; assert outbound GA bodies/headers omit input IPs, user agents, credentials and disallowed properties.
- [ ] Commit the independently tested schema/relay. Production deployment is a separate owner-authorized action.

## Task 3: Implement consent, identity and bounded background delivery

**Files:** Create `extension/background/telemetry.js`, `extension/shared/telemetry-config.js`, `tests/tooling/telemetry.test.cjs`; modify `background/media.js`, `manifest.json` and packaging allowlist.

**Interfaces:** `PatreonTelemetry.setUsageConsent(enabled)`, `getStatus()`, `recordUsage(name, params, localContext)`, `submitDiagnostic(approvedReport)`, `flush()`. All return promises; a telemetry failure is a bounded result and never an unhandled rejection. `localContext` supports only local deduplication, owner activity and consent revision; it is never transmitted. `getStatus()` exposes consent/configuration/submission state, not the stored ID to page contexts. Provide `cancelDiagnostic(reportRef)` for a queued report and a bounded trusted-session diagnostic preview API; none of these enables usage consent.

- [ ] Write failing tests for default-off/no UUID/no traffic; concurrent initialization; restart/update persistence; disable/re-enable revision races; uninstall/reinstall simulation; limits of 100 events/128 KiB/24 hours; permission denial/removal; usage eviction without diagnostic loss; full diagnostic reservation; queued cancellation/expiry; incognito usage rejection and temporary diagnostic identity; crash recovery; bounded retries and alarm cleanup.
- [ ] Run `node --test tests/tooling/telemetry.test.cjs` and confirm expected failures.
- [ ] Implement background-only ownership, validated message dispatch and transport per the contract. Separate usage and diagnostic batches; deleting usage state must not opt users into future reports.
- [ ] Test private-field rejection and ensure production transport is disabled without explicit production configuration. Confirm telemetry alarm names do not collide with cache retention alarms.
- [ ] Run tooling tests, `npm run check`, and packaging tests; commit.

## Task 4: Add consent UI and protect stored identity

**Files:** Modify `popup/popup.html`, `popup/popup.js`, `popup/popup.css`, `content/content.js`, `background/media.js`; create `tests/telemetry.spec.js`; extend `tests/popup.spec.js` and preference tests.

**Interfaces:** Popup reads status and requests consent through the background API. Define `GET_READER_PREFERENCES` and `SET_READER_PREFERENCES` background messages with strict existing preference keys/normalization and revisioned `READER_PREFERENCES_CHANGED` broadcasts to eligible content contexts. Content contexts apply the initial snapshot and only newer revisions, reconnect/reload when required, and never receive telemetry fields. Serialize writes and snapshot revisions so startup hydration cannot overwrite a newer cross-tab change. All preference access must be migrated before trusted-only local storage access is enabled.

- [ ] Write browser tests for clear unchecked consent, no retroactive activity, relay-origin permission refusal/removal, direct click-handler permission requests with no preceding async hop, keyboard use, explanatory privacy link, persistent setting, revocation during upload and stale tabs after re-enabling.
- [ ] Run focused tests to confirm expected failures.
- [ ] Prepare a compact UI comp following established project design preferences, then implement the approved treatment. Preserve existing Reader toggles; do not add an account screen or block normal use behind consent.
- [ ] Migrate direct content storage access and regression-test Reader persistence, defaults, reset and cross-tab preference updates before restricting `storage.local` to trusted contexts. Replace the content `storage.onChanged` dependency with the revisioned broadcast path, including the `SET_HIDDEN` response, Reader save callback, initial loading, worker restart and page refresh. Verify no other content module still directly accesses local storage.
- [ ] Run `npm test -- tests/popup.spec.js tests/telemetry.spec.js` plus relevant Reader specs, then commit.

## Task 5: Instrument actual features and export outcomes

**Files:** Modify `content/reader.js`, `content/content.js`, `content/export.js`, `content/collection-export.js`, `background/archives.js` and telemetry tests.

**Interfaces:** Use Task 3 `recordUsage`. Local operation references deduplicate started/terminal events and are not transmitted. One explicit user retry is a new attempt; automatic internal retries/chapter work are not new collection attempts.

- [ ] Write failing tests for visible applied Reader styles, real hidden bars, untouched defaults, hidden fetch tabs, repeated DOM mutations, SPA navigation, multiple tabs, background-load-to-visible transitions, `pageshow`, incognito rejection and UTC day rollover with property timezone UTC. A visible post crossing midnight must not depend on a DOM mutation to qualify on the new day.
- [ ] Write export tests for start/complete/partial/failure/cancel/interruption/unconfirmed, duplicate browser notifications and worker restart. Pin the specified multipart precedence, mixed complete/interrupted/unknown parts, generation failure after earlier completed parts, newly missing targets, cancellation while a part saves, 24-hour finalization and ignored late notifications. Test disable/re-enable during an attempt and cross-day occurrence times. Never infer completed from file handoff.
- [ ] Implement minimal hooks at existing ownership boundaries; debounce setting changes and persist capped daily feature suppression across worker restarts.
- [ ] For standalone posts, emit only completion states the current architecture can establish; use unconfirmed rather than assume anchor-triggered downloads completed. Do not expand download permissions/access solely to improve a statistic.
- [ ] Assert transmitted fixtures contain no titles, URLs, filenames, post IDs, per-chapter counts or local operation references. Exercise regression specs for collection completion/reporting and post export.
- [ ] Run relevant browser/tooling tests and `npm run check`; commit.

## Task 6: Add reviewed technical problem submission

**Files:** Modify post/collection export UI owners, popup and styles; create `extension/export/problem-report.html`, `extension/export/problem-report.js`, `extension/export/problem-report.css` as an extension-owned preview/submit surface (not a page iframe or web-accessible resource); propagate safe error codes from relevant background/PDF paths; extend schema, telemetry and browser tests.

**Interfaces:** Stable `error_code`/`stage` values accompany errors separately from their user-facing message. `submitDiagnostic` receives only schema-approved fields and allocates a fresh report identity after explicit submission. Schema expansion requires matching relay validation and documentation.

- [ ] Write failing tests for diagnostics with usage disabled, preview field accuracy, denied host permission, repeated clicks, duplicate submission during pending state, full diagnostic queue, cancellation/expiry, network timeout and unknown failures containing private text. Test the popup fallback both with a current approved snapshot and after extension reload with no snapshot: it must not invent recovered diagnostics.
- [ ] Add Report this problem beside supported errors and in the extension popup, with an extension-owned preview and explicit send action, no form/free text/login/email/attachment requirement. Do not transmit before the final action.
- [ ] Add stable error codes at known failure boundaries; map unknown errors to a generic code plus static extension module identifier. Do not parse arbitrary messages into telemetry or upload Unicode/content fragments by default.
- [ ] Keep report identity and payload bounded until sent/expired; show honest success as submitted/accepted, not that the developer read or GA permanently stored it. Allow deliberate retry after failure without silently queuing unlimited copies.
- [ ] Run privacy and relevant PDF/export/browser tests; verify diagnostic-only submission creates no persistent usage ID and no qualifying usage event; commit.

## Task 7: Complete reporting, release documentation and validation

**Files:** Update `docs/analytics.md`, `PRIVACY.md`, `README.md`, `PRODUCT.md`, `TESTING.md`, `docs/testing-history.md`, `changelog.md`, relevant usage/release documents and maintained page reference if new Reader/error surfaces establish boundaries. Update package/version metadata only when preparing the actual release.

- [ ] Document event definitions, opt-in bias, ID lifecycle, distinction between active installations and people, clone/reinstall limits, best-effort delivery, diagnostic independence and aggregated-report retention.
- [ ] Configure production reports using the proven usage-event filters, controlled dimensions and explicit timezone. Use UTC and event-scoped qualifying filters. Display started attempts separately from terminal-date outcome distributions; show unknown/missing-outcome limitations and no cohort conversion-rate claim.
- [ ] Review actual infrastructure logging and abuse/cost limits. Verify secret handling, outbound metadata and provider retention before enabling the endpoint. Dashboard access is developer-only; no user authentication is introduced.
- [ ] Run `npm run check`, `npm run test:tooling`, the browser suite and appropriate installed Brave/Chrome regression tests. Add an installed telemetry test proving real consent/permission behavior and no traffic before consent, with a controlled test relay/property.
- [ ] Validate production-shaped events against GA's debug endpoint and the development property. Inspect real requests, verify filtered counts and prevent test traffic in production. Record evidence and limits, not inferred success.
- [ ] Update Chrome Web Store privacy/disclosure fields and listing claims for owner review before submission. Existing users must receive a prominent data-practice explanation and remain opted out until consent.
- [ ] Commit documentation and release changes atomically. Package and validate the extension with runtime modules included and relay/secrets/tests excluded. Deploy/publish only when authorized.

## Acceptance criteria

- No account/email flow exists, and all reading/export features work with statistics disabled and relay unavailable.
- Same participating installation deduplicates across activity and restarts; two controlled installations count separately; diagnostic-only submissions do not affect usage counts.
- Reader/bar measurements include actual saved-feature use, background-to-visible transitions and UTC day rollover, and exclude hidden collection workers and incognito usage. Delayed events retain their original UTC date.
- Telemetry payloads contain only schema-approved pseudonymous usage or technical fields, never Patreon/page/download details.
- User-triggered reports work independently of usage consent, without persistent identity or raw messages/stacks.
- Revocation and consent revision tests pass; preference initialization/change broadcasts remain correct; explicit diagnostic queue space is protected; permission requests preserve user gestures; multipart/timeout outcomes are deterministic. Bounded queues and best-effort delivery limits are documented.
- GA reports are verified using processed data, private configuration is not packaged, and privacy/store documentation matches behavior.

## Sources checked November 10, 2026

- [Chrome extension GA4 integration](https://developer.chrome.com/docs/extensions/how-to/integrate/google-analytics-4).
- [Measurement Protocol reference](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag).
- [Event validation](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events).
- [GA retention and aggregate-report limits](https://support.google.com/analytics/answer/7667196?hl=en).
- [Chrome Web Store disclosures](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements).
