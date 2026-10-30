# Verification record

## Model ownership tree checkpoint

Recorded 2026-10-30 on `feat/clean-foundation`. Explorer's Model list now projects recorded `ownerId` relationships into a collapsible tree. Rows retain full declaration/type identifiers, show kind/type labels and use shared shadcn Button/IconButton controls. Native tree/group semantics and one roving tab stop support visible-row arrows, Home/End, type-ahead and explicit Enter/Space selection. Diagram selection reveals the owner chain without taking focus, including a second click on the same symbol after folding its branch. No engine pin, semantic transaction or portable-project format changed.

`npm run check` passed formatting, architecture, TypeScript, 77 Vitest tests and 5 Node script tests. Fresh Playwright web-server builds passed with the existing chunk-size warning. `npm run test:e2e -- --project=functional model-tree.spec.ts workspace.spec.ts panels.spec.ts preservation.spec.ts authoring.spec.ts assembly.spec.ts --max-failures=1 --output sandbox/playwright/tree-workflows-results --reporter=list` passed all 27 scenarios in 4.2 minutes. These include the three new real-engine tree paths and the affected existing selection, authoring, preservation and panel workflows.

Visual comparison: `npm run test:e2e -- --project=visual --output sandbox/playwright/tree-visual-final-results --reporter=list` passed all 17 scenarios in 1.2 minutes. The four new tree captures were then scoped to the visible Explorer viewport, excluding content outside its scrolling boundary. Desktop/narrow light/dark images were inspected and regenerated separately; the final normal comparison `npm run test:e2e -- --project=visual --grep 'model ownership tree' --max-failures=1 --output sandbox/playwright/tree-capture-final-results --reporter=list` passed all four in 19.4 seconds without snapshot updates. The other 13 visual baselines are unchanged. This pass covers 27 functional and 17 distinct visual scenarios against the restored production code.

The tree cases distinguish identically named action parameters by actual owner and resolved type; retain invalid drafts, source-file choice, applied view, camera and exact project data through browsing; exercise focus separately from selection; and verify repeated diagram selection. Existing model-selection helpers expand hidden branches explicitly and assert `aria-selected`; semantic source, occurrence identity and saved-position assertions remain intact.

The deliberate regression runner `python3 sandbox/tree-faults/run.py` removed the UI's repeated-selection reveal request. The first diagram selection revealed the usage; after folding its owner, the second heading click failed the intended selected-usage assertion. The retained trace records two pump-heading clicks. The runner recorded `observedExit: 1` and `restored: true`; restored source digest and original source are retained with `sandbox/tree-faults/outcome.json`. Failure evidence is in `sandbox/playwright/tree-fault-results/`.

An initial test selected the pump's inlet button by clicking the node's centre, as confirmed by its trace and Inspector identity. The test now clicks the visible pump heading to select the intended usage. Evidence remains in `sandbox/playwright/tree-selection-setup-results/`. A screenshot setup race also exposed the panel-options popover restoring focus after the tree was focused; the trace showed Explorer panel options active and the branch still closed. The setup now waits for that focus return before navigating the tree. Evidence remains in `sandbox/playwright/tree-visual-focus-results/`. Neither correction relaxes a source, identity, focus or geometry assertion.

The unrelated example-library, worker-identity, appearance and default-startup functional suites were not rerun for this UI slice. Firefox/WebKit, hosted CI, complete accessibility/screen-reader coverage and large-model performance were not run. Declared members are shown under their recorded owners; inherited members are not cloned beneath typed usages, and Explorer selection does not add a new source-range contract.

## Public-content review

Recorded 2026-10-30. Reviewed all 186 tracked files and, before cleanup, 265 reachable Git blobs (32 binary). Pattern scans found no absolute home-directory paths, private-key/token markers, authenticated credential URLs or quoted credential assignments. Tracked PNGs contained no text or EXIF metadata chunks. This was a targeted local content review, not a comprehensive security audit.

Removed a personal requester name and workstation-specific context/SSH instructions from current documentation. Contributor instructions now describe portable environment checks, and README names the current repository. Required copyright/provenance notices and standard Git author/committer attribution are retained. Earlier document versions remain in Git history; no history rewrite was performed. Ignored local artifacts and local Git/SSH configuration are outside the tracked repository.

The final scan of all 186 tracked files found no personal/workstation-reference, home-path or credential-marker matches. Commit messages contained no home-path or credential-marker matches. URL hosts were public services or the documented loopback development address. `npm run check` passed formatting, architecture, TypeScript, 73 Vitest tests and 5 script tests; `npm run build` passed with the existing chunk-size warning. Browser checks were not rerun for these documentation-only changes.

## Panels, icons and richer startup checkpoint

Recorded 2026-10-30 on `feat/clean-foundation`. The usability pass adds shadcn-based resizable panels, shared Lucide icon buttons, contextual panel edge rails and measured toolbar alignment. The startup project is now [Smart air workshop](../examples/air-compressor/README.md), opening Pneumatics in Diagram mode. These are local checks; hosted CI and publication are separate.

| Command/check                                                                                                                                                       | Observed result                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                                                                                     | Passed formatting, architecture, TypeScript, 73 Vitest tests and 5 Node script tests                                               |
| `npm run build` through fresh Playwright web-server starts                                                                                                          | Passed prepared-engine verification, TypeScript and static build; existing chunk-size warning remains                              |
| `npm run test:e2e -- --max-failures=1`                                                                                                                              | 36 functional scenarios passed; stopped at the tooltip setup failure explained below                                               |
| `npm run test:e2e -- --project=visual --update-snapshots --output sandbox/playwright/toolbar-visual-results --reporter=list`                                        | 13 scenarios generated/reviewed in 53.9 seconds; generation is separate from comparison                                            |
| `npm run test:e2e -- panels.spec.ts toolbar.spec.ts workspace.spec.ts visual.spec.ts --max-failures=1 --output sandbox/playwright/ui-final-results --reporter=list` | Final comparison: 29 passed in 2.8 minutes, including 16 functional and all 13 visual scenarios, without snapshot updates or skips |

Together the 36 passing functional scenarios and final 29 cover all 60 defined browser scenarios (47 functional, 13 visual), with the five panel scenarios repeated against the final CSS. The final run includes the corrected tooltip setup, wide/narrow alignment, single-editor spacing/wrapping and all remaining workspace cases. Earlier semantic/engine scenarios were retained after the final CSS-only adjustment; the first full command did not finish green. Final artifacts are in `sandbox/playwright/ui-final-results/` and its command log is `sandbox/final-browser.log`.

Changed captures were inspected for the startup workbench at desktop/narrow sizes, nested assembly diagrams and resized panels in both themes; the Appearance narrow capture was also reviewed. The final comparisons retain the inspected baselines. Cropping after resizing preserves the current camera; Fit view remains an explicit action.

The startup scenario checks six exact engine node names (the assembly and five components), thirteen ports, four named connections, fourteen view declarations, unchanged download of all nine source files and independent source-file/view selection. The catalog adds all fourteen views with explicit targets and gaps. Six structural/definition/tree views render partial representations; eight behavior/sequence/geometry views report unavailable renderers. Engine evaluation does not imply application rendering, simulation, verification or conformance. All nine imported source files were byte-compared with the legacy model; provenance and license are retained in NOTICE.

Panel scenarios cover pointer and keyboard resizing, button alternatives, minimums, collapse/restore and focus, preference reload/reset, blocked/corrupt storage and invalid-draft preservation. The real-engine assembly path compares exact sources/drafts, compatible rendered and saved geometry in both views, selection, source DOM identity and camera state. Toolbar scenarios check accessible names/tooltips, source history, zoom/fit/lock, actual pane/group centre lines and SVG centring. Focused Workshop history/palette scenarios explicitly import the small fixture rather than treating it as startup.

Two deliberate faults established that the regressions detect their intended failures before production code was restored:

- `python3 sandbox/panel-faults/run.py`: removing the fit-once guard made divider resizing change the camera; the preservation scenario failed its camera comparison. The runner restored the original file and recorded `observedExit: 1` and `restored: true`.
- `python3 sandbox/panel-faults/run-centering.py`: moving source commands 40 px off centre made the toolbar assertion fail at 39.71875 px against its unchanged 1 px limit. The runner restored the original file and recorded `observedExit: 1` and `restored: true`.

An initial full run exposed an existing saved-coordinate boundary problem: fractional ancestor offsets could put a valid child a floating-point rounding increment beyond its owner, discarding its saved point on reopen. Three of five added fractional-offset cases failed before the fix. Commit `6359216` makes owner-bound validation allow a `1e-7` numerical epsilon; a point `0.001` outside remains rejected. All ten structure tests and the three real-engine assembly browser scenarios passed after the fix. Portable saved-coordinate equality and browser assertion tolerances were retained.

The first run after switching startup exposed a palette test that still expected Workshop immediately after reload. Its retained trace showed the correct Smart air workshop startup. Palette tests now explicitly reimport their Workshop fixture after startup, and the project-reopen test waits for the new startup before importing its saved bundle; their original source, color and coordinate assertions are retained. The failure trace remains in `sandbox/playwright/default-migration-results/`, with its log in `sandbox/default-migration-browser.log`.

The subsequent full run passed 36 functional scenarios, then stopped at a tooltip test: startup setup had already clicked and focused Split, so calling `focus()` again did not produce a new focus event. Its trace showed this sequence. The test now focuses source before focusing Split, retaining its tooltip text, Escape dismissal and focus-return assertions. That run also exposed a separately measured 10 px overlap between Diagram and Workspace layout in single-editor mode. Separate columns with an 8 px gap fix it; constrained desktop editors wrap those groups to another row. The toolbar test checks both separation and wrapping. Its original failure trace and the 36 passing scenarios remain in `sandbox/playwright/results/`, with the log in `sandbox/pre-toolbar-browser.log`.

A follow-up alignment run caught a 29 px source-action offset at a 768 px viewport: the compact flex row fitted history beside source commands. The compact source group now takes a full row, keeping its centre aligned with the pane. The original 1 px assertion is unchanged. Evidence is retained in `sandbox/playwright/toolbar-narrow-results/` and `sandbox/toolbar-narrow-browser.log`.

Fault inputs, original sources, logs and restoration records are in ignored `sandbox/panel-faults/`; failure traces/screenshots are in `sandbox/playwright/panels-fault-results/` and `sandbox/playwright/toolbar-fault-results/`. The exploratory direct-worker model capture is `sandbox/air-compressor-evidence.json`, separate from the application tests. Snapshot generation and visual comparison are separate checks; intentional baselines represent the new startup project, controls and panel layout.

Firefox/WebKit, hosted CI, complete accessibility/screen-reader coverage and large-model performance were not run. Keyboard/focus checks and image inspection do not establish complete accessibility. No engine pins or portable project format changed.

## Assembly editing milestone checkpoint

Recorded 2026-10-29 on `feat/clean-foundation`, after the identity investigation commit `fd54b67`. The working tree implements reviewed definition/usage rename preservation, bounded source-edit preservation and typed part/port-connection authoring. These are local results for the supported assembly subset; no new commit, hosted CI result or general SysML conformance is implied.

Environment: Node 26.3.1, npm 11.16.0, locked Playwright with bundled Linux Chromium and the existing pinned/prepared engines. No dependencies, engine pins, checksums, bridge overlays or version-1 project format changed.

| Command/check                                                                                                                         | Observed result                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                                                       | Passed formatting, architecture, TypeScript, 64 Vitest tests and 5 Node script tests                                                                                                                                                                             |
| `npm run build` (standalone and Playwright web-server builds)                                                                         | Passed prepared-engine verification, TypeScript and the static build; the existing chunk-size warning remains                                                                                                                                                    |
| `npm run test:e2e -- --max-failures=1`                                                                                                | 45 passed in 5.1 minutes: all 37 functional scenarios and the then-current 8 visual scenarios, without snapshot updates or skips                                                                                                                                 |
| `npm run test:e2e -- --project=visual --output sandbox/playwright/visual-final-results --reporter=list`                               | Final comparison after adding narrow dark-theme coverage: all 9 visual scenarios passed in 31.3 seconds, without snapshot updates or skips                                                                                                                       |
| Changed/new baseline inspection                                                                                                       | Inspected the 5 changed workbench/assembly PNGs and all 8 new part/connection form PNGs, including desktop and narrow forms in both themes. Complete selected endpoints wrap below narrow selectors; the narrow workbench retains its existing scrollable layout |
| Deliberate position-transfer fault, checked by the definition-rename regression using `sandbox/milestone-faults/playwright.config.ts` | Deliberately disabling position transfer failed at the intended retention assertion: structure retained 0 instead of 5 positions and devices retained 0 instead of 3. Original code was restored; subsequent focused and full normal runs passed                 |

The 37 functional and final 9 visual scenarios cover all 46 currently defined browser scenarios across the two normal commands above. Baseline generation for the added narrow dark case was a separate review step; generation is not counted as a successful comparison.

The preservation scenarios check exact accepted source, updated resolved bindings/references, full repeated-usage identity, saved coordinates in both views, actual rendered coordinates, undo/redo and fresh reload/import. They cover definition and usage renames separately, Unicode prefix insertion, an unexposed declaration edit in another file, invalid draft retention and explicit invalidation after usage reordering. Controlled reconciliation cases separately reject file/owner/type changes, deleted/replaced declarations and ambiguous correspondence without lending new symbols another usage's position.

The authoring workflow creates an existing-definition-typed usage, moves it independently in both views, connects its inherited output to the intended other usage's input, and checks actual evaluated endpoints through history and fresh import. A second creation path promotes a typed semicolon owner while preserving surrounding source. Duplicate-name refusal, injected Toolkit asset failure/recovery, cancelled reviews and cancellation during preparation preserve source, layout and history. Keyboard checks cover focus containment, trigger return and workspace fallback when acceptance removes the original port trigger.

An earlier reopen assertion exposed CSSOM transform rounding: saved `974.911688741722` becomes computed CSS `974.912`, a difference of `0.000311258278`. The helper now normalizes expected coordinates through the same browser serialization before applying its unchanged `0.0001` threshold; portable-project coordinates still require exact equality. The isolated reproduction is retained in `sandbox/coordinate-precision.json`. This is a test representation correction, not a renderer-coordinate change or widened tolerance.

The full HTML report and retained engine inputs/evaluations are in ignored `sandbox/playwright/report/` and `sandbox/playwright/results/`; the final visual comparison uses `sandbox/playwright/visual-final-results/`. Fault configuration, original source and restoration outcome remain in `sandbox/milestone-faults/`; the trace, screenshot and failed assertion are in `sandbox/playwright/milestone-fault-results/` with the earlier fault report in `sandbox/playwright/milestone-fault-report/`. Isolated pinned-SDK insertion/direction probes are retained under `sandbox/graphical-authoring-audit.*` and `sandbox/owned-insertion-audit.*`; they are contract evidence separate from application tests.

The security audit, Firefox/WebKit, hosted CI, complete accessibility/screen-reader coverage and large-model performance were not run for this milestone. Conjugated/undirected or ambiguous connection paths, general subtype compatibility, arbitrary persistent identity, manual overlap avoidance and parent resizing remain unsupported. [Capabilities](capabilities.md), [preservation policy](architecture/identity-reconciliation.md), [authoring scope](architecture/graphical-authoring.md) and [next steps](next-steps.md) describe the bounds and follow-up work.

## Commit preparation

Recorded 2026-10-30. Refreshed the README's explicit port direction/path limits and the roadmap's completed milestone wording. The repository context, Git identity, SSH agent and remote were verified on `feat/clean-foundation`.

`npm run check` passed formatting, architecture, TypeScript, all 64 Vitest tests and 5 Node script tests. `npm run build` passed engine preparation and the static build with the existing chunk-size warning. Only documentation changed after the assembly checkpoint's final runtime/browser verification; its 37 functional and 9 visual results above were retained rather than rerun. Hosted CI and other browsers were not run for commit preparation.

## Identity investigation checkpoint

Recorded 2026-10-26 after the foundation commit. The [identity investigation](architecture/identity-reconciliation.md) and its [source-contract notes](architecture/engine-identity-sources.md) cover source-revision comparisons and the conditions for matching repeated usages. This pass adds documentation and worker/SDK browser checks; automatic layout reconciliation is not implemented.

Environment: Node 26.3.1, npm 11.16.0, the locked Playwright installation and bundled Chromium, with the existing pinned/prepared browser engines.

| Command/check                                                                                                                             | Observed result                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                                                           | Passed formatting, architecture and TypeScript checks, 44 Vitest tests and 5 Node script tests                                                                                           |
| `npm run build`                                                                                                                           | Passed prepared-engine verification, TypeScript and static build; the existing main-chunk size warning remains                                                                           |
| `npm run test:e2e -- --project=functional identity.spec.ts --max-failures=1 --output sandbox/playwright/identity-results --reporter=list` | Final normal run: 2 passed in 47.3 seconds, no skipped tests                                                                                                                             |
| `npm run test:e2e -- --config sandbox/identity-faults/playwright.config.ts --grep 'investigates identity' --max-failures=1`               | Deliberately faulted copy failed at the distinct-usage-context assertion: expected 3 contexts, received 1. The normal spec was unchanged by this fault; its subsequent normal run passed |

The first scenario captures 11 source sets and both assembly views for each. The second records actual Toolkit UUID changes and filename-keyed UTF-8 byte splices, verifies exact replay against the transformation worker's sources, and joins all 15/10 view correspondences through transported origins and complete usage contexts. It also checks the existing rename postconditions. JSON inputs, models, evaluations, provenance, edit reports and matches are retained under `sandbox/playwright/identity-results/`.

The fault experiment erases repeated-port context arrays in an isolated copied assertion helper after receiving real engine replies. This checks the regression assertion's sensitivity; it is not an engine defect or evidence of application layout retention. Its copied spec/config, trace and report remain under `sandbox/identity-faults/`, `sandbox/playwright/identity-fault-results/` and `sandbox/playwright/identity-fault-report/`.

Full UI/visual suites, the security audit, Firefox/WebKit and hosted CI were not rerun for these documentation/test-only changes. No production source, dependencies, engine pins, project formats or visual baselines changed. Earlier full-suite results remain historical records below.

## Foundation commit checkpoint

Recorded 2026-10-26. The foundation, structural rendering slice and example library are committed in `a2d0d91` (`feat: establish SysML v2 view editor foundation`) on `feat/clean-foundation`. The working tree was clean immediately after that commit.

The pre-commit verification used Node 26.3.1 and npm 11.16.0:

- `npm run check` passed formatting, architecture and TypeScript checks, 44 Vitest tests and 5 Node script tests.
- `npm run build` passed prepared-engine verification, TypeScript and the static build. Vite reported the existing chunk-size warning; the main JavaScript chunk was approximately 2.10 MB before gzip.
- Browser scenarios and the security audit were not rerun for this commit. Their earlier recorded results appear below and remain historical evidence.

The commit was created locally; no push, hosted CI run or deployment was performed in this checkpoint. The sections below retain the checks reported during development before the initial commit, including their original scope and limitations.

## Initial foundation

Recorded 2026-10-26 against the uncommitted `feat/clean-foundation` working tree. These are local results, not hosted CI or publication evidence.

Environment: Node 26.3.1, npm 11.16.0, React/React DOM 19.3.1, TypeScript 6.0.3, Vite 8.2.4, TypeBox 1.4.2, React Flow 12.12.0, Playwright 1.64.1 and installed Google Chrome through Playwright's `chrome` channel.

| Command/check                                                            | Observed result                                                                                                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                          | Passed formatting, architecture import/platform rules and TypeScript checks; 32 Vitest tests and 2 Node architecture-rule tests passed                                           |
| `npm run engines:prepare`                                                | Verified prepared Toolkit assets; built the derived OpenSysML WASM with pinned Go 1.25.11; retained combined bridge tests passed; upstream engine package reported no test files |
| `npm run build`                                                          | Passed; static output written to ignored `build/`                                                                                                                                |
| `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:e2e -- --max-failures=1` | 8 passed in 24.6 seconds on the final run after the shadcn/appearance integration; see the scenarios below                                                                       |
| `npm audit --audit-level=low`                                            | Zero reported vulnerabilities                                                                                                                                                    |
| `git diff --check`                                                       | No tracked-diff whitespace findings; formatting also checked owned untracked source                                                                                              |
| Browser capture review                                                   | Desktop and narrow captures retained in ignored `sandbox/captures/`; capture session reported no page errors                                                                     |

The browser scenarios exercise the actual WASM engines:

1. Load source-defined views; switching source files retains the selected view.
2. Retain invalid drafts and the previous valid diagram, then discard drafts.
3. Prepare/apply a Toolkit part-definition rename, inspect updated usage references and undo the source transaction.
4. Create a native view declaration through a reviewed source transaction and open it.
5. Move a symbol, save a project with an unfinished draft and reopen its sources/drafts/presentation.
6. Switch all six palettes in both themes, follow live system changes only when selected, and keep appearance out of model history/project serialization.
7. Retain/reset custom muted colors across palette changes and reload; dismiss a dialog with Escape and restore focus to its opener.
8. Apply appearance settings when browser storage is denied, with a visible persistence message.

An earlier browser run exposed decorative glyphs in accessible button names. Labels were corrected; the final five-scenario run passed. No tests were removed or skipped to obtain that result.

The appearance pass added three browser scenarios and retained the original five. Visual captures of Light, Dark, the Appearance dialog and a 768 px viewport are retained under `sandbox/captures/design-system-*.png`. The capture session reported no page errors. It exposed fixed-height/centered shadcn navigation rows; the workbench now uses content-sized, left-aligned rows. The development server was restarted after installing the Tailwind plugin to clear its earlier missing-module state.

## Remaining limits

- Vite reports a chunk-size warning: the main JavaScript bundle is approximately 2.09 MB before gzip, including the graph/layout stack and UI primitives. Further loading/layout-worker improvements need measurement; no performance budget or large-model benchmark was verified.
- Browser checks used desktop Chrome. Other browsers, narrow-screen editing parity, screen-reader behavior and complete keyboard accessibility were not certified. Narrow captures are visual inspection only.
- Automatic browser recovery, source-language assistance, compound/port notation, other renderer families and broader semantic commands remain documented in capabilities.
- The source/model/engine contract is tested for this initial slice; this does not establish full SysML conformance.
- Hosted CI, deployment, Git commits and pushes were not performed.

## Frontend regression strengthening

Recorded 2026-10-26 after the initial foundation results above, against the same uncommitted feature branch. These are local results on Ubuntu 24.04.5 with Node 26.3.1, npm 11.16.0, Playwright 1.64.1 and its bundled Chromium 156.0.8078.4. See [the browser testing workflow](testing.md) for reproduction and baseline review.

| Command/check                                                                                                                                     | Observed result                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                                                                   | Passed formatting, architecture and TypeScript checks; 32 Vitest and 2 Node tests passed                                                                                                                                                                                                          |
| `npm run build`                                                                                                                                   | Passed engine asset verification, TypeScript and the production build; the existing main-chunk size warning remains                                                                                                                                                                               |
| `npm run test:e2e -- --max-failures=1`                                                                                                            | 15 passed in 1.1 minutes: 12 functional scenarios and 3 visual scenarios; no tests skipped                                                                                                                                                                                                        |
| Visual baseline review                                                                                                                            | Inspected all six new Linux Chromium PNGs: light/dark workbench and expanded Appearance dialog, plus 768 px workbench and keyboard-focused dialog; the final run compared them without updating snapshots                                                                                         |
| `npm run test:e2e -- --config sandbox/fault-checks/playwright.config.ts --grep 'downloads and reopens\|workbench and appearance dialog in light'` | Two deliberately faulted copies failed at the intended assertions: missing imported positions restored the default coordinates instead of the saved coordinates; forced magenta node fills produced a screenshot mismatch. The production tests and baselines were unchanged by these experiments |

The strengthened scenarios verify both resolved rename references and exact source undo/redo, cancellation without source/history changes, independent positions in two named views through a reload/import round trip, retained invalid drafts and diagram identities, repeated-usage selection/source ranges, engine asset failure with retained work and successful retry, rendered custom fills, explicit versus system theme behavior, and keyboard focus wrapping/return.

The repeated-usage test exposed an existing focus defect: clicking **Open source** in an already-open file retained focus on the button. The reveal action now reissues the recorded range so the editor focuses it; the original failing assertion passes after the fix. An early position test also caught a test synchronization problem: an old view's nodes can remain visible while the next view evaluates. The helper now waits for the requested view to be active and no longer busy before interacting with its symbols.

The final normal HTML report is in ignored `sandbox/playwright/report/`. Deliberately failing experiment traces, screenshots and the visual diff are retained separately in `sandbox/playwright/fault-results/` and `sandbox/playwright/fault-report/`; the isolated copied specs/config are under `sandbox/fault-checks/`. The CI workflow is configured to retain browser evidence for seven days, but hosted execution and artifact upload were not performed here.

No dependencies, engine pins or project formats changed. Firefox/WebKit, automated accessibility scanning, complete keyboard/screen-reader coverage and large-model performance checks remain unverified. The narrow screenshot records the existing scrollable layout; it does not establish narrow-screen editing parity.

## First structural rendering slice

Recorded 2026-10-26 after the frontend regression work above, on the same uncommitted feature branch and Linux/Node/npm/Chromium environment. The shared source fixture and scope are documented in [structural views](architecture/structural-views.md).

| Command/check                                                                                           | Observed result                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                         | Passed formatting, architecture and TypeScript checks; 44 Vitest tests and 2 Node architecture-rule tests passed                                                                                                                                                                      |
| `npm run build`                                                                                         | Passed asset/provenance verification, TypeScript and static build; the existing main-chunk size warning remains                                                                                                                                                                       |
| `npm run test:e2e -- --max-failures=1`                                                                  | Final normal run: 20 passed in 1.3 minutes, with no skipped tests. Includes 15 functional scenarios and 5 visual scenarios comparing eight reviewed baselines without snapshot updates                                                                                                |
| Pinned Go 1.25.11: `go test -count=1 ./internal/frontend/combined ./internal/frontend/engine`           | Passed from the prepared source with local build/module caches; combined tests include the shared assembly fixture. The upstream engine package reported no test files                                                                                                                |
| Pinned Go 1.25.11: `go test -count=1 -run TestStudioStructuralAssembly -v ./internal/frontend/combined` | The dedicated structural contract test passed: nested ownership, explicit inherited-port directions, reference modifier, resolved endpoints, distinct usage contexts and unsupported-action notice                                                                                    |
| Isolated browser fault checks                                                                           | Two copied scenarios deliberately failed: shifting source-port handles away from the SVG endpoint failed the physical endpoint assertion, and constraining the canvas width failed the diagram-expansion/refit assertion. Normal production tests were unchanged by those experiments |

The three new functional browser scenarios load `examples/assembly/` through the real pinned workers. They check nested bounds, reference notation, explicit direction labels, actual SVG/port attachment points, keyboard selection/source reveal for shared inherited ports with distinct contexts, moving an assembly plus a child, switching views and fresh reload/import with absolute positions and exact source retention. The devices view reports the exposed unsupported action. The two new assembly snapshots cover light and dark in diagram-only mode.

Visual review exposed stale split-mode zoom after expanding the diagram pane. The canvas now refits when its available dimensions change; the new assertion checks that the assembly grows into the expanded pane. Existing six workbench/dialog baselines passed unchanged. Endpoint assertions use the outward handle edge where React Flow attaches the line, not the handle center.

The original and updated raw engine traces are in ignored `sandbox/assembly-before-trace.json` and `sandbox/assembly-trace.json`; the latter includes generated provenance. Deliberately failing scenarios and reports are isolated under `sandbox/structure-faults/`, `sandbox/playwright/structure-fault-results/` and `sandbox/playwright/structure-fault-report/`. They were run with:

```sh
npm run test:e2e -- --config sandbox/structure-faults/playwright.config.ts --grep 'real port endpoints|canvas refit fault'
```

Upstream pins/checksums/licenses and the version-1 project shape remain unchanged. The bridge/builder/input digests and derived WASM were regenerated, including the shared example sources in preparation's digest. No dependencies were added. Source revisions still invalidate layout; graphical part/connection authoring, broader owned-port/conjugation notation, modeled geometry/routes, performance budgets, other browsers and full accessibility remain outside verified scope. Hosted CI, commits and pushes were not performed.

## Visualization example library

Recorded 2026-10-26 in the same local environment and uncommitted feature branch. The [library index](../examples/README.md) is generated from a TypeBox-validated catalog. It contains 12 independent projects, 24 source files and 19 named views: 6 scoped as rendered, 6 partial and 7 with unavailable application renderers. All 19 evaluate as complete/available engine artifacts; application availability is checked separately.

| Command/check                                                          | Observed result                                                                                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run examples:index` and `node scripts/examples-index.mjs --check` | Generated the index and confirmed synchronization with catalog targets/support/gaps                                                                                                   |
| `npm run check`                                                        | Passed formatting, architecture and TypeScript checks; 44 Vitest tests and 5 Node checks passed, including example inventory, metadata invariants and generated-index synchronization |
| `npm run test:examples -- --max-failures=1`                            | Catalog checks passed; all 12 dedicated browser scenarios passed in 1.5 minutes                                                                                                       |
| `npm run test:e2e -- --max-failures=1`                                 | All 32 scenarios passed in 3.8 minutes, with no skipped tests; includes 27 functional and 5 visual scenarios. Existing eight visual baselines passed without updates                  |
| `npm run build`                                                        | Production build and prepared-engine verification passed; the existing chunk-size warning remains                                                                                     |

Library browser checks import every project, select every cataloged view, observe real worker replies without replacing them, check exact node-name/edge-kind multisets, compare rendered edge counts, verify expected availability/notices, and download/reopen exact applied/draft sources. Repeated motor names in the parts fixture are selected by engine correspondence and checked against their distinct qualified identities. Comment/documentation text includes Unicode and remains byte-equivalent in the exported source strings.

Current per-view PNGs and engine JSON are retained under `sandbox/playwright/results/examples-example-library-*/` and attached to the normal HTML report. Inspected captures include comments, the package outline and unavailable package graph, nested parts and definition relationships, conjugated ports, unavailable use-case rendering and the valid empty view. The catalog records visible tree-label overflow, incomplete relationship notation and port-label routing alongside missing comment callouts and renderer families. These captures are current-state evidence, not new golden comparisons or certification that all visual targets are met.

An isolated copy removed the `satisfy usableCapacity by storage` relationship before import. The source still evaluated, but the expected requirement graph lost its storage node; the catalog assertion failed as intended. The original source fixtures were untouched. The normal requirements scenario then passed again. Commands:

```sh
npm run test:e2e -- --config sandbox/example-library-fault/playwright.config.ts --grep 'example library: requirements'
npm run test:e2e -- --project=functional examples.spec.ts --grep 'example library: requirements' --output sandbox/playwright/library-restored-results --reporter=list
```

The first command deliberately failed; the second passed. Fault evidence is isolated in `sandbox/playwright/library-fault-results/` and `sandbox/playwright/library-fault-report/`; the restored scenario retained its captures separately. The normal 32-scenario HTML report remains in `sandbox/playwright/report/`.

No production dependencies, engine pins, project formats or application renderers changed for the library. Package/case/requirement/action/state/sequence rendering, comment callouts and the recorded partial-notation gaps remain development targets. Firefox/WebKit, hosted CI and complete accessibility were not checked in this pass.
