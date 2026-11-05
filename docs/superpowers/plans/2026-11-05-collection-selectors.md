# Collection selectors implementation plan

**Approved design:** Replace six immediate download actions with Format (EPUB, PDF, Markdown), Packaging (Single file, Separate files (ZIP)), and one Download button whose name and description explain the output. Keep the existing visual identity and all download lifecycle behavior.

**Architecture:** Extension-frame native radio groups map the selected pair to the existing six format values. Preserve origin/token/size handshake, busy guard, image permission gesture, and parent recovery controls. EPUB / Single file is the initial selection; choices stay selected after a download or dismissal while the frame lives.

**Scope:** No new dependencies, storage, permissions, Patreon selectors or file-generation behavior.

- [x] Test the real chooser script in JSDOM: all six mappings, selection without download, initial layout handshake, busy guard and permission exchange.
- [x] Replace chooser HTML/CSS and wire selection, accessible description and one action to existing messages.
- [x] Migrate browser fixtures to select the two options before downloading; verify keyboard, narrow/light/dark/enlarged-text layout and existing lifecycle regressions.
- [x] Run syntax, tooling and browser checks; document actual results and limits, inspect the diff and commit all changes on the isolated task branch.

## Execution notes

The existing six output modes are reused. Review found a missing PDF parent-message
allowlist and final regression checks found an obsolete Retry button after Refresh;
both were reproduced and corrected. Layout revisions reject stale acknowledgements,
and aria-disabled keeps radio/action keyboard focus intact during layout settlement.
Lifecycle specs use native keyboard radio selection plus an actual action click;
menu specs separately verify pointer and keyboard selection and responsive geometry.

Existing fixture assumptions were updated for on-demand preparation: reports open
after generation starts, error-only builds supply default titles, clock checks
measure elapsed advancement after preparation, and Refresh checks isolate its own
cancellation behavior. Native PDF observes browser downloads rather than page-only
events, reuses registered fixture post tabs, and validates actual PDF/ZIP bytes.
The installed regression retains later worker-restart/cache checks after initial
source population. No dependency or backend generation changes were introduced.

Current verification commands/results and evidence limits are recorded in TESTING.md.
