# Source-backed values: engine assessment

Recorded 2026-11-11 against editor HEAD `618e776466817d9064027b8c9756065df05766bb` (coordinator reports source identical to `3ca0d7f`). Read-only diagnosis/proposal for #24, paired with #30/#31 readability and followed by #33 inspection. No production fix is applied by this assessment.

## Finding and causal ownership

The engine parses the authored expressions correctly. The native **renderer object tree** has `Node.Value`; the native **flattened rendering data** does not. `internal/ir/view/tree.go:224,453` populates a usage's value using `declValue`; `internal/ir/view/data.go:43,159` defines `NodeData` and copies nodes without `Value`. Thus the earliest demonstrated loss is **native rendering-data projection**, before the local bridge's JSON conversion. `internal/frontend/engine/json.go:364` also has no value field in `JRenderNode`, and `engine.go:394` cannot convey one. Merely adding `Value` to that JSON struct will not recover it.

The frontend independently omits values: `src/lib/workbench/diagrams/Diagram.tsx:271` constructs tree labels from kind, name and type only. The current bridge's `structuralNotation` in `engine-bridge/opensysml/evaluate_view.go:404` adds whole source declarations for effective non-library attribute members, only on interconnection artifacts. It neither enriches tree attributes nor gives compartment rows their own source identity. Fixing labels alone cannot work against today's pinned worker response.

The ranked hypotheses supplied by the coordinator are resolved as follows:

1. Native tree omits values: **false for renderer objects; true for flattened `Data()`**.
2. Bridge drops a native field: **partly true as a transport gap**, but loss precedes local normalization; there is no `NodeData.Value` to copy.
3. Frontend labels name/type only: **confirmed**, a second necessary change after metadata exists.

These are authored source expressions, not computed results. Neither `24.0`, `2 [m]`, `number`, nor `(2 + 3) * 4` establishes a runtime value or an execution result.

## Pins and retained evidence

Editor `engine-bridge/README.md` pins OpenSysML 0.12.0 at `760c4d1fc8edfa4e214423099065c0a7c1b24e2d`, SysML Toolkit 0.10.10 at `339ef0e073d06e553e81c079755ddfcd224e4b92`, and Go 1.27.3. The assessment uses the existing canonical `sandbox/opensysml-012/source` and `sandbox/opensysml-012/go/bin/go`, without modifying either.

Existing `static/vendor/opensysml/provenance.json` records:

- Archive SHA-256 `49939c5f4c3008cdcf79d39a976719f67aab9d38bb38b246832eb1fdd90de08e`.
- Overlay digest `fa5556f905554120acf3933757b857cea496dd6cad3d9fa0ac9b8a2c33e9aeb9`.
- Builder digest `db47937af9ea9b282f8c74d4a3f42bfaf900cea1233db1c9e11c39deaa058bdf`.
- WASM SHA-256 **independently checked**: `95c6dced93044eeb2a29191e697a590964c5f6722d997c8b8de70cba5d73fb76`.
- Runtime digest recorded by provenance `0c949f4996f9a89698e4b5c586de32249c3b69b7baadb64d220073cc04acba14`.

Assets were never regenerated.

All new executable evidence is in ignored [engine-assessment scratch](../../sandbox/source-values/engine-assessment/): `controls.sysml`, `probe_test.go`, `overlay.json`, `probe.log`, `wasm-probe.cjs`, `wasm-probe.log`, `wasm-controls.json`, `verify.py`, `summary.json`, and an independent `gocache/`. The controls source SHA-256 is `873fdf749b3fd18238070f5360f378da77301bbdf47127ba585530093f12736e`.

The final controls have no parse diagnostics. Both Go and unchanged pinned WASM report model hash `78af05631c7ed5a12bb607c007055668b6825a6562ae6130be6fdb5576e81b50`; their complete bridge tree and structure responses compare equal, including origins, correspondence, context, and declarations. Final Go test: PASS, 0.142 seconds reported package time; final verifier: PASS. The direct WASM reports 20 tree nodes and 7 structural nodes; these counts describe only this fixture.

Coordinator-owned product red is retained in [browser-before2.log](../../sandbox/source-values/browser-before2.log): expected `24`, received `attributecapacity : Real`. [Baseline worker response](../../sandbox/source-values/baseline-evaluation.json) has exact local origins and contexts but no expression field. The browser trace is under `sandbox/playwright/source-values-before2/`. I did not rerun this browser test, inspect its screenshots, use port 4175, or claim it is green. The earlier bad node/edge test filter is not product evidence.

The [WP26 review](wp26-screenshot-review.md) owns the historical screenshot audit and pinned report provenance. Its original ADCS source references are under immutable commit `325e2e3fb53d178d88ec7aad5994d08d0a9b743a`, `examples/adcs/model_v2/{cubesat,stakeholders,views}.sysml`. This assessment adds engine controls; it does not reattribute historical screenshots to the present build.

## Reproduction

Run from the editor repository. No preparation, production build, server or dependency installation is needed:

```bash
GOCACHE="$PWD/sandbox/source-values/engine-assessment/gocache" \
GOMODCACHE="$PWD/sandbox/opensysml-012/go-modules" \
GOPROXY=off GOSUMDB=off GOTOOLCHAIN=local \
ASSESS_MODEL="$PWD/sandbox/source-values/engine-assessment/controls.sysml" \
sandbox/opensysml-012/go/bin/go -C sandbox/opensysml-012/source test \
  -mod=readonly -overlay "$PWD/sandbox/source-values/engine-assessment/overlay.json" \
  ./internal/frontend/engine -run '^TestSourceValuesAssessment$' -count=1 -v \
  > sandbox/source-values/engine-assessment/probe.log 2>&1
fnm exec --using 26.3.1 node sandbox/source-values/engine-assessment/wasm-probe.cjs \
  > sandbox/source-values/engine-assessment/wasm-probe.log 2>&1
python3 sandbox/source-values/engine-assessment/verify.py
```

The Go overlay introduces only a virtual test file in the canonical module. The retained overlay contains absolute paths for this workspace. It examines `MembersOf`, `ast.ValuePartOf`, `ValueExpression`, `RedefinedFeatures`, native renderer roots, flattened data, wire JSON and local `EvaluateView`. The verifier asserts exact byte slices, native-root values versus missing data values, Go/WASM equality and distinct nested contexts. It is a diagnostic harness, not the eventual product regression.

The first Go attempt used the default module cache and failed offline module lookup; rerunning with the existing `sandbox/opensysml-012/go-modules` succeeded. A first binding control used reserved keyword `first` as a name and was invalid; final names are `leftValue`/`rightValue`, and the harness rejects error diagnostics. An initial Node harness relative import was corrected. These setup failures are not product reproductions.

## Verified semantic/source controls

| Case                           | Actual observation                                                                                                                                        | Supported conclusion / gap                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two local redefinitions        | `P::a::number` is `24.0`; `P::b::number` is `48.0`; both redefine `P::Base::number`                                                                       | Effective member selection keeps local declaration/provider identity distinct.                                                                         |
| Inherited default              | `MembersOf(a/b)` retains inherited members from `Base`; `Base::number` has `12.50`, default=true                                                          | Raw authored defaults can be exposed with provider origin. No execution claim.                                                                         |
| Valueless local redefinition   | `P::c::number` has no own expression; `RedefinedFeatures` returns `Base::number`                                                                          | A scratch recursive provider traversal finds exact `12.50`, default=true, at the base declaration. `ValueExpression(c::number)` alone is insufficient. |
| Unicode String                 | Exact `"α/证据.json"`                                                                                                                                     | UTF-8 byte slicing validated against fixture bytes, including quotes.                                                                                  |
| Long String                    | Complete long authored evidence-path literal in member capture and native roots                                                                           | Full inspection text is available. Canvas clipping/wrapping remains coordinator acceptance.                                                            |
| Boolean                        | Exact `true`                                                                                                                                              | Authored expression, not inferred Boolean evaluation.                                                                                                  |
| Unit expression                | Exact `2 [m]`                                                                                                                                             | Unit spelling retained; no conversion or unit evaluation required.                                                                                     |
| Complex expression             | Exact `(2 + 3) * 4`                                                                                                                                       | Preserve syntax; do not replace with `20`.                                                                                                             |
| No declared value              | `Base::empty` has no AST value or semantic `ValueExpression`                                                                                              | Explicit absence of an own expression is distinguishable. It does not prove no constraints/bindings elsewhere.                                         |
| Reference value / binding form | `Base::linked = number` retains raw `number`; native binding helper treats resolved feature-reference/chain values as bindings, excluding default/initial | Do not display referenced feature's calculated value.                                                                                                  |
| Initial value                  | `initial := 7` yields expression `7`, initial=true                                                                                                        | Preserve operator category; do not label it an unconditional binding/default.                                                                          |
| Separate binding declaration   | `Bound` declares `leftValue = 5`, valueless `rightValue`, and `bind leftValue = rightValue`                                                               | `ValuePartOf(rightValue)` remains absent. Standalone binding traversal is a verified API coverage gap, not permission to invent `5` on `rightValue`.   |
| Repeated nested declaration    | `Pair::left` appears under both `system.pair1` and `system.pair2`                                                                                         | Same declaration origin, distinct complete 3-element contexts verified; attribute occurrence needs that whole chain plus its attribute declaration.    |

Native tree scope remains declaration-owned: the local bridge does not publish every inherited child as a tree node. The controls do not justify expanding tree semantics to imitate interconnection rendering.

## Owning APIs and proposal

Primary code sources below are relative to canonical OpenSysML source unless prefixed with editor paths. No external normative claim is needed for these observed API facts.

- `internal/syntax/ast/value_part.go:11`: `ValuePartOf` returns the authored expression plus default/initial flags, false for no own value. `ast.Usage` in `defusage.go` also records `ValueOperatorSpan`. Expression `Span()` is the raw expression extent; do not use AST dump/pretty printing or renderer `expressionText` as an exact-source contract.
- `internal/semantic/semantics/reflective_feature_value.go:40`: `ValueExpression` synthesizes a source-located expression symbol from the declaration's expression; it does not resolve inherited providers for a valueless redefining feature. Reflective `FeatureValue` membership is metamodel structure, distinct from runtime `JFeatureValue`.
- `internal/semantic/semantics/members.go:15`: `MembersOf` supplies effective members with name and redefinition masking. Use it for compartment members instead of collecting lexical bodies or parsing declaration strings.
- `internal/semantic/semantics/masking.go:20`: `RedefinedFeatures` supplies semantic targets. It is the candidate seam for following a valueless redefinition to source providers, with cycle detection and ambiguity handling.
- `internal/semantic/semantics/annotations.go:888`: `OwnFeatureValues` follows redefinitions and returns constant/filter values. It can evaluate/convert literals, quantities and expressions and does not return exact provider source. It is **not** the display API. Runtime instantiation/feature reads are also inappropriate here.
- `internal/syntax/source/source.go`: spans are UTF-8 **byte** ranges. `cached.sourceText()(provider.DocName, expression.Span())` returns exact source. Browser substring indices are UTF-16; never apply byte offsets to JS text without the existing source-coordinate conversion.
- Editor `evaluate_view.go` already supplies revision-bound `ViewSubject` identities and complete `ViewCorrespondence.Context`. Bind metadata to these, not short names, labels or geometry.

Propose one bridge-owned source-value resolver, shared by tree nodes, structural attribute rows, and inspection. For an effective member: first read its own AST expression; otherwise collect semantic redefinition providers without evaluation. Keep all candidates until uniqueness is established; do not choose the first matching name/default. Prototype traversal in `probe_test.go` proves only the single-target default case, not general precedence.

A minimal proposed normalized shape (names illustrative):

```ts
type SourceValue =
  | {
      status: 'available';
      expression: string;
      expressionOrigin: { file: string; offset: number; length: number };
      provider: ViewSubject;
      isDefault: boolean;
      isInitial: boolean;
      provenance: 'own' | 'redefined';
    }
  | { status: 'absent' } // no declaration/redefinition source expression found
  | { status: 'unsupported'; reason: string };
type SourceAttribute = {
  subject: ViewSubject; // effective selected attribute declaration
  context: string[]; // complete owner occurrence chain + subject.id
  declaration: string; // exact effective declaration source
  value: SourceValue; // provider may differ from subject
};
```

Validate origins against the applied source revision, exact expression slices, source membership, context/declaration correspondence and provider identity before publication. Existing `modelHash` binds the envelope; do not persist derived metadata in project version 1. Absent metadata from an older worker must mean unavailable capability, **not** a verified absent expression. A binding elsewhere may exist even when status=absent; label the UI “no declared expression” rather than “no value”. Explicit unsupported reasons should cover missing source/AST, multiple unresolved providers, cycles and unimplemented binding-derived provenance. Do not manufacture strings for any of these states.

Suggested editor files: a focused Go source-value overlay under `engine-bridge/opensysml/`, invoked by `evaluate_view.go` normalization for tree/interconnection; retained Go regressions in `validated_view_test.go`; preparation overlay mapping/digest inputs in `scripts/prepare-opensysml.mjs` if adding a file; `src/lib/workspace/views/schema.ts` for owning TypeBox metadata and referential validation; diagram projections/rows under `src/lib/workbench/diagrams/`; and `src/lib/workbench/properties/Properties.tsx` plus selection mapping for inspection. Keep source-value resolution out of React and the engine-independent workspace. Preserve current `attributeDeclarations` until callers migrate deliberately. No new dependency or persistent project-format field is warranted.

A narrow upstream report could independently demonstrate `Node.Value` lost by `Data()`. A local AST-backed contract remains useful even if upstream forwards a display value: native `declValue` can format expressions and does not identify an inherited provider. Do not rely on upstream acceptance to implement the local user outcome.

## Regression acceptance and remaining scope

Retain the coordinator's exact browser red command, using Node 26.3.1:

```bash
fnm exec --using 26.3.1 npm run test:e2e -- --project=functional source-values.spec.ts
```

The eventual retained Go test should assert all controls above, including negative/missing-source cases, provider origins distinct from selected local declarations, exact raw complex/String expressions, and full context chains for repeated nested occurrences. Add deterministic multiple-redefinition ambiguity/cycle controls before claiming general fallback resolution. Include standalone binding declarations as explicit coverage: either source-backed relationship inspection or a visible supported-scope explanation, never a silently borrowed calculated value. Do not narrow #24 to local numeric literals.

Browser acceptance must use the prepared pinned workers after the coordinator's deliberate asset rebuild: distinguish 24/48 and their separate evidence paths, show readable initial labels for #30/#31, inspect full long/Unicode/complex expressions, and select the correct attribute/provider occurrence under repeated usages. Preserve source, applied/draft distinction, compatible geometry, undo/redo and portable reopen. Source reveal must target the right declaration/expression and remain disabled for unapplied drafts. #33 selection and layout acceptance belong to the coordinator; this note provides no visual or accessibility verdict.

Still unverified: multiple/generalized defaults and precedence, cross-feature specialization, implicit positional parameter redefinitions, separate binding-derived provenance, cyclic/ambiguous providers, recorded/hydrated library expressions, expression forms beyond these controls, and large-model performance. Single-provider traversal must not be presented as a complete effective valuation algorithm. General source-backed inspection can retain unsupported declarations and relationship sources without evaluating them.

Only this new Markdown note and the dedicated ignored scratch directory were written. Existing untracked screenshot-review, fixture, and browser tests were preserved (an additional coordinator-owned inspection test appeared during research). No production edits, asset writes, preparation scripts, product builds, servers, browser checks, dependencies, commits, pushes, remote edits, CI monitoring, or delegates were performed. The product remains red pending coordinator implementation and checks.
