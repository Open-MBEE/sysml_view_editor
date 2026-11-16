# Private source-value engine candidate

Recorded 2026-11-11 against editor `618e776466817d9064027b8c9756065df05766bb`, branch `feature/source-values-inspection`. This is a privately tested candidate, not an applied production change or a rebuilt worker. The agreed shape is [the sandbox contract](../../sandbox/source-values/contract.md); the [assessment](source-values-engine-assessment.md) records the original projection loss.

Review [candidate.patch](../../sandbox/source-values/engine-implementation/candidate.patch). All candidate code, embedded-fixture tests, overlays, scripts, logs and build cache live in [engine-implementation](../../sandbox/source-values/engine-implementation/). This report is the only new document written outside that directory. Existing parent research, tests and concurrent frontend changes were preserved.

## Candidate behavior

The patch adds `source_values.go` and `source_values_test.go`, invokes enrichment at the end of `normalizedRendering` after correspondence is complete, adds both files to preparation's overlay/digest inputs and engine copy mapping, and makes a narrow adjustment to the existing #18 golden comparison. Actual engine-bridge files and the preparation script remain untouched.

Attribute nodes receive optional `sourceAttribute`. Effective compartment members receive optional `sourceAttributes`. Both use the same resolver, exact applied declaration slices and correspondence context chains. Temporary exploration uses that same normalization path. The patch preserves existing attributeDeclarations, graph IDs, parent/child structure, endpoints, selected scope and correspondence. It adds no saved-format field, pin, dependency, asset or evaluation step.

Values carry raw authored expression text, exact UTF-8 byte origin inside the provider declaration, provider identity, explicit default/initial booleans and own/redefined provenance. Available values never use formatted AST output, source regex, runtime evaluation or reference-value substitution. Optional type labels come from semantic `FeatureTypes` only when it returns one type. Provider subject construction uses the semantic symbol directly rather than rescanning the entire library index for every row.

Provider traversal follows semantic explicit redefinitions, stops at an own expression, detects cycles, rejects multiple distinct providers and collapses diamond paths by actual symbol identity. Missing AST/source, unresolved redefinitions, out-of-declaration expressions and implicit-provider precedence are explainable unsupported outcomes. Absence means no declared expression found along the supported graph, not a computed lack of value.

Full usage contexts are resolved hop by hop through effective `MembersOf` and semantic redefinition identity. The resolver does not match names. For contextual attribute redefinitions it uses `ChainTargetPath`, which retains the occurrence path that terminal `RedefinedFeatures` alone loses. Every relative path must match the corresponding owner-context suffix. Competing contextual candidates are unsupported; simultaneous non-default own and contextual assignments are unsupported rather than given invented precedence. If an attribute node's rendered declaration differs from its contextually effective member, it explicitly reports unsupported contextual projection instead of borrowing that declaration's value.

Standalone bindings are detected in authored owner/inherited scopes through AST declarations, including anonymous bindings omitted by named `MembersOf`. All attributes in such a scope are conservatively unsupported for value precedence, including attributes with defaults. The reason retains the binding's exact source declaration and `file@byteOffset:length` location when available. This is source-backed explanatory text, not structured relationship inspection or binding-derived value inference.

## Verified evidence

Final [full-final.log](../../sandbox/source-values/engine-implementation/full-final.log): complete `./internal/frontend/combined` and `./internal/frontend/engine` suites PASS, package times 5.700 s and 0.488 s. This includes the existing #18 occurrence/exposure tests and all original engine tests, plus the new metadata and provider-safety regressions. These are local native Go results, not browser/WASM/hosted CI results.

The retained regression checks:

- Local numeric overrides `24.0`/`48.0` and local String overrides `"local α"`/`"local 证据"` with their own providers.
- Complete long and Unicode Strings, Boolean `true`, `2 [m]`, `(2 + 3) * 4`, raw reference `number`, initial `7`, inherited default `12.50`, no declared expression and valueless redefinitions.
- Inheritance through two valueless redefinition levels, with the original provider identity retained.
- Repeated explicit nested part redefinitions yielding `101` and `202`, with distinct provider declarations under `nestedA` and `nestedB`.
- Repeated qualified attribute redefinitions `pair1.left.number` yielding `301` and `402` in their distinct outer usage contexts; parallel `pair2` contexts retain `12.50`. These are distinct contextual assignments, not merely equal defaults under different IDs.
- Exact declaration and expression byte slices, expression containment inside provider origins, complete context equality against correspondence, provider identity/provenance and exact expression spelling. Attribute nodes, compartment rows and exploration metadata are exercised.
- A real semantic multiple-provider ambiguity, synthetic graph cycle/diamond/own-precedence cases, missing AST/source, external-document provider and invalid expression origin. Synthetic fault injection is identified in the test and does not claim that invalid cyclic SysML passed conformance validation.
- Standalone binding unsupported status, including the exact retained `bind leftValue = rightValue;` text; it never turns the right side into `5`.

[baseline-final.log](../../sandbox/source-values/engine-implementation/baseline-final.log) proves the metadata regression compiles against the unchanged bridge and fails at `missing source metadata for P::a/number`. Its overlay adds only a black-box test; it does not add candidate implementation code. The canonical `studio_view.go` and real bridge `evaluate_view.go` independently had the same SHA-256, `20882395a5436b033d1493667bcdfb11e368854250f3c28dcf7e1aeafc564e80`.

Two deliberate behavioral mutations independently fail:

- [context-negative-final.log](../../sandbox/source-values/engine-implementation/context-negative-final.log): ignoring a contextual provider returns the base `12.50` instead of required `301` from `P::qualifiedA::overrideNumber`.
- [provider-negative-final.log](../../sandbox/source-values/engine-implementation/provider-negative-final.log): substituting the selected subject for the inherited provider fails the expression byte/provider containment assertion for `P::c/number`.

An initial negative-control attempt failed compilation because its mutation left a variable unused; that was corrected. Only the subsequent behavioral failure is negative-control evidence. Early private runs also exposed the anonymous-binding enumeration gap and a library-scope binding false positive; the final candidate walks authored AST scopes instead. Earlier logs remain for transparency and are superseded by the `*-final.log` files.

The #18 goldens intentionally describe the original envelope. The candidate helper recursively copies their values while omitting **only** `sourceAttribute` and `sourceAttributes`; it does not mutate results or strip any other field. Both the original semantic-node comparison and complete Explore-envelope comparison use it. All original ID, origin, context, selection, endpoint and legacy-node assertions remain. New metadata is independently asserted by the dedicated tests rather than replacing the old goldens.

`git apply --check sandbox/source-values/engine-implementation/candidate.patch` passed against the actual checkout. `node --check sandbox/source-values/engine-implementation/prepare-opensysml.mjs` passed. The preparation script was syntax-checked only, never executed. The final patch's original-file hashes are retained in [base-sha256.json](../../sandbox/source-values/engine-implementation/base-sha256.json).

## Reproduction

From the editor repository, with the existing canonical pinned source, Go 1.27.3 and module cache:

```bash
sandbox/source-values/engine-implementation/run-tests.sh baseline \
  > sandbox/source-values/engine-implementation/baseline-final.log 2>&1
# Expected exit 1: missing metadata on the unchanged bridge.
sandbox/source-values/engine-implementation/run-tests.sh full \
  > sandbox/source-values/engine-implementation/full-final.log 2>&1
# Expected exit 0: complete combined and engine suites.
sandbox/source-values/engine-implementation/run-tests.sh context-negative \
  > sandbox/source-values/engine-implementation/context-negative-final.log 2>&1
sandbox/source-values/engine-implementation/run-tests.sh provider-negative \
  > sandbox/source-values/engine-implementation/provider-negative-final.log 2>&1
# Each negative control must exit 1 at its semantic assertion.
python3 sandbox/source-values/engine-implementation/make-patch.py
git apply --check sandbox/source-values/engine-implementation/candidate.patch
node --check sandbox/source-values/engine-implementation/prepare-opensysml.mjs
```

The runner uses only `sandbox/opensysml-012/go/bin/go`, verifies version 1.27.3, sets private `GOCACHE`, existing `sandbox/opensysml-012/go-modules`, `GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, and passes `-mod=readonly -overlay ... -count=1`. The source fixture is embedded in the retained candidate test so normal future preparation tests need no special environment variable. `controls.sysml` is the readable matching fixture. Overlay JSON contains absolute workspace paths; regenerate paths if transferring the scratch directory. No checkout/worktree was created or copied wholesale.

## Material limits and next seams

This candidate is not a general effective-valuation implementation. Explicit nested redefinitions and resolved qualified paths above are verified. Mixed competing assignments deliberately remain unsupported. Generalized default precedence, positional/implicit redefinitions, hydrated/library provider AST/source, and binding-derived values need separate work. Library binding declarations are not enumerated by the authored-scope guard; general library constraint/default precedence remains unverified. The guard also marks unrelated authored attributes unsupported when their scope contains a separate binding, favoring an explainable limitation over a potentially wrong default.

The correct next seam for broader binding support is semantic connector-end/feature-path provenance keyed by the same complete usage context, followed by explicit binding/default precedence. Preserve relationship subject and endpoint source origins in a separately agreed structured contract; the current contract has only unsupported reason text for this evidence. Do not parse names or follow a binding to a computed value. A renderer that supplies a declaration inconsistent with its effective attribute occurrence needs occurrence-aware projection/correspondence, not silent replacement of legacy IDs.

Missing selected-attribute source cannot provide an exact declaration; the candidate emits unsupported with an empty declaration in that exceptional case. Normal authored fixtures cannot trigger this, and the parent's publication validator must continue rejecting invalid/non-project subject origins. Missing provider source and invalid expression origins are directly tested. Large-model performance has not been benchmarked; final fixture tests run below one second for the engine package on this machine, which is not a scale guarantee.

No normal prepare, product build/check, shared WASM rebuild, server, browser, port 4175 access, dependency/cache-metadata change, commit, push or remote operation was performed. The parent's browser baseline remains expected red until deliberate integration and rebuild. This candidate does not establish frontend rendering, TypeBox publication, selection/reveal UX or visual acceptance; those remain parent-owned.
