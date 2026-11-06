# Automatic exploration: pinned engine contract investigation

Recorded 2026-11-01. This is a bounded investigation for the [exploration plan](../architecture/model-exploration.md), not an implemented application capability. No engine pins, production dependencies, worker protocols or project formats changed during this investigation.

Implementation update, 2026-11-05: the separate validated `Explore` bridge and workspace contract now implement the bounded seam described here. See [current scope](../architecture/model-exploration.md#current-bounded-slice). The investigation and probe results below describe the earlier boundary.

## Finding

The pinned OpenSysML renderer already has a source-preserving `RenderExposed` entry point for rendering selected model elements without a view declaration. It is the preferred initial seam for a validated read-only exploration adapter because it uses the same parser, origins and rendering machinery as named views. It is not currently exposed through the application's combined WASM/worker contract.

The actual Toolkit WASM also produces a whole-project graph without view declarations. That establishes an alternative projection capability, but its UUID graph identities and source locations do not satisfy the existing OpenSysML correspondence contract automatically. Switching renderers would require a separately verified identity join.

## Application boundary at investigation time

- `SemanticEngine` in `src/lib/workspace/editing/index.ts` exposes `parse` and `evaluate(documents, modelHash, view, signal)`.
- `src/lib/engines/workers/schema.ts` allows only parse/evaluate semantic operations. The adapter in `src/lib/engines/opensysml/index.ts` validates an evaluation against the requested model hash and named-view identity.
- `semantic.worker.ts` reparses the complete requested source set, checks the model hash and calls combined WASM `EvaluateView`.
- `engine-bridge/opensysml/validated_view.go` checks semantic diagnostics before forwarding evaluation. `evaluate_view.go` then requires one unambiguous `SymbolViewUsage`; it builds selected subjects, renderer artifacts, source origins, complete parent contexts, port correspondence and explicit structural modifiers.
- `workspace.openView` independently rejects subjects that are not declared view usages. `moveSymbols` stores geometry in `project.presentations[view.view]`, so temporary exploration cannot safely be passed through this path unchanged.

These are several separate boundaries. Adding a dropdown or passing a package name to the existing evaluate method does not implement automatic exploration.

## Executed evidence

The inputs contain two files and no view declarations: package P has a Motor definition, a System definition containing primary/standby usages, and a typed system usage; package Q has another definition/usage. Native renderer inputs also include an astral Unicode character before the declarations. Probes and raw outputs are retained locally in ignored `sandbox/exploration-contract/`.

### Existing browser WASM hosted by Node

`node sandbox/exploration-contract/wasm-probe.mjs` instantiated the current `static/vendor/opensysml/sysml-wasm.wasm` with its retained Go runtime and invoked the same `sysmlWasm.call` host entry point used by the worker. It did not run the browser worker or UI.

| Request                                     | Observed result                                                 |
| ------------------------------------------- | --------------------------------------------------------------- |
| ParseSources over the model without views   | Parsed successfully                                             |
| RenderView with `#tree:P`                   | Error code 12: RenderView is not served by combined sysml-wasm  |
| EvaluateView with `#tree:P`                 | Invalid/unavailable; expected one unambiguous native view usage |
| EvaluateView with `P::System`               | Same named-view requirement                                     |
| ParseSources again over unchanged documents | Identical model hash                                            |

The prepared provenance identifies OpenSysML commit `08ef397841767b829e492bbecf6d723483b4421e`, Go 1.25.11 and the locally derived bridge binary. The full WASM replies are in `wasm-probe.json`.

### Native pinned renderer

A temporary Go overlay added only `TestExplorationContractProbe` to the cached pinned source's `internal/ir/view` test package. No source or overlay tracked by the application was modified. The test used the existing native test loaders and called `Renderer.RenderExposed` directly.

| Scope and representation                 | Observed result                    |
| ---------------------------------------- | ---------------------------------- |
| Both package roots, tree                 | 9 nodes, 2 edges                   |
| Package P, tree                          | 6 nodes, 2 edges                   |
| Definition `P::System`, interconnection  | 3 nodes: root, primary and standby |
| Typed usage `P::system`, interconnection | 1 node: the usage itself           |

All four cases passed. Rendered view names were empty, confirming these renderings do not name authored views. Nodes carried original document/span origins, including the distinct primary and standby declaration spans. The typed-usage result does not establish inherited-member expansion: it did not display the definition's two internals. Do not promise a complete internal-system picture merely because a top-level usage has a resolved type.

The probe ran with the retained Go 1.25.11 binary and caches, `go test -overlay … ./internal/ir/view -run '^TestExplorationContractProbe$' -v`. Exact test/overlay inputs, `native-probe.json` and `native-probe.log` are retained in the probe directory. This is native engine evidence, not a production browser-path test.

### Existing Toolkit WASM hosted by Node

`node sandbox/exploration-contract/toolkit-probe.mjs` instantiated the pinned Toolkit WASM, constructed a `Session.fromSources` over the two simple source files, and called `toGraph('{}')`. It produced a graph with 9 nodes. `session.units()` was byte-for-byte unchanged after projection.

The returned graph has `nodes`, `edges` and `view` fields; nodes include UUID IDs, qualified names, file/line/column locations, metaclasses, parents and compartment rows. These are different data and identity domains from current OpenSysML `EvaluatedView` objects. The probe used the simple source-only Session, not a prepared-library session, and did not prove library-dependent projections or browser integration. Raw evidence is in `toolkit-probe.json`.

## Inspected source, beyond the executed probes

The cached upstream source matches the pin recorded by `scripts/prepare-opensysml.mjs`:

- [`internal/ir/view/view.go`](https://github.com/Open-MBEE/OpenSysML/blob/08ef397841767b829e492bbecf6d723483b4421e/internal/ir/view/view.go): `RenderExposed` renders explicit symbols without adding them or a view to the index. It has no declared-view identity.
- `internal/ir/view/resolve.go`: `RenderNamed` recognizes targeted pseudo-view syntax and forwards selected content to `RenderExposed`. It chooses the first match after lookup; a production exploration API must instead reject ambiguity explicitly.
- `internal/frontend/engine/engine.go`: raw engine RenderView uses that pseudo-view-aware resolver. The combined WASM server's dispatch does not expose raw RenderView, as the executed WASM probe confirms.
- `internal/ir/view/view.go`: the upstream renderer recognizes more representation families than the current application renders. This inspection is not application support evidence for states, actions or other families.
- The pinned Toolkit declaration file's `Session.toGraph` documents graph output and optional summary behavior. Only the default source-only graph was executed in this investigation; summary options and unsupported kinds were not exercised.

## Recommended first implementation task

Add a separate, validated read-only exploration operation around OpenSysML `RenderExposed`, initially limited to project/package tree and a proven bounded structural subject. Keep the existing named-view operation and saved geometry semantics intact.

1. Define a workspace-owned exploration request/result contract distinguishing project roots, a package and an explicit element subject, plus the supported representation. Bind it to the applied source/model revision. A diagram layout mode such as Code/Split/Diagram is not a representation.
2. Extend combined bridge dispatch and worker transport deliberately. Validate the complete applied source set and selected subjects, reject missing/ambiguous/library-only targets, and call `RenderExposed` without source augmentation. Reuse the named-view bridge's origin/context and structural-notation normalization where valid rather than returning an unvalidated raw artifact.
3. Tag temporary exploration separately from named-view identity in workspace state. Share artifact rendering and selection correspondence, but keep transient geometry/camera outside portable named-view presentations. The first read-only slice must not invoke source commands or permit graphical mutation against an unproven exploration identity.
4. Select project roots from actual resolved project membership. For multiple systems or uncertain usage expansion, show the project/package overview and make the selected scope explicit. Establish system-root detection separately; filenames and first-package order are not evidence of a single system.
5. Add the actual pinned browser-worker path before advertising the feature. Cover multi-file roots, repeated usages, Unicode origins, definitions versus typed usages, cancelled/stale requests and renderer failures. Compare exact applied source, drafts, history and every saved named-view presentation before/after exploration.

## Preservation risks and remaining proof

- Renderer IDs such as n0 are local to a rendering and may repeat across scopes. Never reuse geometry solely by those IDs. A scope/representation/revision association must prevent one picture's positions from attaching to another subject.
- Declaration origins alone do not distinguish every occurrence when shared definitions are expanded. Preserve and verify complete usage contexts, consistent with the existing identity reconciliation policy.
- Pseudo-view strings are internal renderer syntax, not a source-backed view usage and not an automatic persistence key. Passing them into the current open/move/save path would blur that distinction.
- A raw render operation does not inherit the current validated bridge's semantic error gate, correspondence normalization or stale-source validation merely because the underlying renderer is shared.
- Creating a synthetic view in copied sources changes the parsed source set, model hash and potentially origins/selection. The direct renderer seam avoids that requirement; no synthetic-source fallback is justified by this investigation.
- Library-dependent input, large project bounds, empty roots, unresolved or anonymous subjects, ambiguous targets, imported exposures, effective inherited ports, and renderer-supported versus application-supported kinds need explicit retained fixtures.
- No application code was changed, and no new browser scenario, saved-data migration, graphical command, shell screen or hosted CI run was executed for this document. Root check/build suites were not repeated for this research-only change; native/WASM probe results above are the executed evidence.
