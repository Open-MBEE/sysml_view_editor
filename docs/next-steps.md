# Next steps

Recorded 2026-10-26. This is the proposed development sequence agreed in the planning discussion, not a claim that the work below is implemented. [Capabilities](capabilities.md) records current behavior; [verification](verification.md) records checks actually performed. No delivery dates or individual owners are assigned here.

## Next milestone: edit a small assembly in either presentation

An engineer should be able to open a small assembly, understand its ownership and connections, create a typed part and connect compatible ports through the diagram, inspect/apply the resulting source changes, and continue in source without losing unrelated content or compatible layout.

Use one small, non-sensitive assembly fixture throughout the milestone. It should include shared part definitions, multiple usages, nested ownership, directed ports, a valid connection, two named views, comments and at least one source construct outside the graphical editor's supported subset. Grow the fixture only as each workflow becomes supported; retain a clear distinction between valid source and renderable content.

The priorities are bidirectional editing, simpler views and everyday usability. Extend the working foundation through complete user workflows rather than importing the previous application wholesale.

## 1. Make structural diagrams useful

Build on the bounded structural slice to render existing assemblies before adding graphical creation. GeneralView remains a flat tree; interconnection rendering now has the fixture coverage recorded below.

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

First bounded implementation task: trace one nested assembly artifact through the engine adapter and renderer, document missing fields, and add only the contract/projection support required to render that fixture faithfully. Do not infer containment from a node's position.

Progress recorded 2026-10-26: the [first structural slice](architecture/structural-views.md) implements that bounded task using `examples/assembly/`. It covers nested groups, repeated Device usages, explicitly directed inherited ports and their connection, reference notation, contextual port/source selection, group/child movement, two views, unsupported-action notices and compatible save/reopen. The engine trace and retained tests define its scope; broader owned-port notation and effective directions through conjugation remain gaps. Next, investigate verified identity/correspondence across source changes before adding graphical creation and connection commands.

## 2. Preserve identity and layout through source changes

Today, applied source changes conservatively invalidate presentation mappings. Establish a tested reconciliation policy before relying on layout retention during richer editing.

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

Investigate engine-provided correspondence and edit mappings first. Do not add a competing semantic model or a label-based identity scheme to bypass a missing engine capability.

## 3. Complete one graphical authoring workflow

Build on the rendering and identity work to create a typed part and connect compatible ports. Keep semantic commands in the framework-independent workspace; canvas and Inspector actions share them.

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

Audit transformation support before exposing controls. If a pinned engine cannot perform a safe command, document the gap and keep the action unavailable until an adapter or engine change supplies it.

## 4. Improve everyday editing

Prioritize usability issues observed while completing the assembly workflow:

- Source diagnostics that open the correct file and range.
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
