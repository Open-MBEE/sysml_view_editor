# OpenMBEE brand-guide review

Recorded 2026-11-23 for [PR #53](https://github.com/Open-MBEE/sysml_view_editor/pull/53). The independent source reviews compared original head `2968796` with its base `88e3bc7`. Local integration merges current `develop` `697736e` into that branch without conflicts. The review preserves the requested official brand direction; no layout redesign, dependency addition, engine pin or saved-format change is included.

## Standards

No documented-standard violations or applicable code-smell findings were identified in the original source diff. Appearance changes use existing semantic tokens and palette controls. The native home link retains its accessible name and modified-click behavior; both icon images are decorative. Workspace, persistence and engine boundaries remain unchanged. Required font notices and asset provenance are retained.

## Spec

One P2 finding, corrected: the original NOTICE and brand-asset README asserted CC BY 4.0 for the OpenMBEE marks. The [official license page](https://www.openmbee.org/licenses.html) explicitly excludes the OpenMBEE name and logo from its general Apache/CC BY licenses. The corrected notices retain provenance and refer to the [brand guidelines](https://www.openmbee.org/brand.html) and trademark terms without asserting an unsupported CC BY grant. The asset bytes are unchanged.

No other implementation/spec mismatch was identified. The official guide confirms ABeeZee Regular, dark blue `#10052F`, light blue `#64DDFA`, grey `#D6D6D6`, the full-colour icon on dark backgrounds and dark icon on light backgrounds. The three SVG assets and Fontsource 5.3.0 WOFF2 bytes match their documented upstream hashes. OFL font licensing is distinct from the brand-mark terms.

Review totals: Standards 0 findings; Spec 1 P2 finding, resolved by the notice correction. Neither source review independently establishes full accessibility or security certification.

## Visual and runtime inspection

All 159 changed baselines were directly inspected in ten contact sheets. Eight captures additionally received full-size inspection: light desktop/dark phone landing pages, both desktop workbenches, both 390 px Source-pane states and both 390 px generated reports. The font/palette changes retain readable controls, wrapping and bounded phone pane containment in those captures. The reviewed baseline hashes and exact file inventory are retained in ignored `sandbox/brand-review/inspected-visuals.json`; the committed PNGs remain the reviewable baseline artifacts.

A production-page probe confirms ABeeZee loads, the home link retains its accessible name, both images have empty alt text, and exactly the correct 24 px icon is displayed in each theme. It does not load a model or alter semantic source. Probe and results: ignored `sandbox/brand-review/brand-runtime-probe.mjs` and `brand-runtime.json`.

## Verification scope

`npm run check` passes formatting, architecture, TypeScript, 187 Vitest tests and 12 Node script tests. `npm run audit` passes production and development-inclusive scopes without exceptions. The normal visual run and the final selected functional run each use their own fresh production build/server with normal pinned-engine preparation. An initial shared-server run printed all 50 assertions passed but its outer command ended with SIGTERM (143); it is not treated as a clean command pass. The selected set was repeated through the standard npm script and test-managed server: all 50 passed in 5.9 minutes with recorded exit status 0. The normal visual run passed all 110 scenarios in 10.3 minutes without baseline updates. The selected-title ledger accounts for exactly 50 cases, including all 35 critical cases, with none missing or unexpected.

Browser results are recorded in [verification](../verification.md). Normal visual comparisons do not update baselines. The selected functional set includes every critical workflow plus appearance/palette, narrow/phone, corrected exploration scope, native filter scope and hidden-save coverage. It is not a complete 148-scenario functional rerun. Firefox/WebKit, a full accessibility audit and deployment are not established by this review. Original PR-head results retain their original scope and do not substitute for current integration checks.
