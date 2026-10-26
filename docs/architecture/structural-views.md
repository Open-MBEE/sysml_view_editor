# Structural view projection

The first structural fixture is [`examples/assembly/model.sysml`](../../examples/assembly/model.sysml) with its [named views](../../examples/assembly/views.sysml). It contains a Station definition, a nested bay usage, primary/standby usages of Device, three explicitly directed inherited ports per Device usage, a connection from primary.output to standby.input, a reference part, comments and an action definition. The devices view deliberately exposes the action: its source remains valid while the engine reports that it is not shown by this renderer.

## Trace and ownership

The trace follows the same pinned OpenSysML `ParseSources` → validated `EvaluateView` contract used by the browser worker. The complete structural artifact supplies parents before children, globally distinct symbol and port IDs, explicit connection endpoints, and correspondence from each symbol to a declaration origin plus its usage context.

| Engine evidence                                                                                  | Application use                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `n1.parent = n0`, `n2.parent = n1`, `n3.parent = n1`                                             | Station contains bay; bay contains primary and standby. ELK receives that hierarchy; React Flow uses the corresponding parent IDs. Canvas coordinates never determine membership. |
| `n2.1` and `n3.1` both correspond to `Assembly::Device::output`, with different ancestor origins | The Inspector identifies the shared declaration and displays the specific usage context. Port buttons select their own symbol.                                                    |
| `from=n2`, `fromPort=n2.1`, `to=n3`, `toPort=n3.0`                                               | The connection ends at primary.output and standby.input. The renderer retains both node and port endpoints; unresolved endpoints reject the artifact.                             |
| Valid source with an exposed unsupported action                                                  | The engine's notice remains visible; its source is retained. This does not imply action rendering or execution support.                                                           |

The original pinned artifact already carried hierarchy, ports, endpoints and usage contexts. The frontend previously ignored hierarchy and ports. The pinned renderer also omitted reference modifiers and left inherited structural pins undirected, even when their declarations explicitly used `in`, `out` or `inout`.

The retained bridge now adds `reference` and declared `direction` metadata by looking up each recorded origin in the parsed symbol index. It does not parse source strings, infer direction from connection order, or calculate effective direction from port types or conjugation. Existing pin directions are retained when no explicit structural declaration modifier applies. The owning TypeBox artifact schemas validate these optional fields; structural validation also checks ownership cycles, duplicate symbol/port IDs and endpoint membership.

The upstream pins, archives and licenses are unchanged. The bridge overlay, builder and shared fixture bytes contribute to prepared provenance. Preparation copies the same example sources into the Go test package, tests their ownership/directions/reference/endpoints/context/notices, and rebuilds the derived WASM. Local before/after raw captures and generated provenance are retained in ignored `sandbox/assembly-before-trace.json` and `sandbox/assembly-trace.json`; these are local evidence, not distributable fixtures or upstream conformance claims.

## Geometry and interaction

The structural projection lives under `workbench/diagrams/`; the workspace remains independent of React Flow and ELK. ELK calculates compound bounds from the engine's parent graph. Definitions/usages retain textual kind labels; references additionally have a `ref` label and dashed border. Typed inherited ports are selectable buttons with direction text and type labels, with handles on the appropriate boundary. The connector line itself does not assert a flow direction.

React Flow uses parent-relative coordinates internally. The workspace and version-1 project bundle continue to store absolute model-space positions. Drag completion converts the displayed hierarchy back to absolute positions and publishes one validated `moveSymbols` presentation update, including descendants affected by a parent move. Validation completes before publishing; an invalid batch leaves all geometry unchanged. Presentation movement adds no source-history entry and changes no source, membership or connectivity.

Restoration converts compatible absolute positions back to parent-relative positions. A saved child position outside its current owner's bounds is arranged again with an explicit notice, including incompatible positions from the older flat renderer. Applied source changes still invalidate presentation mappings conservatively; identity reconciliation across revisions remains future work.

Children remain within their displayed owner's content area. Group movement carries its descendants; overlap avoidance after manual movement, parent resizing, route editing and layout undo are not implemented. Mode/viewport size changes refit the available canvas without triggering a refit on ordinary symbol movement. Modeled coordinates or routes remain explicitly unavailable in this renderer.

## Evidence and limits

Browser tests load the shared sources through the actual pinned workers. They check nested bounds, reference notation, explicit port labels, SVG endpoints against the correct physical port handles, keyboard port selection/source reveal, distinct inherited-port contexts, parent and child movement, view switching and save/reopen with exact source retention. Light/dark snapshots cover the assembly in diagram-only mode. Unit tests exercise malformed topology, projection and absolute-coordinate restoration; the retained Go test checks the engine contract directly.

This slice establishes the fixture's nested interconnection workflow. GeneralView remains a flat tree. Broader owned-port boundary notation, effective directions through conjugated types, modeled layouts/routes, behavior/sequence/geometry rendering, large-model performance and full notation/language conformance remain outside the verified scope. Graphical part creation and connection authoring remain unavailable. See [verification](../verification.md) for commands actually run and [next steps](../next-steps.md) for the remaining milestone.
