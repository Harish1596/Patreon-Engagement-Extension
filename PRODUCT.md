# Product

<!-- impeccable:product-schema 1 -->

Product: **Patreon Reader**. Context confirmed November 4, 2026.

## Platform

web

The product is a browser extension that operates on Patreon pages. It is not a
standalone website or a native mobile application. Runtime files live in
`extension/`; the existing implementation uses Manifest V3 and plain JavaScript,
HTML and CSS.

## Users

Patreon users in general, whether free or paid. Membership status determines
which posts a person can access; a paid subscription is not a prerequisite for
the extension itself.

Users want to read Patreon posts comfortably and keep offline copies of content
they can access. Long text posts, inline images and ordered chapter collections
are established workflows, rather than a restriction to one creator or genre.

## Product Purpose

Give equal importance to **reading comfort and offline downloads**.

Success means users can adjust supported posts to suit their reading needs,
understand the available download choices, and save accessible content with clear
progress and accurate results. Downloads should remain usable offline with their
inline images and source information.

## Positioning

A focused reading companion inside Patreon, combining personal reading
customisation with locally generated offline files. It uses the user's existing
browser session and access to content, without sending post content to an
extension-operated server or bypassing Patreon membership controls.

This is the product's mechanism and scope, not a claim of competitive uniqueness.

## Operating Context

- Users visit Patreon in their own browser profile, signed in when needed.
- The extension toolbar popup controls engagement-bar hiding and Reader
  customisation. Reader settings are adjusted from the supported post's Aa control.
- A supported post offers PDF, EPUB and Markdown downloads. PDF uses the browser's
  print workflow; EPUB and Markdown are generated as downloadable files.
- Collection pages offer EPUB books or ZIP archives of separate EPUB or Markdown
  files. Chapter order is preserved, with numbered parts for larger collections.
- Progress, cancellation, retry and download reports support lengthy
  collection operations and repeated downloads.
- Users may switch tabs while work runs. Background fetching and saving must not
  repeatedly take focus away from the tab they choose to use.

## Capabilities and Constraints

- Hide Patreon's floating engagement bar and customise supported posts' reading
  appearance, including font, size, colour and spacing.
- Preserve reading preferences between sessions. Temporary collection sources,
  images and generated-file staging have a different lifecycle: they expire and
  are cleared when the browser session closes, subject to the documented cleanup
  lifecycle. User-saved downloads remain ordinary files on the user's device.
- Keep export processing local. Fetch required Patreon content and inline images
  through the installed extension and existing browser session. Request media
  origin access when needed; denial must not silently produce an incomplete file.
- Export accessible supported content only. Skip and explain locked, unavailable
  or unsupported posts; never attempt to defeat access restrictions.
- Embed inline post images for offline use. Preserve Creator, Download time and
  Source metadata, using post or collection titles for safe filenames.
- Keep collection work bounded, reuse valid cached sources, preserve completed
  work where retry is supported, and enforce storage and content limits. Current
  limits and lifecycle details are maintained in the linked technical references.
- Distinguish preparation, browser handoff, confirmed completion and interruption.
  Missing browser history is unconfirmed; completion does not prove file validity.
- Changes depend on Patreon's page structure and available data. Do not treat
  dated captures or synthetic tests as proof of the current live site.

## Brand Commitments

Keep the established name **Patreon Reader** and existing extension/store artwork
unless the user explicitly requests a change. Use plain, direct language that
names the action and the resulting file. Avoid hiding essential format choices
behind ambiguous labels or unexplained technical details.

## Evidence on Hand

- [README.md](README.md): product origin, installation and existing workflows.
- [extension/manifest.json](extension/manifest.json): extension identity, runtime
  entry points and permission declarations.
- [Maintained Patreon reference](docs/patreon-text-image-post-baseline.md): dated
  supplied markup/screenshots, ownership boundaries and integration constraints.
- [TESTING.md](TESTING.md) and [testing history](docs/testing-history.md): current
  checks, historical evidence and verification limits.
- [Store assets](store-assets/README.md): existing artwork and regeneration notes.

Original engagement-bar browser support and newer Reader/export validation have
different evidence. Do not infer universal feature compatibility, store approval
or current live Patreon support from a manifest version or a fixture test.

Repository fixtures are sanitised examples. Do not add private post bodies,
account payloads, signed media URLs, cookies or access tokens as product evidence.

## Product Principles

1. Serve free and paid users while respecting the access each already has.
2. Treat comfortable reading and useful offline downloads as equal priorities.
3. Keep content processing local and separate durable preferences from temporary
   content caches.
4. Make choices, progress and outcomes understandable; preserve user focus and
   successful work during long operations.
5. Maintain honest capability and verification boundaries as Patreon changes.

## Accessibility & Inclusion

Preserve existing keyboard operation, visible focus, Escape dismissal and readable
light/dark states. Keep choices available at narrow widths and when text grows;
use clear labels and descriptions rather than relying on icons or colour alone.
The product does not currently claim a formally audited accessibility standard.

## Open Decisions

Future support for additional post types and any formal accessibility conformance
target remain undecided. Current implementation support must not be presented as
an approved roadmap or a promise of every Patreon post type.
