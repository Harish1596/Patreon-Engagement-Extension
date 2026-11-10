# Minimal Analytics Implementation Plan

This release supersedes the full analytics plan's implementation scope following the user's November 10 request for a minimal release. The full plan remains future design material, not an instruction to implement diagnostic reporting now.

## Approved scope

Optional, initially disabled statistics measure actual Reader styling, actual engagement-bar hiding and explicit post/collection download starts. Use a random installation UUID in local storage, cleared on withdrawal/uninstall; no accounts, emails, pages, content, filenames, format, packaging or browser details. Error reporting/outcomes/settings changes are deferred. Count distinct participating installations with qualifying events, not all installed users or unique people.

## Execution

1. Implement a strict three-event schema and a stateless GA4 relay with tests. Secrets live only in deployment configuration. Use UTC and original event timestamps; reject additional/private fields.
2. Implement consent, worker-owned UUID, a bounded local queue and limited retries; protect storage identity while preserving preference synchronization. Test revocation races, restart, expiry, private contexts and denial of host permission.
3. Add one consent switch in the existing popup style and actual-use hooks, with browser tests. No production endpoint is assumed: an unconfigured build keeps consent unavailable and sends nothing. Existing user approval covers the scope, not invented production credentials.
4. Update privacy/product/testing/usage documentation and package allowlists. Run tooling, browser and installed checks plus an independent final review; commit each coherent task.
5. With owner-provided development property and relay configuration, validate real GA4 ingestion, original dates and distinct installation counts. Record this as pending until actual processed data is inspected. No deployment/publication without authorization.

## Technical decisions

Events are `pr_reader_used`, `pr_bar_hidden`, `pr_download_started`; only the last includes `scope=post|collection`. Common fields are schema version, packaged extension version and original occurrence time, with client ID at the request envelope. Reader/bar events are capped once per UTC day per installation across tabs. Downloads are recorded per explicit attempt, not each chapter or internal retry. Incognito activity is excluded.

A trusted background module serializes state changes. Queue: at most 100 records/128 KiB, expires after 24 hours; relay batches at most 20 events/64 KiB, regrouped by original timestamp for GA. A request has a ten-second timeout and at most three retries after initial transmission; one-minute alarms service deferred work. No exactly-once guarantee. Queue/retry metadata remains local. Revocation aborts pending transport where possible, purges ID/queue/deduplication and increments consent revision. Content activity must match that revision.

Relay host is proposed Cloudflare Workers, with no database. Endpoint defaults to unconfigured; separate development/production properties. Owner chooses hosting and provides GA configuration without committing an API secret. Restrict requests to one HTTPS relay with omitted credentials/referrer and no redirects. Host permission is requested directly on the popup click before asynchronous operations and is separate from consent.

Trusted-only local storage requires a validated preferences bridge and revisioned change broadcasts; preserve existing reset/default/cross-tab behavior. Visible-state checks include background-to-visible transitions and UTC rollover, but no page identifiers. Do not infer successful Reader/bar use from enabled preference alone.

GA4: UTC, filtered distinct-client reports, no User-ID, advertising integrations, Google Signals or ad personalization. Proposed user/event retention is two months without reset on activity; aggregated standard reports have a separate lifetime. Reporting is opt-in, approximate and potentially delayed. Hosting receives network metadata; review provider logs rather than claim no IP processing.

## Progress

- Relay/schema implementation and five local relay/bundle tests: implemented; remaining extension consent/identity/hooks and full validation pending.
- Real GA4 proof: pending owner configuration and observed processed reports.
