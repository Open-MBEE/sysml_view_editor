# Next steps

Updated 2026-11-01. This is the forward plan; [capabilities](capabilities.md) describes shipped behavior and [verification](verification.md) records actual checks. No delivery dates are assigned.

## Current position

The editor supports reviewed rename/view/part/connection commands, bounded layout preservation, CodeMirror source editing and draft language queries, issue navigation, resizable panels and explicit browser recovery. The OpenMBEE landing → launcher → workbench flow is implemented. Opening the app does not load an example implicitly. Current diagrams require authored named views.

## 1. Read-only automatic exploration

Next feature priority: inspect an imported model without adding view declarations. Use a project/package overview when a system subject is ambiguous; offer structural exploration only where the engine demonstrates the intended definition or usage expansion.

The [engine investigation](research/automatic-exploration-contract.md) is complete for its bounded probes: native `RenderExposed` is promising, but the browser worker currently exposes only named-view evaluation. The tested typed usage did not unfold its definition's internals. Implement and validate that contract before promising a consolidated system diagram.

Acceptance is owned by the [exploration plan](architecture/model-exploration.md):

- No-view and multi-file/multi-system imports open useful, correctly scoped projections.
- Scope, representation and source-file navigation remain independent; repeated usages retain their context.
- Browsing and failed/superseded evaluation preserve exact source, drafts, semantic history and saved named-view positions.
- Temporary exploration does not modify source or borrow another subject's geometry.
- Actual-engine browser, keyboard and desktop/narrow light/dark checks establish the delivered subset.

Then add reviewed named-view creation from an exploration and define browsing-context persistence. Portable bundles and recovery do not currently store exploration scope/representation; any format change needs schema/version and compatibility fixtures.

## 2. Local folder workflow

Start with explicit import semantics: membership, exclusions, source limits, permission cancellation and unsupported-browser fallback. Existing Open imports copies and Download exports a bundle.

Direct file saving is a separate gate: identify written files, validate permission, detect external changes and retain local work on failed or ambiguous writes. Do not label imported copies as folder-backed editing. See [shell capability gates](architecture/application-shell.md#future-opening-workflows).

## 3. Flexo checkout, then reviewed publication

Follow the [integration research](research/openmbee-flexo-mms.md): prove unchanged interchange and foreign element identity preservation on a pinned deployment, then read an immutable commit selected through project/branch. Identify generated authoring text explicitly.

Publication follows only after one reviewed command preserves repository UUIDs and unedited semantics, with server-enforced stale-head rejection and defined retry/ambiguous-outcome handling. Authentication, conversion and publication failures must retain local work. No deployment/authentication target has been selected here.

## Follow-on usability and rendering

- Consistent selection and source/canvas reveal, including Explorer-only selection; model-wide search and discoverable language shortcuts.
- Broader structural notation, effective conjugated directions and new representation families, each backed by actual engine/renderer evidence.
- Accessibility and large-model performance work based on measured workflows.

Keep arbitrary source reconciliation conservative; general persistent identity, independent layout undo, camera persistence, reconnect/delete/duplicate and behavior editing remain gaps. Use the [authoring contract](architecture/graphical-authoring.md), [identity policy](architecture/identity-reconciliation.md) and [example targets](../examples/README.md) when extending them. Completed assembly milestones and earlier delivery sequences are retained in Git history, not repeated as pending work.
