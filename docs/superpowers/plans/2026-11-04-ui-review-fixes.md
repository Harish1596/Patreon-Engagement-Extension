# UI Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address all five findings in the approved independent UI critique.

**Architecture:** Preserve the existing extension frames and direct user-gesture
permission requests. Use a nonmodal collection panel with a scrollable content
area and a separate visible action footer. Retain active operations when the
panel is dismissed; reopen their existing state without new preparation.

**Tech Stack:** Existing plain JavaScript/HTML/CSS and Playwright fixtures.

**Spec:** `.impeccable/critique/2026-11-04T17-18-35Z__extension-content-collection-export-js.md`, all five findings authorised by the user.

## Global Constraints

- Preserve local processing, existing access checks, cache limits and output formats.
- Retain current visual identity; this is scoped remediation, not a new UI surface.
- Do not steal browser-tab focus or add dependencies, permissions or CSP exceptions.
- Keep permission requests in extension-frame click handlers.
- Commit every repository change; distinguish synthetic checks from live evidence.

## Review Focus

- Narrow/short windows and expanded reports: Cancel/Retry remain visible.
- Dismiss/reopen during generation: work continues, no duplicate preparation.
- Keyboard users: nonmodal semantics, explicit focus entry and return, background reachable.
- Accessible file choices: ZIP and format suitability are available as descriptions.
- Light/dark and 320px popup: readable supporting text and no overflow.

### Task 1: Collection control layout and focus (P1 findings)

**Files:** `extension/content/collection-export.js`, `tests/collection-menu.spec.js`.
**Interface:** Existing begin/setBusy/close/trigger lifecycle; no worker changes.

- [x] Add failing geometry, dismissal/reopen and nonmodal focus regressions.
- [x] Run new cases against the current implementation and record failures.
- [x] Add a scrollable collection body and fixed footer; compact unavailable choices
      during busy work without destroying the permission frame.
- [x] Allow busy dismissal and reopen of the same operation; focus the labelled
      nonmodal panel on entry and return to the trigger on dismissal.
- [x] Verify collection menu, progress, cancellation, retry and native handoff.
- [x] Update maintained evidence and commit this independently testable change.

### Task 2: Guidance, contrast and popup readability (P2 findings)

**Files:** collection/post chooser HTML/CSS, `extension/content/export.js`,
`extension/content/collection-export.js`, `extension/popup/popup.css`, relevant
fixtures/specs. **Interface:** Preserve button names/data-format; add descriptions.

- [ ] Add failing tests for ZIP/suitability descriptions, both-theme contrast and
      popup supporting-text readability/geometry.
- [ ] Add ebook/editable-text/print guidance and accessible ZIP descriptions.
- [ ] Increase post chooser space for hints and use real assets in its UI fixture.
- [ ] Use readable muted disclosure colours and enlarge popup secondary text.
- [ ] Verify export/security/popup/menu flows and inspect desktop/narrow captures.
- [ ] Update TESTING.md, testing history and maintained page reference; commit.

## Completion

- [ ] Run syntax, tooling, Chrome regression and focused installed Brave checks.
- [ ] Review fixes against all five findings, with evidence and remaining limits.
- [ ] Confirm all agent-created changes are committed and the working tree is clean.

## Execution evidence

- Ruling: use the existing authorised checkout and implement inline; the user
  approved the concrete critique findings, and this is one scoped remediation.
- Ruling: choose nonmodal semantics because collection work should not block
  reading or tab switching. Dismissal preserves active work; Cancel stops it.
- Task 1 RED: all three new collection-control regressions failed on the original
  focus/geometry behavior. GREEN: all three pass, alongside seven existing menu
  and progress cases (10 Chrome cases total).
- Task 2 RED: file descriptions/popup readability failed; both separate contrast
  regressions measured ratios below 4.5:1 before the correction.
