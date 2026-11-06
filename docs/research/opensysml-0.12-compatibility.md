# OpenSysML 0.12 compatibility evaluation

Candidate: stable [v0.12.0](https://github.com/Open-MBEE/OpenSysML/releases/tag/v0.12.0), commit `760c4d1fc8edfa4e214423099065c0a7c1b24e2d`. Evaluation started 2026-11-06 against this editor's pinned 0.10.0 bridge. This document records local evidence; upstream release assertions are not application test results.

## Build and provenance

The source archive SHA-256 is `49939c5f4c3008cdcf79d39a976719f67aab9d38bb38b246832eb1fdd90de08e`. The build uses Go 1.27.3 (Linux amd64 archive SHA-256 `65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40`) in ignored `sandbox/opensysml-012/`. The preparation script retains archive, overlay, toolchain, builder, binary and JS runtime provenance and runs the combined/engine Go packages before compiling WASM. Toolkit stays at 0.10.10.

## Compatibility changes discovered

- `Rendering.DataFor` became `DataWith`; native `marshalRenderView` now takes the cached model.
- The new renderer hides optional typing/labels by default. The bridge requests the full semantic notation needed by this app; presentation remains owned by the browser renderer.
- Native tree/interconnection rendering expands inherited usages and synthesizes satisfy-subject members. The bridge retains the existing explicit ownership projection, excluding inherited occurrences and AST-identified synthetic subjects. Named-view selected roots/exposure remain native.
- Interconnection renderings expand inherited attributes and newly include constraint nodes. The bridge retains the existing structural subset and its source-backed effective attribute compartments. Explicit owned attributes keep their prior projection.
- Native JSON omits empty node/edge arrays and anonymous node/port names. The transport canonicalizes these as arrays and empty strings without inventing declarations.
- Composition member labels and satisfaction keywords changed. The bridge retains the composed member's label and carries satisfaction kind/polarity separately from the authored relationship name.
- Extra native nodes shift ordinal IDs even though the model hash is unchanged. After the compatibility projection, node/port IDs and all dependent endpoints are renumbered in retained declaration order. Declared structural connectors whose native endpoints are inside pruned inherited children retain their nearest recorded visible component boundaries; hidden internal pins are not invented as boundary ports, and inherited internal connectors remain excluded. The old-engine correspondence fixture checks exact source origins, complete usage contexts and IDs across four example projects.
- Native tree edge ordering changed. The exploration regression now binds its source-identity assertion to the actual declaration rather than a fixed edge index; its exact source assertions remain.

## Compatibility evidence

Initial native bridge tests passed after the API port. A deliberate fault setting satisfaction negation to false failed the new `TestStudioRelationships` assertion; restoring the cached source passed the same command. Logs are `polarity-mutation.log` and `polarity-restored.log`. Initial browser runs exposed the changes above: identity and UTF-8 edit probes passed, while exploration, requirements and rover regressions found transport/projection differences. Failures were diagnosed from retained Playwright traces before changes were made.

A positioned version-1 project was captured by serving the retained 0.10 WASM through the running application: `tests/fixtures/opensysml-0.10-positioned.sysml-project.json`. Its source hash, model hash and geometry are actual old-engine output, not invented fixture values. `engine-upgrade.spec.ts` imports it through the current worker and compares exact source, declaration correspondence, rendered positions and the downloaded bundle.

Ignored working evidence is under `sandbox/opensysml-012/`: build/check/browser logs, the old module and runtime, comparison scripts and captures. The first full local functional pass was 102/110. Failures exposed richer tree relationships, lost bounded structural connections, a camera-fit/drag readiness race and an existing raw-double-versus-CSS-precision assertion. The structural connection loss is an application adaptation defect and was fixed; a deliberate boundary-projection fault failed `TestStudioRetainsDeclaredBoundaryConnections`, then passed after restoration (`boundary-mutation.log`, `boundary-restored.log`). Tree changes were checked against actual source/resolved endpoints before catalog expectations changed; the new fixture adds endpoint/declaration assertions. Geometry tests retain exact bundle doubles and use the existing browser-normalized rendering comparison.

## Final local checks

Code checks passed: 160 Vitest tests, ten Node checks, formatting, architecture and TypeScript. The production build passed. The full functional run passed 109/110; the failing new navigation/preservation case exposed a representation reset race, fixed before all eleven focused requirements/upgrade/source-assistance cases passed against a fresh build. All retained legacy identities/endpoints and positioned-project checks passed. The full suite was not rerun after this bounded fix.

Normal visual comparison passed 75/77; two narrow diagram baselines were reviewed and corrected after three pixel-identical follow-up captures. Four requirement-diagram comparisons then passed. Final fresh-build workbench, requirement-diagram and table/matrix comparisons passed all fifteen. No tolerance or semantic assertion was weakened. [Full verification record](../verification.md) distinguishes initial failures, corrections, intermediate server failures and final results.

No hosted CI result is established by these local runs.
