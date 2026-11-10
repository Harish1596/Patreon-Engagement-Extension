# Development analytics relay

This is the first implementation stage of optional extension statistics. It is a database-free forwarder for three approved GA4 events. The extension does not yet have usage hooks, consent UI or an endpoint configured. No extension traffic is enabled by this work.

The developer supplied development Measurement ID **G-TN322D96R3**. It is public configuration, not a secret. Confirm the property is a development property with reporting timezone UTC. Never paste the Measurement Protocol API secret into chat, Git or the extension.

## Deploy through the Cloudflare dashboard

1. Run `node scripts/build-analytics-relay.js` from the repository root. This creates the ignored, self-contained `dist/patreon-reader-analytics-dev.mjs` file. It contains no secrets and needs no imports or database.
2. In Cloudflare, open **Workers & Pages**, create a Worker using the basic starter/Hello World flow and name it `patreon-reader-analytics-dev`. If a starter must be deployed first, that initial deployment is only the starter, not this relay.
3. Open **Edit code**. Replace the starter code with the complete generated `.mjs` file, including its final `export default`. Save/deploy the Worker.
4. In the Worker's **Settings → Variables and Secrets**, add these **runtime** bindings, then apply/deploy the changes:

   | Name | Type | Value |
   | --- | --- | --- |
   | `GA_MEASUREMENT_ID` | Text | `G-TN322D96R3` |
   | `GA_API_SECRET` | Secret | The secret from the development Web stream's Measurement Protocol API secrets |
   | `GA_DEBUG_MODE` | Text | `true` for development only |

5. Disable Workers Observability/persistent invocation logs and do not enable request/body logging, Logpush or request tracing. The CLI configuration disables observability, but pasting code into the dashboard does not apply that configuration automatically. Cloudflare still processes network metadata and may retain provider/security metadata; review account/provider settings before production. No promises of zero IP processing are made.
6. Open `https://<your-worker>.workers.dev/health`. It should return `{"ready":true}`. A health visit never sends a GA event. It only checks that bindings are present and shaped correctly; it does not prove the secret is valid or GA has ingested anything.
7. Share the public Worker URL (never the secret). We can then configure the development extension and verify actual events and filtered installation counts in GA4.

If health returns `{"ready":false}` with HTTP 503, check the runtime binding names and deployment. Do not troubleshoot by copying secret values into an issue or chat.

## Optional command-line deployment

The dashboard route above needs no local Cloudflare CLI. If using Wrangler, run it from `relay/` with `wrangler.jsonc`, authenticate to your own account, set `GA_API_SECRET` using `wrangler secret put GA_API_SECRET`, and deploy the reviewed Worker. Wrangler bundles `index.mjs` and its dependencies. Do not commit Wrangler credentials, local secrets, provider state or generated bundles. Setting a secret can create/deploy a Worker version; treat it as an explicit external action.

## Protocol and privacy boundaries

`POST /events` requires JSON with exactly:

```json
{
  "schema_version": 1,
  "client_id": "11111111-1111-4111-8111-111111111111",
  "extension_version": "1.2.1",
  "events": [{ "name": "pr_reader_used", "occurred_at_ms": 0 }]
}
```

The example timestamp is a placeholder: actual timestamps must be no older than 24 hours or more than five minutes in the future. The displayed UUID is synthetic; real usage will use a consented random installation ID.

- Event names: `pr_reader_used`, `pr_bar_hidden`, `pr_download_started`. Only the last permits/requires `scope`, exactly `post` or `collection`. No format or packaging field.
- Additional fields are rejected, not forwarded. No page/title/content/filename/account data, browser details, arbitrary error reports or user-entered text is accepted.
- Maximum request body: 64 KiB; maximum batch: 20 events. The relay preserves each event's original timestamp and denies ad-user-data/ad-personalization consent in GA requests. It does not forward incoming IPs, cookies or user-agent headers to GA. Google sees the relay's connection metadata.
- Upstream requests have an eight-second total forwarding deadline, no redirects and no cookie credentials. Partial forwarding and lost responses can produce duplicates on retry; exactly-once delivery is not promised.
- HTTP 202 means forwarding received an upstream success response, not that GA validated or permanently stored the events. HTTP 400 indicates rejected input; HTTP 503 indicates missing configuration or a forwarding failure. No upstream body or secret is echoed.
- This is a public endpoint. Neither CORS nor an extension origin authenticates its caller. Before production, configure provider request/cost limits and review abuse controls. A development Worker is not ready for unrestricted production traffic merely because health succeeds.
- A development-only `GA_DEBUG_MODE=true` adds `debug_mode` to GA events. This is controlled by the deployment binding, not arbitrary incoming parameters. Use a separate production property and disable the flag there. Configure GA advertising/Signals settings and retention separately; the Worker cannot set those property-wide settings.

## Verification

Run `node --test tests/tooling/telemetry-relay.test.cjs`. These tests use real Request/Response handling and a fake Google transport; they prove local filtering and forwarding behavior, not live Cloudflare compatibility or GA ingestion. Run `node --check relay/index.mjs` and `node --check relay/worker.js` for entry syntax.

Real deployment, secret validity, GA validation endpoint checks, processed reports, timestamp attribution and distinct-client counts remain pending. Do not label a successful health request or local test as a completed GA4 proof.

References: [Cloudflare dashboard setup](https://developers.cloudflare.com/workers/get-started/dashboard/), [runtime secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Chrome GA4 integration](https://developer.chrome.com/docs/extensions/how-to/integrate/google-analytics-4).
