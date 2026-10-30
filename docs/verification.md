# Verification record

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

Recorded 2026-10-30. Refreshed the README's explicit port direction/path limits and the roadmap's completed milestone wording. `ctxcheck` confirmed the DSG directory, identity, 1Password SSH agent and `github.com-dsg` origin on `feat/clean-foundation`.

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
