# Generated document integration review

Recorded 2026-11-17. Review pins: PR39 `3a4860888a863ff68eb88fe233cf9efad9832a9d`, PR40 `4f947495dc540a921de237fb3145f1ea8ad68b2f`, develop `10b305a02b1054d905ae9de819b4051da04447e1`. Independent standards and specification reviews were followed by local integration and real-engine browser regressions. Original PR commits remain in the merge history.

## PR40 reconciliation

The diagnosis is useful: maximum-zoom normalization fixes scale, while integer mouse panning retains fractional camera origins. Its helper targets the old Split/Diagram labels and full-graph initial fit. Current develop has the new arrangement labels, readable 100% entry and explicit final-pane Fit before requirement capture. The merged PR47 tree is identical to develop; its retained twelve repeated requirement comparisons, 31 selected normal comparisons and hosted CI establish the current approach. Keep the scale-only clarification; avoid layering the obsolete mode-round-trip helper on top. PR40 is recommended for closure as superseded, not merged by this review.

## Standards findings and resolution

One P2: `DocumentPane` canceled Enter on native links and attempted source reveal. Its sanitizer intentionally preserves safe links, so keyboard and pointer behavior diverged. A controlled fragment-link fixture reproduced the failed URL assertion; the corrected activation guard preserves native href behavior and keeps source reveal for href-less model references. The strengthened fixture also verifies the active source file remains unchanged.

No heuristic refactor or confirmed script-execution defect was requested. This is not a comprehensive security audit.

## Specification and integration findings

One P2: an unrelated named-view failure skipped document refresh after accepted source changes. A real-engine Apply with explicit named-view worker failure reproduced the selected Document pane falling back to the generic empty prompt. Document refresh now runs independently of that display failure, with current-generation progress/error handling. A separate document transport failure shows an explanation and supports retry.

The original PR predates the sectioned Explorer and ModelPaneHeader. Integration retains current WorkspaceToolbar/SourcePaneHeader and DiagramTargetControls, conditionally adds Document to the authoritative representation selector, and uses the shared independent Documents disclosure. Arrangement remains separate from representation.

Two additional integrated regressions were found. Embedded previews omitted the applied-source argument now required by source-value validation; the real rover embedded view failed with “Source value origin is outside the applied project.” Previews now supply the same sources as named-view evaluation. Direct phone visual review also rejected a clipped Open as named view action; a new containment assertion failed by 192.03125 px before action/long-cell wrapping and passed afterward.

## Verification scope

Retained ignored evidence is under `sandbox/devin-review/`, with browser traces/screenshots under `sandbox/playwright/documents-*`. `browser-red3.log` reproduces both review findings. `browser-green2.log` passes four then-current workflows; `browser-final.log` passes six workflows including exact Apply/Undo/Redo, invalid draft retention, transport retry and narrow arrangement lifetime. `narrow-red.log` and `narrow-green2.log` retain phone containment red/green and stronger native-link checks. Document contract/lifetime unit tests cover stale envelopes, superseded replacement and disposal; all eight document unit cases pass.

`check-current.log` passes formatting, architecture, TypeScript, 187 unit tests and ten script tests. Normal engine preparation rebuilt the document overlay with unchanged upstream pins and retained provenance. All 35 critical workflows and 24 additional workflows passed in focused batches. All 110 visual scenarios passed final capture generation, followed by direct review of 69 changed/new images (61 existing and eight new) and 51 normal comparisons covering each changed/new image. All eight new document captures were inspected full size in desktop/phone light/dark states. The minimum-pane document source-reference case also passed. Exact commands, title/hash ledgers and retained failed attempts are recorded in [the verification record](../verification.md). Initial document captures were explicitly rejected for narrow clipping and are not final acceptance evidence.

No portable project fields, layout preference schema, production dependency or upstream engine pin changed. Full functional-suite rerun, Firefox/WebKit, targeted document screen-reader verification, comprehensive accessibility/security certification, deployment and upstream merge are not established here.
