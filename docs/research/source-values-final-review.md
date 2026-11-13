# Final source-values review

Recorded 2026-11-11 against the current working tree, including the retained engine revisions and uncommitted UI/tests since `618e776`. This is an independent source review after the earlier engine and UI findings; it is not a browser or visual approval.

No confirmed remaining blocker was found in the reviewed paths. The earlier reports describe pre-fix states and should not be read as current failures.

## Fixes verified by inspection

The engine inventories external effects across project documents, distinguishes relative binding endpoints using the attachment AST and semantic membership, and retains explicitly namespace-qualified targets. Attribute-like redefinitions include kindless forms through `IsAttributeLike`. Bound owners with authored expressions fail closed rather than borrowing their type's member default. Source-value enrichment retains correspondence contexts and exact source declaration/provider/expression origins; it does not evaluate expressions or change graph identity. These observations verify the implemented guards, not exhaustive SysML precedence.

The publication validator checks applied UTF-8 slices, declaration identity, provider expression containment, provenance, exact usage context and duplicate compartment rows. The previously reviewed production publication sites pass applied documents. Provider navigation checks the current model hash and exact applied/draft equality again at invocation; recorded inspection ranges reject changed drafts, malformed ranges and split UTF-8 characters.

Tree previews prioritize declarations inside the selected owner's source span. Local display names come from model data. Structural cards now render a node's own source-attribute row as well as compartment rows, and reserve space using the same count. Full authored expressions remain available in Inspector.

The camera receives the exact inspected symbol and maps a port symbol to its rendered owner. Its fallback chooses a noncompound structural component (preferring a part) before a root container. It no longer consults an unrelated React Flow selection flag. Inspector reopening applies a pixel minimum only when the remembered percentage would be too small, retaining the percentage path on wider screens. Requirement identifier/documentation rendering is outside the optional model-element branch, repairing anonymous-row inspection.

## Acceptance boundary

This review ran no build, preparation, native tests, browser, server or screenshot comparison. The parent owns the fresh test results and screenshot audit; their reported results are not independent execution evidence here. In particular, the interrupted empty-container visual captures must not be accepted as final baselines. Completion still requires the parent's current normal visual comparison and direct inspection of desktop/narrow captures in both themes, plus the in-progress critical browser run. These are acceptance checks, not newly established application defects.

Source inspection cannot establish readable visible text, unclipped expressions, routing geometry, focus behavior or preservation after real-engine reopen. The retained browser cases now explicitly target authored values in exact usage contexts, anonymous requirement source access, custom Inspect-to-camera handoff, draft retention and responsive panes; their existence alone is not a passing result. No performance or exhaustive accessibility claim is made.

Read repository instructions, architecture ownership, requirements/data/layout/structural contracts, the three earlier review reports and the current source fixes. Wrote only this new report. No production edits, shared builds/assets, browser/server work, dependency changes, remote operations, commits or subagents were used.
