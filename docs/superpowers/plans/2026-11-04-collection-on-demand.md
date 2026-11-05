# On-demand collection downloads implementation plan

Goal: Opening Download Collection shows formats without discovery or post visits.
Selecting a format starts discovery followed by a single visit per uncached post.

Design: Keep collection URL discovery, ownership, retry files, source cache, limits,
and native download delivery. Register discovered URLs without the old DESCRIBE
pass. At chapter generation, describe and build in the same worker document.
Already granted image hosts continue automatically. New hosts pause the selected
operation for an explicit click in the extension frame; permissions remain limited
to exact HTTPS origins. Cancellation and navigation reject pending permission
waits and close workers. Dismissal keeps the operation available on reopen.

Alternatives: Moving the existing full preparation pass behind format selection
still loads every uncached post twice. Requesting all HTTPS hosts upfront avoids
later permission clicks but broadens access. The implementation retains exact-host
access and eliminates the separate post pass instead.

Files: collection-export.js owns chooser entry, discovery timing and permission
pause UI; media.js owns deferred registration and same-document description/build;
collection-chooser.js/HTML/CSS own immediate choices and the user-gesture grant.
Existing standalone export behavior stays unchanged.

- [x] Add regressions for no work before selection and deferred worker registration;
  demonstrate failures, then implement the entry flow and one-pass chapter build.
- [x] Cover missing grants, denial, cancellation, forged/stale messages and cache hits.
- [x] Update browser fixtures to select a format before discovery assertions, verify
  options, progress, retry, refresh, native output and available browser layouts.
- [x] Run relevant Node/browser checks and syntax/whitespace checks, record actual
  results and evidence limits, then commit only this task's changes.

Review focus: first-use grants; cancellation while awaiting approval; busy hidden
panel reopening; permission-free cache hits; membership/unsupported failures during
chapter generation. Discovery alone never claims content was successfully exported.

Workspace: unrelated Single Markdown edits were already present. Preserve them and
stage this task's delta separately. No dependency or manifest changes are needed.


Review fix: Unsupported descriptions must remain skippable without a preflight
pass. The archive records skipped slots; ZIP/combined writers omit them, and EPUB
repairs navigation around sparse paths. Tests reproduce this defect before the
fix and verify skips survive restart. Image permission denial stops the attempt.
The installed refresh check now triggers a download before checking cache reuse.

Validation limit: Node checks pass; browser execution is blocked by both installed
browsers aborting at launch with SIGABRT/EPERM, including elevated attempts. Browser
fixtures were updated and collected, not claimed as passed. No live check occurred.
