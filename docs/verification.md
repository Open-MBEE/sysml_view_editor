# Verification record

## Shell cleanup and structural card checkpoint

Recorded 2026-11-01 on `feature/openmbee-shell`, using Node 26.3.1, npm 11.16.0 and the existing pinned browser engines. The private package is now `@openmbee/sysml-view-editor`; dependency versions, engine pins and portable project fields are unchanged. TypeScript now checks unused locals/parameters; two unused imports were removed.

`npm run check` passed formatting, architecture, the stricter TypeScript configuration, 118 Vitest tests and 6 Node checks. Fresh production builds passed through the browser runs, retaining the existing bundle-size warning.

Shell rendering is split into `ProjectHeader` and `SourceToolbar`, with local file construction/import/download in `projectFiles.ts`. The Workbench retains session lifetime, project replacement policy and semantic orchestration. CSS is grouped by surface through `ui/theme.css`. Before the diagram redesign, `npm run test:e2e -- --project=visual --output=sandbox/playwright/cleanup-css-equivalence --reporter=list --max-failures=1` passed all 39 existing visual comparisons without updates, establishing visual equivalence for that refactor.

Structural cards now have palette-tinted headers, kind badges, distinct name/type hierarchy, aligned port rows, 12 px square handles, explicit direction text, selection outline/halo and quieter containers. Renderer node dimensions and saved positions retain their existing contract. Scoped selection styles override React Flow's focus outline reset. The markup retains the original `name : Type` text format as well as accessible names.

The new actual-engine `diagram-style.spec.ts` checks name/type emphasis, selection outline while focused, keyboard port selection with its resolved declaration/usage context, pump-to-tank endpoint alignment and an exact bundle comparison across appearance changes. It failed against the original combined header markup, then passed with the redesign. Red evidence: `sandbox/cleanup-design/diagram-style-before.log` and `sandbox/playwright/diagram-style-before`. Three assembly scenarios passed; the final focused diagram/entry run passed all 11 scenarios in 53.5 seconds under `sandbox/playwright/cleanup-design-focused-final`, including source DOM/selection, drafts, history, camera, both layouts, cancellation and superseded requests.

Seventeen affected/new visual scenarios generated baselines in `sandbox/playwright/cleanup-design-visual-review`. Nine existing images intentionally change only for the structural notation; four selected-node images add desktop/narrow light/dark coverage. All before/after/diff sheets and new captures were inspected, alongside running-app desktop/narrow captures. Evidence: `sandbox/cleanup-design/comparison-1.jpg` through `comparison-3.jpg`, `selected-review.jpg` and `visual-diff-evidence.json`. Baseline generation is separate from normal comparison results.

`npm run test:e2e -- --project=functional --output=sandbox/playwright/cleanup-design-functional --reporter=list --max-failures=1`: all 85 scenarios passed in one fresh-build run (11.3 minutes), without retries or skips. This preceded the final foreground-only contrast adjustment, whose focused results are recorded separately.

The extended direction-contrast assertion failed before the final foreground adjustment (3.1858:1 in light/neutral), then passed across all six palettes in light/dark. `npm run test:e2e -- --project=functional diagram-style.spec.ts appearance.spec.ts --output=sandbox/playwright/diagram-contrast-final --reporter=list --max-failures=1`: five passed in 42.9 seconds after that adjustment. Measured OUT-label contrast is at least 6.77:1 across the twelve combinations. Evidence: `sandbox/cleanup-design/contrast-before.log`, `contrast-final.log`, `palette-before.log`, `palette-final.log` and the inspected `palette-review.jpg`. This tests the direction text, not complete accessibility conformance.

`npm run test:e2e -- --project=visual --output=sandbox/playwright/cleanup-design-visual-final --reporter=list --max-failures=1`: all 43 normal visual comparisons passed in 2.5 minutes after the final contrast adjustment, without baseline updates, retries or skips.

Firefox/WebKit, complete accessibility auditing and large-model performance remain outside this checkpoint. Local results do not establish hosted CI. Ignored `sandbox/` evidence may be absent from other checkouts.

## Development watcher regression

The reported Linux `ENOSPC` arose while Vite watched generated engine sources under `sandbox/opensysml-build`. The development configuration now excludes `sandbox/` and prepared `static/vendor/` binaries without disabling source watching or changing operating-system limits. `node --test scripts/vite-watch.test.mjs` exercises the actual Vite watcher: the original configuration failed because sandbox directories were watched; the fixed configuration passed, with source watching retained and both generated trees excluded. Evidence: `sandbox/shell-session/vite-watch-before.log` and `vite-watch-after.log`.

`npm run dev -- --host 127.0.0.1 --port 4176 --strictPort` started successfully after engine preparation. HTTP smoke checks returned 200 for the landing page, `/src/main.tsx` and the OpenSysML WASM asset. The dev server remained running without the reported watcher error. Excluding vendor binaries from watching does not prevent serving them; regenerated binaries require a page reload.

## Retained regression evidence

The latest browser coverage above includes the existing identity, authoring, diagnostics, source assistance and recovery suites. Earlier deliberate-fault records explain why critical preservation checks exist:

| Invariant tested            | Deliberate fault and observed failure                                                                                              | Local evidence                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Live workbench preservation | Unmounted the workbench when opening the launcher; source-editor DOM identity assertion failed, restored implementation passed     | `sandbox/shell-session/launcher-lifetime-fault.log`, `sandbox/playwright/shell-lifetime-restored`              |
| Draft query freshness       | Removed the stale-completion guard; targeted regression failed, restored code passed                                               | `sandbox/language-stale-fault.log`                                                                             |
| Recovery preservation       | Removed startup-copy protection, clean clearing or restored-unsaved baseline; each targeted assertion failed, restored code passed | `sandbox/recovery-pending-fault.log`, `sandbox/recovery-clean-fault.log`, `sandbox/recovery-unsaved-fault.log` |
| Issue/source binding        | Removed diagnosed-text equality guard; stale-location regression failed, restored code passed                                      | `sandbox/diagnostic-stale-fault.log`                                                                           |
| Raw source navigation       | Removed UTF-16/CRLF translation; source-selection regression failed, restored editor scenarios passed                              | `sandbox/source-editor-fault.log`                                                                              |

Historical hosted evidence: [Validate run 41314513339](https://github.com/Open-MBEE/sysml_view_editor/actions/runs/41314513339) passed for code head `f708b84`. That result does not establish CI for the later shell branch. Older milestone commands, counts and captures are available in Git history; they do not describe the current test inventory. Local artifacts under ignored `sandbox/` may be absent from other checkouts.
