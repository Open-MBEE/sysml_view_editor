# Pinned browser engines

The browser app requires OpenSysML and SysML Toolkit WASM workers. Preparation scripts verify upstream archives, retain licenses and write ignored assets/provenance to `static/vendor/`. Temporary source, toolchains and caches stay under `sandbox/`.

| Engine        | Pin                                                  | Purpose                                                     |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| OpenSysML     | 0.10.0 / `08ef397841767b829e492bbecf6d723483b4421e`  | Parsing, model inspection, validation and native evaluation |
| SysML Toolkit | 0.10.10 / `339ef0e073d06e553e81c079755ddfcd224e4b92` | Source transformation proposals                             |

`scripts/prepare-opensysml.mjs` verifies the source archive, applies the retained overlays under `engine-bridge/opensysml/`, runs bridge tests and builds with Go 1.25.11. The derived module exposes `studio_evaluate_view_v1` and `studio_relationships_v1`. It records source/archive, overlay, builder, toolchain, binary and runtime identities. Set `SYSML_GO` to a local Go 1.25.11 binary on platforms without the pinned Linux x64 download path.

`scripts/prepare-sysml-toolkit.mjs` verifies its release archive and every prepared asset. It retains the Apache and EPL licenses, library assets, build information and third-party notices. Neither preparation script installs a toolchain globally.

The raw OpenSysML host lives inside a disposable worker. Toolkit owns its own transformation worker and prepared library. A proposal is accepted only after the host validates its complete source set through OpenSysML. Worker inputs/replies are versioned and TypeBox-validated; 60-second timeouts and cancellation terminate each worker. The Toolkit adapter now returns source-bound UTF-8 splices and, for creation, the selected owner's recorded member extent. The workspace verifies replay, source membership and creation scope before preparing layouts and semantic postconditions.

For an engine upgrade, update explicit pins/checksums, review overlay seams, compare diagnostics/identity/view behavior with fixtures, run unit/build/browser checks and record the new generated provenance. Never turn upstream README claims into application capability claims without that evidence. See root NOTICE for retained source origins.

The structural bridge retains engine hierarchy, inherited-port correspondence and exact connection endpoints. It adds explicit declaration directions and reference modifiers by recorded origin, without inferring effective directions from types or conjugation. The assembly sources under `examples/assembly/` are copied into the Go bridge test package and included in preparation's input digest. [Structural contract trace and scope](../docs/architecture/structural-views.md).

`insertMember` supports typed part and connection creation. Creation may insert within the recorded owner or promote only its terminal semicolon to a body; existing surrounding source is retained. Toolkit accepts some directionally incompatible connections, so the workspace separately checks explicit out/inout-to-in/inout direction, identical resolved type and exact evaluated usage/port endpoints. Conjugated or ambiguous endpoint paths remain unavailable for graphical creation. [Authoring scope and evidence](../docs/architecture/graphical-authoring.md).
