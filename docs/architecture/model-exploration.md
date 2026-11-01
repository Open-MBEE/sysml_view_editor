# Model exploration and named views

Agreed direction, 2026-11-01. This document describes planned behavior, not an implemented capability. Current diagrams still require named SysML view usages.

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
