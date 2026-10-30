# SysML v2 visualization example library

Small, independent projects define the source constructs and visual quality this editor should support. Each folder has its own model and named views. Open **all `.sysml` files from one folder together**, then select a named view. Choose **Diagram** for more canvas space. Projects are independent; combining folders can introduce unrelated names and views.

The “blocks” examples use SysML v2 `part def` and `part` declarations. Lexical comments (`//` and `/* */`) belong in source; documentation (`doc /* */`) and `comment about` also exercise semantic annotations. Preserving their text does not establish diagram callout support.

Status is per view: **rendered** covers the stated fixture scope; **partial** shows a useful subset with recorded gaps; **unavailable** means the engine evaluates the view but the app reports that its renderer is unavailable. No examples are silently skipped for missing renderers. Targets describe intended visual quality and need visual review; passing source/engine checks alone does not satisfy every target.

| Project                                                   | Topics                                                                                                                                                           | Named views and current app status                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Comments and documentation](comments/model.sysml)        | comments, documentation, annotations, unicode, long-labels                                                                                                       | `overview`: partial; `maintenance`: partial                                                                                                                                                                                                                                                                                                                                  |
| [Packages and imports](packages/model.sysml)              | packages, imports, ownership, multiple-files                                                                                                                     | `outline`: partial; `dependencies`: unavailable                                                                                                                                                                                                                                                                                                                              |
| [Parts and definitions (blocks)](parts/model.sysml)       | parts, blocks, definitions, usages, specialization, references, repeated-names                                                                                   | `structure`: rendered; `definitions`: partial                                                                                                                                                                                                                                                                                                                                |
| [Ports and conjugation](ports/model.sysml)                | ports, interfaces, connections, conjugation                                                                                                                      | `link`: partial                                                                                                                                                                                                                                                                                                                                                              |
| [Use cases and actors](use-cases/model.sysml)             | use-cases, actors, subjects, include, objectives                                                                                                                 | `scenarios`: unavailable; `definitions`: unavailable                                                                                                                                                                                                                                                                                                                         |
| [Requirements and satisfaction](requirements/model.sysml) | requirements, documentation, constraints, satisfaction                                                                                                           | `requirements`: unavailable                                                                                                                                                                                                                                                                                                                                                  |
| [Actions and successions](actions/model.sysml)            | actions, behavior, succession, parameters                                                                                                                        | `process`: unavailable                                                                                                                                                                                                                                                                                                                                                       |
| [States and transitions](states/model.sysml)              | states, nested-states, transitions, initial-state                                                                                                                | `states`: unavailable                                                                                                                                                                                                                                                                                                                                                        |
| [Messages and sequence ordering](sequences/model.sysml)   | sequences, messages, occurrences, ordering                                                                                                                       | `exchange`: unavailable                                                                                                                                                                                                                                                                                                                                                      |
| [Filtered and empty views](filters/model.sysml)           | filters, metadata, recursive-exposure, empty-view                                                                                                                | `reviewed`: rendered; `empty`: rendered                                                                                                                                                                                                                                                                                                                                      |
| [Workshop foundation](workshop/model.sysml)               | multiple-files, shared-types, rename, tree                                                                                                                       | `overview`: rendered; `compressor`: rendered                                                                                                                                                                                                                                                                                                                                 |
| [Nested assembly](assembly/model.sysml)                   | assembly, nested-parts, directed-ports, connections, references, usage-context                                                                                   | `structure`: rendered; `devices`: partial                                                                                                                                                                                                                                                                                                                                    |
| [Smart air workshop](air-compressor/system.sysml)         | multiple-files, specialization, directed-ports, conjugation, connections, attributes, constraints, requirements, actions, states, use-cases, sequences, geometry | `overview`: partial; `structure`: partial; `installation`: partial; `pneumatics`: partial; `definitions`: partial; `requirements`: partial; `actions`: unavailable; `maintenance`: unavailable; `useCases`: unavailable; `states`: unavailable; `startupSequence`: unavailable; `demandSequence`: unavailable; `faultSequence`: unavailable; `envelopeGeometry`: unavailable |

## Visual targets and known gaps

### Comments and documentation

Files: [model.sysml](comments/model.sysml), [views.sysml](comments/views.sysml).

**DocumentationViews::overview** — engine artifact: `tree`; app: **partial**.

- Keep line and block comments intact in source.
- Show documentation and semantic comment callouts anchored to the correct element.
- Preserve Unicode punctuation and text through download/reopen.
- Fit qualified names inside their symbols at a readable scale.

Current gaps: Documentation and semantic comment callouts are not drawn or transported as note bodies/anchors by the current bridge. Long qualified labels can extend past the fixed-width tree nodes.

**DocumentationViews::maintenance** — engine artifact: `interconnection`; app: **partial**.

- Keep the documented ServiceLoop and its pump visually distinct.
- Make maintenance notes readable without confusing them with model elements.

Current gaps: The structural diagram renders the parts; semantic documentation/comment callouts remain unavailable.

### Packages and imports

Files: [model.sysml](packages/model.sysml), [views.sysml](packages/views.sysml).

**OrganizationViews::outline** — engine artifact: `tree`; app: **partial**.

- Show nested package/type ownership without merging similarly named elements.
- Preserve resolution of Controller and Sensor across private imports.

Current gaps: The outline is a flat tree; package containers and import arrows require the package renderer.

**OrganizationViews::dependencies** — engine artifact: `package`; app: **unavailable**.

- Draw package containment separately from import dependencies.
- Keep Common, Control and Plant legible with directional import relationships.

Current gaps: The engine emits a package graph, but the application has no package-graph renderer.

### Parts and definitions (blocks)

Files: [model.sysml](parts/model.sysml), [views.sysml](parts/views.sysml).

**PartViews::structure** — engine artifact: `interconnection`; app: **rendered**.

- Nest each motor inside its own left/right owner.
- Keep two motor usages of the same definition distinct when selected.
- Distinguish the reference operator with text and border notation.

**PartViews::definitions** — engine artifact: `definition`; app: **partial**.

- Show Drive, ElectricDrive, Operator and Machine as distinct definitions.
- Distinguish specialization from reference relationships.

Current gaps: Definition graphs use generic lines; relationship-specific arrowheads and fallback kind labels are incomplete.

### Ports and conjugation

Files: [model.sysml](ports/model.sysml), [views.sysml](ports/views.sysml).

**InterfaceViews::link** — engine artifact: `interconnection`; app: **partial**.

- Attach commandLink to sender.command and receiver.command.
- Preserve the Command versus ~Command type distinction.
- Show effective payload directions when conjugation support is implemented.
- Route connections clear of port labels, including undirected boundary endpoints.

Current gaps: Conjugated port type labels are retained; effective directions and payload features are not expanded into full boundary notation. Current undirected boundary placement can route a connection through a port label.

### Use cases and actors

Files: [model.sysml](use-cases/model.sysml), [views.sysml](use-cases/views.sysml).

**OperationViews::scenarios** — engine artifact: `case`; app: **unavailable**.

- Show the Operate station subject, operator actor and inspection include.
- Use readable case and actor notation with the objective attached to its case.

Current gaps: The engine emits a case artifact; the application has no case renderer.

**OperationViews::definitions** — engine artifact: `case`; app: **unavailable**.

- Show the Inspect station definition with its subject and inspector actor.
- Retain quoted multi-word names without losing subject/actor relationships.

Current gaps: The engine emits a case artifact; the application has no case renderer.

### Requirements and satisfaction

Files: [model.sysml](requirements/model.sysml), [views.sysml](requirements/views.sysml).

**CapacityViews::requirements** — engine artifact: `requirement`; app: **unavailable**.

- Display requirement identifiers and readable requirement text.
- Distinguish requirement typing from the storage satisfaction relationship.
- Treat the declared constraint as model content, without claiming an execution result.

Current gaps: The engine emits a requirement graph; the application has no requirement renderer.

### Actions and successions

Files: [model.sysml](actions/model.sysml), [views.sysml](actions/views.sysml).

**WorkflowViews::process** — engine artifact: `action`; app: **unavailable**.

- Show the collect, inspect and archive order from start to done.
- Retain typed inspection parameters and distinguish them from control succession.
- Do not imply that rendering the workflow executes it.

Current gaps: The engine emits an action artifact; the application has no action-flow renderer.

### States and transitions

Files: [model.sysml](states/model.sysml), [views.sysml](states/views.sysml).

**LifecycleViews::states** — engine artifact: `state`; app: **unavailable**.

- Keep processing nested inside active.
- Distinguish initial-state markers from named states.
- Show startWork and finishWork transition endpoints clearly.

Current gaps: The engine emits a state artifact; the application has no state-transition renderer.

### Messages and sequence ordering

Files: [model.sysml](sequences/model.sysml), [views.sysml](sequences/views.sysml).

**InteractionViews::exchange** — engine artifact: `sequence`; app: **unavailable**.

- Show client and server as distinct lifelines.
- Draw request and reply against their declared events.
- Respect the succession from server.received to server.sent.

Current gaps: The engine emits a sequence artifact; the application has no sequence renderer.

### Filtered and empty views

Files: [model.sysml](filters/model.sysml), [views.sysml](filters/views.sysml).

**SelectionViews::reviewed** — engine artifact: `tree`; app: **rendered**.

- Include only the two Review-marked definitions, including nested BackupUnit.
- Keep the unmarked OrdinaryUnit out of this view.

**SelectionViews::empty** — engine artifact: `tree`; app: **rendered**.

- Show a valid empty view without substituting another view.
- Keep source and named-view navigation usable when no elements pass the filter.

### Workshop foundation

Files: [model.sysml](workshop/model.sysml), [views.sysml](workshop/views.sysml).

**WorkshopViews::overview** — engine artifact: `tree`; app: **rendered**.

- Show both Motor usages and their shared definition.
- Keep the active view stable when changing source files.

**WorkshopViews::compressor** — engine artifact: `interconnection`; app: **rendered**.

- Nest primary and standby inside Compressor.
- Preserve compatible per-view presentation through save/reopen.

### Nested assembly

Files: [model.sysml](assembly/model.sysml), [views.sysml](assembly/views.sysml).

**AssemblyViews::structure** — engine artifact: `interconnection`; app: **rendered**.

- Show Station, bay and repeated Device usages in their correct context.
- Attach handoff to primary.output and standby.input.
- Move groups and children without changing semantic ownership or source.

**AssemblyViews::devices** — engine artifact: `interconnection`; app: **partial**.

- Focus on bay while retaining its inherited ports and handoff connection.
- Report the exposed unsupported action without discarding its source.

Current gaps: The exposed Inspect action is reported as not shown; action rendering is unavailable.

Expected engine notices include: “action def Assembly::Inspect has no place in an interconnection rendering; it is not shown”.

### Smart air workshop

Files: [system.sysml](air-compressor/system.sysml), [components.sysml](air-compressor/components.sysml), [types.sysml](air-compressor/types.sysml), [behavior.sysml](air-compressor/behavior.sysml), [requirements.sysml](air-compressor/requirements.sysml), [use-cases.sysml](air-compressor/use-cases.sysml), [views.sysml](air-compressor/views.sysml), [sequence.sysml](air-compressor/sequence.sysml), [geometry.sysml](air-compressor/geometry.sysml).

**CompressorViews::overview** — engine artifact: `interconnection`; app: **partial**.

- Show the mains supply, compressor interface, tool and service console with their declared connections.

Current gaps: Conjugated port type labels are retained; effective payload directions and attribute compartments are not expanded.

**CompressorViews::structure** — engine artifact: `interconnection`; app: **partial**.

- Show electrical, pneumatic, cooling and service assemblies with authored cross-subsystem connections.

Current gaps: Conjugated port type labels are retained; effective payload directions and attribute compartments are not expanded. Nested typed assemblies remain component-level nodes; deeper connection endpoints are shown at those nodes rather than expanded internal ports.

**CompressorViews::installation** — engine artifact: `interconnection`; app: **partial**.

- Keep two installed compressor usages, tools and human roles distinct.

Current gaps: Conjugated port type labels are retained; effective payload directions and attribute compartments are not expanded. Nested typed assemblies remain component-level nodes; deeper connection endpoints are shown at those nodes rather than expanded internal ports.

**CompressorViews::pneumatics** — engine artifact: `interconnection`; app: **partial**.

- Show the pump, tank, regulator, relief valve and pressure sensor with all four port connections.

Current gaps: Conjugated port type labels are retained; effective payload directions and attribute compartments are not expanded.

**CompressorViews::definitions** — engine artifact: `definition`; app: **partial**.

- Distinguish reusable part types, specialization, typing and composition.

Current gaps: Definition graphs use generic relationship lines and fixed-width labels; dedicated specialization/typing notation is incomplete.

**CompressorViews::requirements** — engine artifact: `tree`; app: **partial**.

- Show the owning workshop specification and applied requirement subjects without implying completed verification.

Current gaps: This GeneralView produces a flat tree; dedicated requirement notation and satisfaction/verification trace links are not drawn.

**CompressorViews::actions** — engine artifact: `action`; app: **unavailable**.

- Show normal air supply steps, performer allocations and authored control/item-flow ordering.

Current gaps: The engine emits an action artifact; this application has no action renderer.

**CompressorViews::maintenance** — engine artifact: `action`; app: **unavailable**.

- Show isolation and depressurization before inspection, filter replacement and restoration.

Current gaps: The engine emits an action artifact; this application has no action renderer.

**CompressorViews::useCases** — engine artifact: `case`; app: **unavailable**.

- Distinguish operator and technician objectives and their explicitly bound include usages.

Current gaps: The engine emits a case artifact; this application has no case renderer.

**CompressorViews::states** — engine artifact: `state`; app: **unavailable**.

- Show operating states and event-triggered transitions without implying execution.

Current gaps: The engine emits a state artifact; this application has no state renderer.

**CompressorViews::startupSequence** — engine artifact: `sequence`; app: **unavailable**.

- Show five participants and the seven authored startup messages in order.

Current gaps: The engine emits a sequence artifact; this application has no sequence renderer.

**CompressorViews::demandSequence** — engine artifact: `sequence`; app: **unavailable**.

- Show tool demand, delivery, pressure feedback and recharging.

Current gaps: The engine emits a sequence artifact; this application has no sequence renderer.

**CompressorViews::faultSequence** — engine artifact: `sequence`; app: **unavailable**.

- Show overheating feedback, stopping, cooling, alarm and recovery messages.

Current gaps: The engine emits a sequence artifact; this application has no sequence renderer.

**CompressorViews::envelopeGeometry** — engine artifact: `geometry`; app: **unavailable**.

- Show the unit-bearing enclosure dimensions and authored coordinate-frame placement.

Current gaps: The engine emits a geometry artifact; this application has no geometry renderer.

Expected engine notices include: “Dimensions and coordinate-frame poses evaluated in metres. Boxes are centered on their frame origins. Solids are inspected separately; meshes and void subtraction are unsupported.”.

## Validate and extend the library

Use the repository Node version and existing dependencies. Browser checks build current source and use the real pinned workers:

```sh
npm run examples:index
npm run check
npm run test:examples
```

Add a small independent folder and a catalog entry with named views, exact expected node-name/edge-kind multisets, current app support, visual targets and honest gaps. Expected names and relationships are reviewable fixtures; update them only after inspecting the changed model and engine output. Add a screenshot baseline when a new renderer or visual behavior becomes supported. Reuse a focused example in a regression instead of growing every project into a full system.

`catalog.json` owns the index and test expectations; `catalog.ts` validates metadata and loads source. This README is generated by `npm run examples:index`; its synchronization and source-file coverage are checked by `npm run check`. `npm run test:examples` checks every project through import, each named view, actual worker artifacts, expected app availability and exact source download/reopen. Reports/captures go under ignored `sandbox/playwright/`.

Focused examples are authored for this repository under its root Apache-2.0 license. The Smart air workshop model is imported from sysml_ide with source provenance recorded in its project README and root NOTICE. Their accepted syntax is checked against the pinned implementation; this library is not a language-conformance suite. See [capabilities](../docs/capabilities.md) and [verification](../docs/verification.md) for application scope and checks actually performed.
