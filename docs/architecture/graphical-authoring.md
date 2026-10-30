# Reviewed structural authoring

Implemented on 2026-10-28/29. These commands extend the existing prepare/review/accept transaction; they do not add a second semantic model or change the version-1 project bundle. [Capabilities](../capabilities.md) and [verification](../verification.md) record the supported scope and actual checks.

## User workflow

Open `examples/assembly/`, then use **New part** in the diagram toolbar or **New part in selection** in the Inspector. Choose a source owner, simple name and existing part definition. Review the complete source change and its layout-retention summary before applying it. The new declaration is selected in the Inspector; view exposure remains authored source and determines whether the usage is rendered.

Use **Connect ports** in a structural diagram or select a port and choose **Connect selected port**. The form preserves the usage-qualified endpoint identity, filters destination choices by explicit direction and identical resolved port type, and offers a common source owner. Wrapped endpoint summaries keep the complete selections readable at narrow widths. Review and apply through the same transaction path.

## Engine and workspace responsibilities

The owning [command schemas](../../src/lib/workspace/editing/index.ts) add `createPart` and `connectPorts`. [Toolkit normalization](../../src/lib/engines/toolkit/transform.worker.ts) uses the pinned `insertMember` operation with explicit owner and declaration text. It rejects refused previews, findings and edits without splices. Leading `::` reference spelling is not used; the pinned SDK accepts the qualified references used by these commands.

Before editing, the adapter resolves the owner to its canonical qualified name and records `memberExtent()` with its source filename. Numeric unit handles from `session.units()` are converted to filenames; splice `unit` values already name filenames. The [evidence contract](../../src/lib/workspace/editing/evidence.ts) validates before/after digests, source membership, UTF-8 boundaries, nonoverlapping edits and exact source replay. Creation must stay within the recorded owner. A bodyless typed owner can be promoted by replacing only its terminal `;` with a body; unrelated existing source cannot be rewritten.

[Workspace orchestration](../../src/lib/workspace/createWorkspace.ts) parses the complete candidate with OpenSysML and runs declaration/ownership/type postconditions. For connection creation, [structural validation](../../src/lib/workspace/editing/structure.ts) separately checks the actual view's port correspondence, usage identity, resolved type and explicit direction. It evaluates the candidate view again and verifies that the new connection declaration resolves to the intended source/target usages and ports. Toolkit accepting an edit alone is insufficient: the pinned SDK's isolated probe accepted an output-to-output connection without findings.

All saved views are reconciled before issuing the immutable proposal. Only a proposal issued against the current source and presentation state can be accepted; symbol movement invalidates outstanding proposals. Acceptance publishes source, model and prepared presentations as one history entry. Cancellation aborts pending worker work, invalidates its generation and suppresses late dialog transitions; a fresh review can start immediately. Cancellation, stale work, malformed evidence, invalid source or failed postconditions preserve applied source/model/layout/history. Rejected review forms keep their entered values. A valid semantic transaction can invalidate an unsupported or ambiguous layout, with the loss reported before acceptance.

## Supported subset and preservation

- Part names and qualified references use the command schema's simple identifier subset. Types are existing part definitions; owners are explicit packages, part definitions or part usages. Inserting into a semicolon usage promotes that owner to a body.
- Connection endpoints must be unambiguous rendered part usages with explicitly directed inherited/owned ports. Output or inout connects to input or inout; the two resolved port types must be identical. A port cannot connect to itself.
- Conjugated, undirected or ambiguous inherited endpoint paths are unavailable for graphical connection creation. General subtyping compatibility, reconnect, delete, duplicate and behavior editing remain outside this slice.
- Creation verifies unchanged existing declaration count/ownership/type bindings plus the one new declaration. Source comments and unsupported constructs remain in the source; creation edits preserve surrounding bytes.
- Compatible saved node positions are mapped by recorded declaration origins and full usage contexts, independently in each view. A shared port declaration does not identify one usage. New symbols receive ELK layout until moved; moving them saves their own positions.
- Undo/redo and project download include accepted source and compatible presentations. The model, engine sessions and edit evidence remain transient. Existing renderer bounds checks still reject incompatible positions; manual overlap avoidance and interactive parent resizing remain gaps.

## Evidence

The retained [authoring browser scenarios](../../tests/e2e/authoring.spec.ts) use actual pinned workers to create a typed part, connect its inherited ports to the intended usage, move the new usage independently in two views, undo/redo both commands and reopen exact source/positions in a fresh page. A separate scenario promotes a typed semicolon owner. Failure coverage checks duplicate names, injected Toolkit asset failure, recovery, cancellation, retained source/layout and dialog focus containment/return.

The [preservation scenarios](../../tests/e2e/preservation.spec.ts) cover both rename kinds, Unicode insertion, an unrelated-file edit, source-name reordering, both view identities, serialized positions and actual rendered coordinates. [Controlled workspace tests](../../src/lib/workspace/createWorkspace.test.ts) and [structural validation tests](../../src/lib/workspace/editing/structure.test.ts) establish rejection rules separately from engine conformance. Light/dark and narrow authoring baselines are retained beside the visual spec.

The isolated SDK audit is retained locally in ignored `sandbox/graphical-authoring-audit.mjs`, `.json` and `.log`; `sandbox/owned-insertion-audit.mjs` and `.json` capture the semicolon-owner promotion report. These probes supply bounded contract evidence, not application conformance or hosted CI results. Exact test commands and the deliberately broken-retention experiment are recorded in [verification](../verification.md).
