# Model exploration and named views

Agreed direction, 2026-11-01; first bounded implementation, 2026-11-05. Project/package overview trees and explicit part-definition/usage tree or structural projections are implemented on `feature/automatic-exploration`. The broader opening policy and follow-ups below remain planned.

## Current bounded slice

Imports without named views open a project overview; imports with named views retain their existing opening behavior. **Explore model** in the named-view selector opens temporary browsing. Separate **Exploration scope** and **Exploration representation** controls select project roots, a package or an explicit part declaration. Project/package scopes support overview trees; explicit part definitions/usages also support structural projection. Typed usages are not automatically unfolded and show that limit explicitly. No automatic system-root inference is claimed.

Ownership overviews now draw nested packages and declarations from the native artifact's parent identities. Relationship endpoints do not determine ownership: for example, `Q` owns `Motor`, while `P::System` owns its `primary` and `standby` usages. Parallel declarations retain independent correspondence and keyboard/source inspection. Generated ownership layouts reserve right-side routing gutters within the nearest shared owner, with separate rectilinear tracks and label rows clear of declaration bodies and headers. Cross-root routes use the gaps between roots or space below intervening roots. Camera fitting includes route and label bounds. This routing depends on the generated vertical ownership layout; it is not a general router for arbitrary manually positioned diagrams.

Exploration uses compact 52 px leaf cards without empty bodies, reduced containment padding and side-by-side leaf siblings in structural scopes. Named-view dimensions and stored geometry are unchanged. Visible Scope/Representation labels and a wrapping full qualified scope caption distinguish Part definition from Part usage, including long names at narrow widths. Selecting a diagram declaration highlights its source range without moving keyboard focus into the editor; explicit Open source still focuses the editor.

`workspace/exploration` owns closed request/result schemas bound to the applied model hash. The semantic worker reparses the complete applied source set and calls the validated combined `Explore` bridge, which uses native `RenderExposed` without adding source. Named views and exploration share artifact/source normalization, but the exploration envelope has no authored `view` field. Source origins, topology, representation and request identity are checked before publication.

`WorkspaceState.exploration` is independent of `view` and portable presentations. Success switches the active diagram without changing project data, dirty state, revision or semantic history. Failure, cancellation and superseded requests retain current work; draft changes invalidate pending work. Graphical movement and semantic authoring are disabled in exploration. Selection can reveal a source declaration, and source-file navigation does not change scope. Opening a named view exits exploration and restores its own saved geometry. Accepted source revisions clear the revision-bound exploration and use the opening fallback on refresh.

Scope, camera and exploration layout are transient and are not saved in portable bundles or local recovery. Reopening falls back to the existing named-view preference or the project overview. Reviewed named-view creation from exploration, browsing-context persistence, automatic root detection and additional representation families remain follow-ups.

Opening is exploration; creating a named view is authorship. Users should be able to inspect an imported project without first changing its source. The [domain glossary](../../CONTEXT.md) distinguishes source files, the project model, scopes, representations, explorations, named views, diagram presentations and cameras.

## Opening experience

- For a new import with one unambiguous top-level system subject, open its supported structural representation.
- For multiple systems, packages or ambiguous roots, open a project overview and let the user choose a scope. Do not equate all packages with one instantiated system.
- When reopening saved work, restore its valid previous browsing context when that context is supported by the saved format; otherwise use the appropriate opening fallback.

Expose scope and representation as separate choices. Switching the active source file must not silently replace the diagram scope. Existing named views remain directly accessible. Browsing can lead to an explicit, reviewed action to create a named view where the exploration's scope and representation can be expressed faithfully in SysML.

The system-root criterion needs evidence from the resolved model and example fixtures. Do not guess a system from its filename, display name or first package. Where the criterion is uncertain, prefer the project overview. The initial overview may show project/package contents; it must not imply that unrelated packages form one connected system.

## Ownership and preservation

Files organize source; the applied model resolves their meaning together. Unapplied or invalid drafts remain distinct from the last valid model shown by diagrams. Browsing should identify the revision it represents.

Temporary scope and representation are workbench navigation state. Named-view declarations, exposures and filters remain source-owned semantics. Diagram geometry and camera are separate concerns. Exploring must not add hidden declarations to project sources, mark a project modified, add semantic history or overwrite saved named-view geometry.

Use shared evaluation, rendering, correspondence and selection contracts for exploration and named views. Trace the actual engine contracts before choosing a read-only exploration interface. If evaluation requires temporary engine input, isolate it from applied source, drafts and serialization, and verify its identity correspondence rather than assuming synthetic IDs are equivalent. Scope changes and stale or failed evaluations must retain current work.

## First implementation slice

Implement read-only automatic exploration for an imported model with no view declarations, using only representations supported by the pinned engines and current renderers. Prove a project/package overview and a bounded structural subject before extending representation families or enabling graphical semantic edits within exploration.

Acceptance:

- A model without view usages opens a useful overview or an unambiguous system structure immediately.
- A multi-file fixture resolves as one project model; a multi-system fixture offers an overview rather than choosing an arbitrary system.
- Scope and representation controls distinguish definitions from repeated usages. Unsupported representations explain their limits.
- Existing named views still open normally and retain independent saved positions. Source-file navigation remains independent of diagram scope.
- Browsing and failed or superseded requests retain exact applied source, drafts, semantic history and saved presentations; valid scope changes do not inherit another subject's geometry.
- Real-engine browser checks establish the projection contract and preservation outcomes. Inspect desktop/narrow, light/dark captures and keyboard focus behavior.

The first slice keeps exploration navigation transient. Persisting an exploration across reloads or portable reopen is a later explicit storage decision: the current recovery envelope records only an active file and named-view identity, and the portable bundle has no exploration field. Any persistence change must follow the owning schema, versioning and compatibility-fixture requirements.

Follow-up slices are explicit creation of a named view from exploration, storage/restoration of browsing context, and additional representation families supported by actual engine and renderer evidence. State and action representations require independent engine and renderer verification.

## Engine evidence

The [pinned-engine investigation](../research/automatic-exploration-contract.md) executed the current WASM boundary and native renderer. The investigation originally identified a declaration-free project/package seam; the bounded implementation now exposes it through a separate browser contract. A typed system usage did not automatically unfold its definition’s internals. The first delivered exploration must therefore use an overview until structural subject/usage expansion is proven, rather than promise an inferred full-system diagram.
