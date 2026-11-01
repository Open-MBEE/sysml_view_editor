# Documentation

OpenMBEE View Editor is a sandbox browser workspace for SysML v2 source and named views. This index separates current behavior, implementation contracts and planned work. Setup and everyday use live in the [project README](../README.md).

## Start here

| Guide                                      | Purpose                                                          |
| ------------------------------------------ | ---------------------------------------------------------------- |
| [Capabilities and limits](capabilities.md) | What the application supports today                              |
| [Next steps](next-steps.md)                | Current priorities and the gates for future work                 |
| [Architecture](architecture/README.md)     | Module ownership, engine boundaries and transaction rules        |
| [Design system](design-system.md)          | Shared shadcn controls, themes and UI conventions                |
| [Testing](testing.md)                      | Running checks, reviewing baselines and diagnosing failures      |
| [Verification](verification.md)            | Latest recorded results, regression evidence and coverage limits |
| [Git workflow](git-workflow.md)            | Branches, PR targets and release integration                     |

## Implementation contracts

| Guide                                                                       | Purpose                                                        |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Application shell](architecture/application-shell.md)                      | Landing, launcher, navigation and session preservation         |
| [Workbench layout](architecture/workbench-layout.md)                        | Panels, toolbar alignment, model tree and editor lifetime      |
| [Source editing and recovery](architecture/source-assistance-recovery.md)   | Draft queries, issue navigation and browser recovery           |
| [Structural views](architecture/structural-views.md)                        | Hierarchy, ports, connections and geometry projection          |
| [Graphical authoring](architecture/graphical-authoring.md)                  | Reviewed semantic commands and supported endpoint rules        |
| [Identity and layout preservation](architecture/identity-reconciliation.md) | Identity domains, verified edits and conservative invalidation |
| [Project format](architecture/project-format.md)                            | Portable version-1 data and compatibility rules                |

## Planned work and research

- [Model exploration](architecture/model-exploration.md): agreed behavior for browsing models without authored views; not implemented.
- [Exploration engine investigation](research/automatic-exploration-contract.md): pinned renderer/WASM evidence and the next contract boundary.
- [Flexo MMS integration](research/openmbee-flexo-mms.md): dated source research and unresolved interchange/concurrency gates; not implemented.

Related sources: [domain glossary](../CONTEXT.md), [engine preparation and provenance](../engine-bridge/README.md), [example library](../examples/README.md), [contribution guide](../CONTRIBUTING.md).

Keep current behavior in capabilities and owning contracts; put future acceptance criteria in the roadmap or exploration plan. Verification records observations, not promises. Superseded milestone narratives remain available in Git history rather than parallel archive documents. Local `sandbox/` evidence paths are ignored artifacts and may be absent from another checkout.
