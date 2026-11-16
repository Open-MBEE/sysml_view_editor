# Source values, inspection and camera review

Recorded 2026-11-11 against the uncommitted frontend/workspace slice based on editor `618e776466817d9064027b8c9756065df05766bb`. This reviews the parent’s implementation before its response to the findings below. The parent acknowledged both findings and is fixing them; this note is not a post-fix approval.

Scope: source-value TypeBox/publication validation, inspection/source separation, camera controls, panel restoration and focused tests. Engine value-provider semantics are reviewed separately. No production files, shared assets, builds, browser/server processes, commits or remote services were changed by this review.

## P2: anonymous requirement inspection loses source-backed documentation

At the review point, `Properties.tsx:115–129` renders `requirement.shortName` and `requirement.documentation` only inside the `element` branch. Its `subject` fallback at lines 205–233 renders identity and source navigation but omits those fields. `Workbench` derives `element` from `state.model.elements`, while requirements extraction has an independent source-subject contract. A real anonymous requirement reaches the no-element fallback:

```sysml
package P {
    requirement { doc /* The pump shall preserve pressure. */ }
}
```

The isolated pinned-native [probe](../../sandbox/source-values/ui-review/anonymous_test.go) strict-parses that source. `GetSymbol(P)` returns `childIds: [P::]`; the semantic worker explicitly skips IDs ending in `::`. `EvaluateRelationships` nevertheless returns a complete requirement row with qualified name `P::` and the exact documentation. The table can inspect this row, but its Inspector fallback omits the already supplied text. [Native output](../../sandbox/source-values/ui-review/anonymous.log), exit 0, reported package time 0.032 s.

My initial message incorrectly suggested that the 2,000-symbol limit could create a truncated model: the full guard actually throws and rejects parsing. That proposed large-model trigger is withdrawn. The anonymous-requirement control above independently establishes a native source/extraction trigger; no full browser reproduction is claimed.

The isolated [server-rendering regression](../../sandbox/source-values/ui-review/fallback.test.ts) passes a real-shaped requirement row with `REQ-42`, documentation, a source subject and no `element`. It confirms the identity is present, then fails because `REQ-42` is absent; the retained HTML also lacks the documentation. [Output](../../sandbox/source-values/ui-review/fallback.log), exit 1. This controlled React test verifies the UI fallback, not native SysML extraction or a browser workflow.

Render source-backed requirement details independently of the optional model-tree entry. The same principle applies to available artifact documentation and usage context when a diagram subject is absent from the model-tree entry. Do not fabricate a `ModelElement` or renderer identity to enter the richer branch.

## P2: Read at 100% can focus a different item than the Inspector

`useDiagramRead.ts:10–16` chooses `getNodes().find(node => node.selected)`, then a root. It has no input carrying the shell’s inspected symbol. However, the requirement card’s **Inspect details** button stops propagation and calls `select(item.id)` (`RequirementNode.tsx:61–64`); structural port buttons do the same for their port ID (`StructureNode.tsx:113–117`). These update shell inspection through `Workbench.selectSymbol`, but do not update React Flow’s `node.selected`. Model-tree selection likewise updates shell inspection without synchronizing React Flow selection.

Concrete control flow: select node A on the canvas, then use the explicit Inspect button on B (or a port on B). Inspector changes to B, while React Flow can retain A as its selected node. **Read at 100%**, titled “Read selection or first element at 100%”, then centers A. This breaks the intended inspection-to-readable-detail handoff. This finding is established by the event handlers and state ownership; no browser reproduction is claimed.

Pass the exact currently inspected diagram symbol into the camera action, mapping a selected port to its owning rendered node. Preserve complete usage identity for repeated declarations. Keep first-element fallback explicit when no current diagram occurrence can be resolved; do not match a tree label or a short name to an arbitrary occurrence.

## Source and preservation assessment

All production `validateEvaluation` publication sites inspected now receive the corresponding applied document set: the OpenSysML adapter, old/new view reconciliation, connection validation/postconditions, named-view opening, and exploration through its shared validation path. No missed production caller was found. Optional metadata leaves older responses usable; present metadata without applied documents is rejected rather than treated as trustworthy.

The new validator verifies declaration IDs against byte origins, exact declaration/expression slices, expression containment in the provider, own/redefined identity consistency, node/compartment context equality and duplicate rows. These are transport/source integrity checks. It appropriately does not claim to prove SysML provider precedence from source text; native semantic selection remains the bridge’s responsibility. Existing controlled tests distinguish those scopes.

`inspectionSource` bounds-checks integer UTF-8 ranges, refuses changed/missing drafts and rejects split code points before converting to editor UTF-16 positions. Inspection targets are model-hash gated; provider-source navigation additionally checks the current workspace snapshot. The reviewed handlers keep inspection separate from changing the active file/editor mode. No confirmed stale-source publication defect was found in this inspection.

The panel reopen change uses pixel minimums when a stored desktop percentage would be too small, and transfers focus on phone selection because opening Inspector collapses Explorer. The request counter changes only for explicit selection. Workbench panels remain mounted/inert during internal launcher navigation, so returning from Projects does not itself rerun the inspection effect. No confirmed panel-lifetime defect was found.

The new camera action changes viewport only, and the automatic readable-entry path leaves explicit Fit view as an overview operation. Structural counts prefer new metadata but retain legacy declaration strings as fallback. Provider expressions are rendered as authored text, without evaluation. These source inspections do not establish browser geometry compatibility, routing quality or visual acceptance.

## Validation and remaining acceptance

Ran the controlled React regression:

```sh
fnm exec --using 26.3.1 npx vitest run \
  --config sandbox/source-values/ui-review/vitest.config.ts \
  > sandbox/source-values/ui-review/fallback.log 2>&1
```

One test failed at the intended missing-identifier assertion. The initial private config emitted a missing-file-extension warning, which did not cause the assertion failure.

Also ran the anonymous-requirement native probe twice, refining the second run to assert the actual `P::` model-tree child ID:

```sh
GOCACHE="$PWD/sandbox/source-values/ui-review/gocache" \
GOMODCACHE="$PWD/sandbox/opensysml-012/go-modules" \
GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off \
sandbox/opensysml-012/go/bin/go \
  -C "$PWD/sandbox/opensysml-012/source" test -mod=readonly \
  -overlay "$PWD/sandbox/source-values/ui-review/anonymous-overlay.json" \
  ./internal/frontend/combined -run '^TestUIReviewAnonymousRequirement$' \
  -count=1 -v > sandbox/source-values/ui-review/anonymous.log 2>&1
```

The virtual test overlays only a new combined-package test file onto the parent-prepared pinned source, with a private Go cache and offline/read-only module use. It does not alter engine code or prepare shared assets. No full app/unit suite, normal preparation/build, browser, screenshot comparison or remote check was run by this reviewer. Parent-owned running checks are not claimed here.

Before completion, retain post-fix coverage for fallback metadata and the actual custom Inspect/port-to-Read100 handoff, alongside pointer/keyboard selection, changed drafts, saved positions/fresh reopen, and long/Unicode expression access. The new readability tests currently establish entry zoom, one-click overview/read transitions and unchanged portable data; a zoom threshold alone cannot establish text visibility, unclipped details or routing quality. Actual assembly/stakeholder captures and overlap measurements at desktop/narrow sizes in both themes remain necessary. Visual-project verification is also required by the repository instructions.
