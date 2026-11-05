---
target: Patreon Reader UI review, with collection download focus
total_score: 28
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 2
target_identity: "file:/Users/harish/Desktop/Testbench/patreon_ext/extension/content/collection-export.js"
target_fingerprint: "sha256:d7190cd37805f349ab0b47d8b247b4d401711c9ca6a538e21fc29a73c6191288"
target_path: /Users/harish/Desktop/Testbench/patreon_ext/extension/content/collection-export.js
timestamp: 2026-11-04T17-18-35Z
slug: extension-content-collection-export-js
---
Method: dual-agent (A: /root/ui_design_review · B: /root/ui_technical_review)

# Patreon Reader UI review — November 4, 2026

Primary target: `extension/content/collection-export.js`, with collection chooser,
Reader, post-download and popup companion surfaces. Reviewed source: `6c051a2`.

## Design specificity and overall impression

A credible, restrained reading companion. The book/chapter descriptions, reading
controls, local processing and retained-work recovery fit this product. Conventional
utility styling is appropriate; more decoration is not the main opportunity.
The ready menu is clearer than the supplied earlier screenshot. Composition during
long operations and failure recovery needs further work.

Independent design score: **28/40 — Good**. This is a heuristic assessment, not a
formal accessibility certification or a browser compatibility guarantee.

| Heuristic | Score /4 | Evidence |
|---|---:|---|
| System status | 3 | Progress and browser-handoff distinctions are clear |
| Real-world match | 3 | File structure is explained; format suitability needs guidance |
| Control and freedom | 2 | Busy Close/Escape unavailable; narrow Cancel starts below the fold |
| Consistency and standards | 3 | Cohesive styling; collection modal focus differs from Reader |
| Error prevention | 3 | Preparation gates, accessible-content filtering and clear options |
| Recognition over recall | 3 | Choices visible; recovery placement weakens discovery |
| Flexibility and efficiency | 3 | Customisation, batches, caching and retained-work retry |
| Aesthetic/minimalist design | 3 | Restrained ready state; inactive choices dominate busy/error views |
| Error recovery | 3 | Actionable retry preserves chapters, but can be hard to reach |
| Help and documentation | 2 | Limited format-selection guidance at the decision point |
| **Total** | **28/40** | **Good; two major interaction issues** |

## What works

- Three large collection choices make one book versus separate chapter files clear.
  Default desktop and narrow chooser layouts have no inner frame overflow.
- Retry preserves prepared work; the design reviewer verified failure → retry →
  download in a fixture. Accurate browser handoff/completion distinctions build trust.
- Descriptions have measured contrast of 5.74:1 light and 6.97:1 dark. Keyboard
  focus is visible, and Escape from the idle permission frame restores trigger focus.

## Priority issues

1. **P1 — Busy and recovery controls fall below the visible panel.** At 375×667,
   while BUILD_COLLECTION_EXPORT was held, the panel ended at y=595 while Cancel
   began at y=612.5. Close was disabled and Escape did not dismiss the busy panel.
   Scrolling or tabbing can reach Cancel, so this is difficult escape rather than
   an absolute lockout. On desktop, expanding a failed download's report also pushed
   Retry below the panel viewport. Keep Cancel/Retry in a visible action area and
   compact the inactive choices during processing and failure recovery.
   Sources: `extension/content/collection-export.js:503`, `:890`, `:909`, `:921`.
   Commands: `$impeccable harden`, `$impeccable distill`.

2. **P1 — The collection panel declares a modal without modal focus behaviour.**
   Opening it leaves focus on the external trigger. Tab can leave the panel and
   reach underlying page links despite aria-modal=true. Both reviewers independently
   reproduced this. Decide whether this is a modal or a nonmodal background-work
   panel; then implement matching focus entry, containment where appropriate, and
   return. Preserve the working idle Escape behaviour.
   Sources: `extension/content/collection-export.js:875`, `:924`, `:1080`.
   Command: `$impeccable harden`.

3. **P2 — File choices need suitability hints and equivalent accessible labels.**
   The post chooser offers only PDF/EPUB/Markdown names. Collection descriptions
   explain grouping, but do not explain which format suits which workflow. EPUB
   and Markdown aria-labels also override the visible ZIP badge; their associated
   descriptions omit ZIP. Add concise guidance such as PDF for print, EPUB for an
   ebook reader, and Markdown for text/editing, with ZIP in the accessible name or
   description. Missing text/naming is verified; novice confusion is an inference.
   Sources: `extension/export/chooser.html:11`, `extension/export/collection-chooser.html:15`.
   Command: `$impeccable clarify`.

4. **P2 — Preparation details has insufficient ordinary-text contrast.** Its
   hardcoded 12px #80808c text measures 3.90:1 on white and 4.02:1 on #232326,
   below 4.5:1 for normal text. Use a readable muted-text token in each theme.
   Source: `extension/content/collection-export.js:900`.
   Commands: `$impeccable colorize`, `$impeccable harden`.

5. **P2 — Popup supporting copy is too small for the product's reading goal.**
   Descriptions render at 11px and status at 11.5px. Increase supporting type and
   allow wrapping within the 320px popup. This is a legibility recommendation,
   not a claim that WCAG prescribes an absolute minimum font size.
   Source: `extension/popup/popup.css:134`.
   Command: `$impeccable typeset`.

## Cognitive load and emotional journey

The ready menu has three parallel choices and a clear hierarchy. Waiting is the
weak point: large disabled choices remain dominant while status and recovery move
below. Expanded reports repeat five totals plus collection, archive and post
explanations. Retain detail for diagnosis, but lead with the next useful action.
Reader's five recognisable colour swatches are not equivalent to an unexplained
five-way decision; font options remain in a conventional select.

The ready state builds confidence. Dimmed choices, disabled Close and an offscreen
Cancel create a waiting-time low point. Retained-work explanations restore trust
after failure, but their recovery action needs stronger placement.

## Persona concerns

- First-time downloader: suitability of EPUB/Markdown and PDF's print step remain
  unexplained at selection time.
- Keyboard/assistive-technology user: focus does not enter or remain within the
  declared modal; the archive type is omitted from format-button naming.
- Frequent collection reader: preserved-work retry is useful, but large inactive
  choices and repeated report text slow the recovery path.

## Detector and evidence limits

One CLI scan of extension/export, extension/popup and extension/content returned
three warnings and no errors. Two overused-font warnings identify the same popup
font-stack preference and are not demonstrated usability defects. One tiny-text
warning matches the popup observation. No collection warning was emitted, but its
JavaScript-created shadow DOM and separate frame limit static coverage. Browser
inspection independently found focus and contrast issues missed by the detector.

Both reviewers used independent fresh Chrome contexts and sanitised fixtures.
Coverage includes light/dark desktop, narrow states, enlarged chooser text,
keyboard navigation, progress, failure, retry, report and companion panels. The popup screenshot contains an unresolved icon; that fixture capture alone does
not establish a product asset defect. No
live account, screen-reader speech session, exhaustive zoom matrix or downloaded
file validity assessment was performed. A controlled text stress case is not an
OS/browser scaling conformance test.

No user-visible browser overlay is available. Mutable injection preflight passed,
but three attempts to load the local detector script failed; the precise network
cause was not established. Evidence therefore uses CLI results, screenshots,
computed styles and DOM geometry. The detector server was stopped. No CSP or
runtime source was changed. Evidence screenshots/measurements are retained only
under /tmp/patreon-ui-review-a and /tmp/patreon-ui-review-b.

## Questions for the next step

1. Which should lead: busy/recovery layout, keyboard/accessibility behaviour, or
   format-selection clarity?
2. Should the next change cover the two P1 issues or all five priority issues?
