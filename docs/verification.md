# Verification record

## OpenMBEE entry and shell checkpoint

Recorded 2026-11-01 on `feature/openmbee-shell`, using Node 26.3.1, npm 11.16.0 and the existing pinned browser engines. The landing page and explicit launcher wrap the existing workspace; no production dependency, engine pin or portable project field changed. Folder write-back, Flexo checkout and automatic exploration remain planned.

`npm run check` passed formatting, architecture, TypeScript, 118 Vitest tests and 6 Node tests. Fresh production builds passed through Playwright, retaining the existing bundle-size warning.

Focused actual-engine entry scenarios check explicit example links, source import, project creation, cancelled replacement, parser failure, recovery and independent named-view selection. Navigation assertions compare the exact source editor DOM and selection, invalid draft, diagram camera, Inspector selection, both saved layouts and source undo/redo through launcher/home/Back/Forward. Hidden workbench Save shortcuts cannot download or clear modified state. A held first engine asset followed by a newer example request proves stale cancellation errors are suppressed. New projects remain modified until download and require replacement confirmation even before the first edit.

The deliberate lifetime fault unmounted the workbench when opening the launcher. The preservation test failed at its source-editor DOM identity assertion; restoring the implementation made the same test pass. Evidence: `sandbox/shell-session/launcher-lifetime-fault.log`, `sandbox/playwright/shell-lifetime-fault` and `sandbox/playwright/shell-lifetime-restored`.

Visual review covers twelve new landing/launcher images at 1440, 768 and 390 px in both themes. Twenty-one existing images intentionally change for OpenMBEE/project controls and the named-view context header. All before/after/diff sheets were inspected, including the compacted context controls. Evidence: `sandbox/shell-session/visual-comparison-1.jpg` through `visual-comparison-6.jpg`, `entry-review-light.jpg`, `entry-review-dark.jpg` and `visual-diff-evidence.json`. Baseline generation is separate from the normal comparison run recorded below.

Functional validation covered all 84 distinct scenarios across three normal runs, with fresh production builds and no retries or skipped tests:

- `npm run test:e2e -- --project=functional --output sandbox/shell-session/functional-final --reporter=list --max-failures=1`: 76 passed, one legacy heading-locator assertion failed and seven workspace scenarios were not reached (11.3 minutes).
- `npm run test:e2e -- --project=functional workspace.spec.ts --output sandbox/shell-session/functional-workspace-final --reporter=list --max-failures=1`: three passed, then another legacy heading-locator assertion failed.
- `npm run test:e2e -- --project=functional workspace.spec.ts --grep 'creates a native view|downloads and reopens|cancels a reviewed rename|distinguishes repeated|retains source, draft' --output sandbox/shell-session/functional-workspace-remaining --reporter=list --max-failures=1`: five passed (38.6 seconds), after both heading assertions were migrated to the visible **Named view** combobox and exact selected view identity. Source-file independence, rendered subjects and accepted view source remain asserted. The failing traces showed correct diagrams and selected options; querying hidden native options as former headings was a test mismatch. This is combined coverage, not an all-green single full-suite run.

`npm run test:e2e -- --project=visual --output=sandbox/playwright/shell-final-visual --reporter=list --max-failures=1`: all 39 normal visual comparisons passed in 2.2 minutes, with no baseline updates, retries or skips. Together with the functional runs above, all 123 distinct browser scenarios have passing results.

The [automatic exploration investigation](research/automatic-exploration-contract.md) records native renderer and WASM probes separately from production browser evidence. It does not establish a delivered exploration UI. Firefox/WebKit and complete accessibility auditing remain outside this checkpoint; keyboard checks cover the tested opening/dialog/navigation workflows. Local results do not establish hosted CI.

## Development watcher regression

The reported Linux `ENOSPC` arose while Vite watched generated engine sources under `sandbox/opensysml-build`. The development configuration now excludes `sandbox/` and prepared `static/vendor/` binaries without disabling source watching or changing operating-system limits. `node --test scripts/vite-watch.test.mjs` exercises the actual Vite watcher: the original configuration failed because sandbox directories were watched; the fixed configuration passed, with source watching retained and both generated trees excluded. Evidence: `sandbox/shell-session/vite-watch-before.log` and `vite-watch-after.log`.

`npm run dev -- --host 127.0.0.1 --port 4176 --strictPort` started successfully after engine preparation. HTTP smoke checks returned 200 for the landing page, `/src/main.tsx` and the OpenSysML WASM asset. The dev server remained running without the reported watcher error. Excluding vendor binaries from watching does not prevent serving them; regenerated binaries require a page reload.

## Retained regression evidence

The latest browser coverage above includes the existing identity, authoring, diagnostics, source assistance and recovery suites. Earlier deliberate-fault records explain why critical preservation checks exist:

| Invariant tested      | Deliberate fault and observed failure                                                                                              | Local evidence                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Draft query freshness | Removed the stale-completion guard; targeted regression failed, restored code passed                                               | `sandbox/language-stale-fault.log`                                                                             |
| Recovery preservation | Removed startup-copy protection, clean clearing or restored-unsaved baseline; each targeted assertion failed, restored code passed | `sandbox/recovery-pending-fault.log`, `sandbox/recovery-clean-fault.log`, `sandbox/recovery-unsaved-fault.log` |
| Issue/source binding  | Removed diagnosed-text equality guard; stale-location regression failed, restored code passed                                      | `sandbox/diagnostic-stale-fault.log`                                                                           |
| Raw source navigation | Removed UTF-16/CRLF translation; source-selection regression failed, restored editor scenarios passed                              | `sandbox/source-editor-fault.log`                                                                              |

Historical hosted evidence: [Validate run 41314513339](https://github.com/Open-MBEE/sysml_view_editor/actions/runs/41314513339) passed for code head `f708b84`. That result does not establish CI for the later shell branch. Older milestone commands, counts and captures are available in Git history; they do not describe the current test inventory. Local artifacts under ignored `sandbox/` may be absent from other checkouts.
