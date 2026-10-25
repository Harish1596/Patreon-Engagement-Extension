# Local release packaging

From the repository root, run `npm run package`. This uses Node.js plus the
`zip` and `unzip` commands on PATH. It requires no new npm dependencies, makes no
network requests, and does not publish to a store. On systems without those
commands, install compatible ZIP command-line tools before packaging.

The output is `dist/patreon-engagement-toggle-VERSION.zip`. If it already exists,
the command stops without changing it. To deliberately replace a generated ZIP,
use `npm run package -- --force`. An existing release is replaced only after the
new archive passes validation; failure leaves the old release intact.

## Validation

The explicit archive allowlist is maintained in
[scripts/package-extension.js](../scripts/package-extension.js). No directory
globs or recursive copying are used. Runtime assets come from `extension/`;
`LICENSE` and `PRIVACY.md` come from the repository root. Only allowlisted files
are staged. Symlinks and files escaping their source directory are rejected.

Before creating the ZIP, the command requires identical versions in the extension
manifest, package.json, package-lock.json, and the lockfile's root package entry.
It checks numeric extension-version components, required files, and local resource
references declared in the manifest, HTML/SVG attributes, and CSS URLs. A new
resource must be explicitly allowlisted; CSS imports need validation support.
This is not a general JavaScript dependency analyzer or complete store validator.

The generated ZIP must have exactly the allowlisted file entries, without missing,
duplicate, unexpected, or enclosing `extension/` paths. `manifest.json` is at the
ZIP root. `unzip -t` checks archive integrity; every extracted file must equal the
validated source snapshot byte-for-byte, and resource checks run on that snapshot
again. Temporary staging is cleaned after success or failure. Staged timestamps
and permissions are normalized; cross-platform byte-identical ZIP output is not
guaranteed because command-line tool versions/timezones can differ.

## Before release

Run `npm run check`, `npm run test:tooling`, `npm test`, and `npm run test:brave`.
Review the manual browser checklist in [TESTING.md](../TESTING.md), then package.
Packaging alone does not establish that the extension works on current live
Patreon, nor does it sign Firefox/Safari artifacts or upload a Chrome Web Store
release. Keep credentials out of source and release output.
