# Next steps

Updated 2026-10-30 from the development sequence recorded on 2026-10-26. Planned work below is not implemented unless explicitly marked. [Capabilities](capabilities.md) records current behavior; [verification](verification.md) records checks actually performed. No delivery dates or individual owners are assigned here.

## Current position

The foundation and identity investigation are committed in `a2d0d91` and `fd54b67`; the assembly editing milestone is committed in `ead6337` on `feat/clean-foundation`. It implements reviewed rename layout preservation, bounded source-edit preservation, and typed part/port-connection authoring. The current usability pass adds resizable panels, contextual Lucide controls and measured toolbar alignment. [Smart air workshop](../examples/air-compressor/README.md) replaces the small Workshop as startup: nine source files and fourteen named views, opening its pneumatic assembly in Diagram mode. The smaller examples remain focused workflow fixtures. [Verification](verification.md) records exact local results, inspected captures and deliberate regression faults; hosted CI has not been run for this pass.

The [identity investigation](architecture/identity-reconciliation.md) compares fresh parses, definition/usage renames, an unrelated-file edit, offset shifts, reordered/inserted usages, file/owner moves and changed types. It records a counterexample where unchanged symbol/origin/context IDs identify the wrong usage. Its original complete splice-based join covered a definition rename. The new production browser scenarios verify both definition and usage renames, including distinct saved views and fresh import; broader comparison cases remain explicit invalidation targets.

The assembly milestone is locally complete within the documented bounded policy. The retained steps and acceptance criteria below record its implemented slices and verification gates. Source edits use a bounded unchanged-header policy, rather than general persistent identity. Remaining work after these slices concerns everyday editing in step 4 and the explicit notation, accessibility and performance gaps; broad source-reconciliation support is not implied.

The semantic command contract now supports `rename`, `createView`, `createPart` and `connectPorts`. Diagram/Inspector forms review exact source and layout changes before acceptance. Connections require explicit direction, identical resolved port types and verified usage endpoints. See [authoring contracts](architecture/graphical-authoring.md); the example library still records renderer/notation gaps.

## Assembly milestone: edit a small assembly in either presentation

An engineer should be able to open a small assembly, understand its ownership and connections, create a typed part and connect compatible ports through the diagram, inspect/apply the resulting source changes, and continue in source without losing unrelated content or compatible layout.

Use one small, non-sensitive assembly fixture throughout the milestone. It should include shared part definitions, multiple usages, nested ownership, directed ports, a valid connection, two named views, comments and at least one source construct outside the graphical editor's supported subset. Grow the fixture only as each workflow becomes supported; retain a clear distinction between valid source and renderable content.

The priorities are bidirectional editing, simpler views and everyday usability. Extend the working foundation through complete user workflows rather than importing the previous application wholesale.

## 1. Make structural diagrams useful

Implemented bounded slice: existing assemblies render with the fixture coverage recorded below. GeneralView remains a flat tree. Broader notation gaps are tracked separately from the assembly workflow.

Work:

- Preserve ownership and usage context when projecting nested structures.
- Show supported ports, their direction and unambiguous connection endpoints.
- Distinguish part definitions, usages, reference features and ownership through notation and labels as well as color.
- Keep symbol selection tied to recorded semantic correspondence across the diagram, Explorer and Inspector.
- Report unsupported artifacts or notation explicitly, retaining their source.

Acceptance:

- The fixture's assembly, repeated usages, supported ports and connections render with the correct context.
- Selecting a symbol identifies the intended subject/usage, including when a definition is used more than once.
- Dragging a symbol changes geometry without changing ownership, connectivity or source.
- Switching between the two named views preserves their separate presentation state.
- The workflow is checked with the actual pinned browser engines, plus keyboard and light/dark visual checks.

The first bounded implementation task was to trace one nested assembly artifact through the engine adapter and renderer, document missing fields, and add only the contract/projection support required to render that fixture faithfully. Do not infer containment from a node's position.

Progress recorded 2026-10-26: the [first structural slice](architecture/structural-views.md) implements that bounded task using `examples/assembly/`. It covers nested groups, repeated Device usages, explicitly directed inherited ports and their connection, reference notation, contextual port/source selection, group/child movement, two views, unsupported-action notices and compatible save/reopen. The engine trace and retained tests define its scope; broader owned-port notation and effective directions through conjugation remain gaps. The subsequent identity investigation and production reconciliation/authoring code are now present; the acceptance criteria below govern their completion.

## 2. Preserve identity and layout through source changes

The implementation reconciles compatible presentations per view before publishing source changes. Unsafe matches are invalidated explicitly. The [implemented policy](architecture/identity-reconciliation.md) defines source-bound edit evidence and bounded free-form changes; the criteria below retain the intended scope.

Work:

- Distinguish semantic identity, usage context and per-view symbol identity in the mapping contract.
- Retain positions for elements whose correspondence is verified across revisions.
- Support safe rename and unrelated-file edits without unnecessarily rearranging unaffected symbols.
- Define behavior for new/deleted elements, file moves, duplicate names, changed owners and ambiguous correspondence.
- Keep revision checks, stale-proposal rejection and invalid-draft preservation intact.

Acceptance:

- A verified rename or unrelated edit retains compatible symbol positions in both views.
- Duplicate labels and repeated usages never borrow another symbol's identity or layout.
- A new symbol gets a deliberate placement; deleted or unmatched mappings are not silently reassigned.
- When identity cannot be established safely, affected layout is invalidated explicitly while source remains intact.
- Undo/redo behavior and save/reopen results are defined and tested. Any project-format change includes versioning and compatibility fixtures.

The original worker/SDK investigation remains distinct from application tests. Production retention uses verified evidence and full usage contexts; it does not add a competing semantic model or a label-based identity scheme.

### 2.1 Preserve layout through reviewed part renames

User-visible outcome: move parts in both assembly views, review and apply a part definition or usage rename, and keep each intended usage at its compatible position. The resulting source and references must remain correct through undo/redo and a fresh save/reopen.

Implemented sequence:

1. Extend the transformation result and owning TypeBox transport schemas to carry rename edit evidence alongside the complete returned sources. Bind the evidence to the exact before/after source sets. Validate filename-based splice units, UTF-8 byte ranges, nonoverlap and exact replay. Malformed evidence must refuse the proposal and preserve the applied state.
2. Reconcile old/new evaluated artifacts for every view with saved positions, including views that are not currently open. Match the transported declaration origin and complete usage context uniquely in both directions, check ownership and resolved bindings, and resolve each view's new symbol IDs. Toolkit UUIDs, unchanged renderer IDs and equal labels are not substitutes for that mapping.
3. Prepare the source and presentation changes together in an immutable proposal. Reject or reprepare it if its bound source revision or captured presentation state changes during review, so acceptance cannot overwrite newer symbol movement. Keep `accept()` as one atomic publication and source-history entry.
4. Retain only compatible absolute positions of matched artifact nodes, including nested groups and descendants. Check port correspondence and connection references for identity correctness; saved positions remain node geometry. Invalid or partial semantic candidates must never publish. For valid source with an unsupported or ambiguous view mapping, report which affected layout will be invalidated during review and preserve other verified views.

Keep workspace reconciliation independent of React, the DOM, canvas libraries and engine implementations. Engine adapters own evidence normalization; workspace modules own proposal validation and acceptance. Prefer the existing version-1 bundle shape when transient proposal evidence is sufficient. Any necessary saved-format change must be justified, versioned and covered by compatibility fixtures.

Acceptance and evidence:

- Use `examples/assembly/` and the actual pinned browser engines. Save distinct moved positions in `structure` and `devices`, then exercise definition and usage renames separately. Check every saved view, including one left unopened during the transaction.
- Verify exact intended source changes, resolved usage types, updated connection references and retained comments/unsupported source. Selecting repeated usages and inherited ports must identify the correct declaration and usage context after each rename.
- Assert compatible absolute positions after acceptance, view switching, undo, redo and a fresh page reload/import. Parent/descendant movement must not change ownership or borrow another usage's position.
- Cover Unicode before edited spans, malformed or mismatched edit evidence, stale proposals, geometry changes during review, missing/ambiguous correspondence and unsupported view evaluation. Required transformation or semantic-validation failures retain applied source, model, layout and history; invalid drafts retain their text and last valid diagram.
- Keep controlled workspace cases separate from real-engine browser evidence. Demonstrate that an important new retention/identity assertion fails with the targeted behavior deliberately broken, then restore it and rerun.
- Run `npm run check`, `npm run build` and the relevant browser scenarios. For workflow or appearance changes, follow the keyboard, focus and visual requirements in [browser testing](testing.md). Update capabilities and verification with actual outcomes and remaining gaps.

### 2.2 Preserve layout through bounded source edits

The source-apply implementation derives conservative replacement ranges and retains only uniquely matched declarations whose recorded headers, complete usage contexts and resolved owner/type bindings remain compatible. The existing unexposed-marker experiment is a starting fixture; it does not prove that edits in another file leave imports, type resolution, exposure, filters or other dependencies unchanged.

Establish declaration and dependency continuity before retaining positions, then verify both views, repeated usages, undo/redo and fresh save/reopen. Retain explicit counterexamples for reordered declarations, reused names/spans, changed owners, file moves, retyping, additions and deletions. Define deliberate placement for new nodes and explicit invalidation for unmatched or unsafe mappings. Keep arbitrary replacements conservative until the evidence supports a broader policy. Step 2 is complete only when its broader acceptance criteria above are met.

## 3. Complete one graphical authoring workflow

Implemented bounded slice: create a typed part and connect compatible ports using the rendering and identity contracts above. Semantic commands remain in the framework-independent workspace; canvas and Inspector actions share them.

Work:

- Create a part usage in an explicit owner using an existing compatible definition.
- Create a supported connection between explicit port endpoints, with engine-backed validation.
- Preview the source transformation, validate the complete candidate, and accept one atomic transaction per command.
- Update source, diagram and Inspector together after acceptance.
- Preserve comments, unsupported constructs and unrelated source formatting.

Acceptance:

- An engineer can create the usage, connect supported ports, review/apply each change, and then continue editing source.
- The resulting source reparses and resolves through the pinned engines; applicable command postconditions hold.
- Invalid endpoints, invalid candidates and stale proposals leave the applied source/model unchanged and produce actionable feedback.
- Undo/redo and save/reopen reproduce the accepted source and compatible layout.
- Rejected edits and temporary invalid source retain the last valid diagram and the user's draft.
- Browser evidence covers the actual end-to-end workflow, not only controlled unit-test responses.

The pinned Toolkit audit confirmed `insertMember` for typed parts and connections, including promotion of a typed semicolon owner. Toolkit accepts some directionally invalid links; the workspace therefore checks direction, canonical type and exact evaluated endpoints independently. Unsupported endpoint paths remain unavailable. [Authoring scope](architecture/graphical-authoring.md).

## 4. Improve everyday editing

The usability pass adds [resizable panels and Lucide action icons](architecture/workbench-layout.md), with browser-only arrangement preferences and preservation checks.

Next bounded task: make source diagnostics navigable. The current Issues panel displays severity, filename, optional line and message, but has no source-navigation action. Trace the pinned diagnostic contract before adding range fields; do not invent a precise range when only a line or message is available. Reuse the existing source-reveal path and retain the open diagram, drafts and per-view geometry.

Acceptance for that task:

- From an issue with a known file/line, open the correct source file and focus the available location by keyboard or pointer; explain a missing/stale location without selecting unrelated text.
- Correct the draft and apply it successfully; keep the prior applied diagram and all draft text when validation fails.
- Preserve compatible positions in both views, and keep selection, dirty/download feedback and undo/redo consistent.
- Verify real-engine diagnostics plus controlled missing/stale-location cases, keyboard focus and changed light/dark/narrow layouts. Record local evidence separately from hosted CI.

After that task, prioritize usability issues observed while completing the assembly workflow:

- Consistent selection across Explorer, diagram and Inspector, with explicit source/canvas reveal actions.
- Find/search and discoverable keyboard shortcuts.
- Clear applied/draft/modified/download feedback.
- Source-language assistance after choosing an editor integration against these needs.
- Recovery of unfinished work, with an explicit storage/versioning policy and failure handling.

Acceptance should describe a concrete task: navigate an issue, find a part, reveal its source, correct it and preserve the work. New editor or recovery dependencies require review; browser preferences, recovery data and portable project files have different responsibilities.

## Keep views simple throughout

Keep one list of named SysML views and a contextual **New view of selection** action. Existing views open directly. New views ask for a subject, representation and name; ownership, exposure and filters use advanced settings or source until richer controls earn their place.

Source owns view declarations and semantic scope. Presentation owns symbol geometry; camera and editor arrangement are separate workspace concerns. Switching source files does not implicitly replace the open view. Avoid adding parallel view catalogues or requiring new declarations just to inspect an existing one.

## Scope and completion

Broader behavior/sequence/geometry editing, simulation, collaboration services, deployment changes and wholesale legacy feature parity are outside this milestone. Record newly discovered gaps in [capabilities](capabilities.md); evaluate them against the target workflow before expanding scope.

The milestone is complete when the assembly workflow above works through source and diagram, preservation/failure cases have retained fixtures, appropriate local checks pass, and documentation matches the supported behavior. Hosted CI, publication and upstream acceptance are separate evidence and decisions.

Use the [contribution guide](../CONTRIBUTING.md), [workspace architecture](architecture/README.md), [project format](architecture/project-format.md) and [design system](design-system.md) when turning each bounded task into a change. Update this sequence when implementation evidence changes a dependency or priority.
