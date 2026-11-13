# Source-value outer-scope safety revision

Recorded 2026-11-11 against editor `618e776466817d9064027b8c9756065df05766bb`. This is an isolated revision of the [private candidate](source-values-implementation.md), addressing the [independent review blocker](source-values-engine-review.md). Production Go, preparation scripts and browser assets were not changed.

The [revised candidate.patch](../../sandbox/source-values/engine-revision/candidate.patch) includes the complete original candidate plus the repair and retained regressions. It applies to the actual editor checkout; it is not an incremental patch on top of the earlier candidate. All executable material and caches are in [engine-revision](../../sandbox/source-values/engine-revision/). The original candidate and reviewer files remain unchanged.

## Repair and bounded behavior

Renderer contexts begin at exposed roots and cannot enumerate every source scope. The revised bridge inventories authored declarations once per normalization, walking every workspace document's actual scope tree, including anonymous bindings and split namespace declarations. It does not enumerate library declarations or use reexport membership as a substitute for source ownership.

For external binding ends it calls the semantic `ConnectorEndFeaturePaths` API. For qualified attribute redefinitions it calls `ChainTargetPath`. Paths are compared with the complete resolved occurrence using symbol identity and semantic redefinition specialization. Lexical feature/definition owners can prefix an independently exposed root for comparison without being inserted into its renderer correspondence. Applicable type scopes use `MemberSources`; no display-name or short-name matching is used.

An affecting external declaration returns **unsupported**, including its exact applied declaration and `file@offset:length`. This repair deliberately does not choose between a default, an external assignment and a binding, or compute a binding's value. The ordinary existing resolver still handles the verified local and internal nested contextual assignments. Resolved external effects apply only to their matched occurrence: parallel usages and nested siblings retain their own source-backed defaults.

If the pinned engine cannot resolve an external path, the bridge cannot prove the declaration irrelevant. It reports uncertainty within the relevant semantic source scope. Split namespace owners use the index's full namespace identity because their distinct source declarations represent one namespace. This can conservatively mark otherwise unaffected attributes in that scope unsupported; it does not blanket-disable values across unrelated project scopes. Non-chain external attribute redefinitions likewise lack a complete occurrence path and receive this bounded uncertainty handling. Internal declarations still use the original provider graph and precedence guards.

Only the two derived metadata keys are added. Graph IDs, context arrays, selected scope, edges, origins, old declaration strings and saved-project format remain unchanged. The original #18 golden exclusion still removes only those two additive keys; all original identity/endpoint comparisons remain.

## Retained evidence

The original reviewer examples were rerun against the original candidate: both fail at their semantic assertions in [review-red-final.log](../../sandbox/source-values/engine-revision/review-red-final.log), exit 1. Both have strict parse success and complete rendering; the incorrect result is an available `12.50` default despite a package-level affecting binding or qualified assignment.

The revised complete suites pass in [full-final.log](../../sandbox/source-values/engine-revision/full-final.log), exit 0:

- `./internal/frontend/combined`: 3.402 s reported package time.
- `./internal/frontend/engine`: 0.990 s reported package time.

These native Go suites include the original metadata/provider cases, #18 identity/exposure controls, both reviewer counterexamples and eight added outer-scope scenarios. Local native results do not establish browser/WASM behavior or upstream acceptance.

The new scenarios retain exact context equality against actual correspondence and distinguish:

1. A package-level binding affecting `a`, while parallel `b` retains `12.50` with its original provider and exact expression bytes.
2. A cross-file split namespace binding and qualified assignment, with the limitations below explicitly tested through real parsed symbols.
3. A binding in another package whose resolved qualified endpoint targets `P::a`; parallel `P::b` stays available.
4. Repeated `one`/`two` assembly usages, with an external binding or assignment targeting only `one.left.number`. `one.right`, `two.left` and `two.right` retain the base default with no provider leakage.
5. An independently selected member whose enclosing definition has a qualified assignment. The engine's unresolved path is reported unsupported; a separate `P::b` remains available.
6. Competing outer assignments: their affected occurrence is unsupported rather than given an arbitrary precedence, and its parallel usage retains its own default.

Two additional pinned-engine limitations were observed during these controls:

- Repeated `package P` declarations across files make `expose P::a` return an empty rendering with a notice that it does not resolve, despite strict parsing without error diagnostics. This revision does not change exposure/import resolution. The split-namespace control therefore additionally walks the real parsed symbols and directly exercises the metadata resolver for `a` and `b`. Both relevant targets are unsupported because their endpoint paths are unresolved. This is **source-scope safety coverage, not successful rendering coverage**.
- A qualified redefinition inside an owning definition can produce no `ChainTargetPath` despite no error diagnostics. The independent-member control explicitly requires unsupported for that relevant unresolved scope, including its right sibling, rather than pretending the engine proved the sibling unaffected. The separate `P::b` remains available. This explains a conservative limitation rather than establishing generalized valuation semantics.

The original bridge/no-metadata [baseline-final.log](../../sandbox/source-values/engine-revision/baseline-final.log) fails with `missing source metadata for P::a/number`, exit 1. Three behavioral negative controls also fail at their intended assertions, each exit 1:

- [external-negative-final.log](../../sandbox/source-values/engine-revision/external-negative-final.log): bypassing the external-effect guard restores the wrong available default in both reviewer examples.
- [context-negative-final.log](../../sandbox/source-values/engine-revision/context-negative-final.log): ignoring an internal qualified provider returns `12.50` where the exact `301` provider is required.
- [provider-negative-final.log](../../sandbox/source-values/engine-revision/provider-negative-final.log): substituting the selected subject for an inherited provider fails expression/provider byte containment.

`git apply --check` passes for the revised patch. `node --check` passes for its private preparation script. Neither command applies the patch or prepares assets. Initial private broadened tests failed because they assumed split-namespace exposure worked and that an independently selected member's path resolved; their retained logs show the actual limitations. The final tests assert these uncertainties explicitly and retain unaffected-occurrence controls, rather than omitting the cases or claiming a rendered result that did not occur.

## Reproduction

From the editor repository:

```bash
sandbox/source-values/engine-revision/run-tests.sh review-red \
  > sandbox/source-values/engine-revision/review-red-final.log 2>&1
# Expected exit 1 against the original candidate.
sandbox/source-values/engine-revision/run-tests.sh full \
  > sandbox/source-values/engine-revision/full-final.log 2>&1
# Expected exit 0 for revised combined + engine suites.
sandbox/source-values/engine-revision/run-tests.sh baseline \
  > sandbox/source-values/engine-revision/baseline-final.log 2>&1
sandbox/source-values/engine-revision/run-tests.sh external-negative \
  > sandbox/source-values/engine-revision/external-negative-final.log 2>&1
sandbox/source-values/engine-revision/run-tests.sh context-negative \
  > sandbox/source-values/engine-revision/context-negative-final.log 2>&1
sandbox/source-values/engine-revision/run-tests.sh provider-negative \
  > sandbox/source-values/engine-revision/provider-negative-final.log 2>&1
# Baseline and each negative control must exit 1 at their expected assertion.
python3 sandbox/source-values/engine-revision/make-patch.py
git apply --check sandbox/source-values/engine-revision/candidate.patch
node --check sandbox/source-values/engine-revision/prepare-opensysml.mjs
```

The runner verifies Go 1.27.3, uses pinned OpenSysML 0.12.0 source under `sandbox/opensysml-012/source`, private `GOCACHE`, the existing module cache, `GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, and `-mod=readonly -overlay ... -count=1`. No canonical source or module metadata was modified. Overlay paths are absolute and must be regenerated when moved.

The make-patch script regenerates the patch and original context/provider mutation sources. The retained external-negative mutation file and corresponding overlay already match the final source. Its sole mutation replaces the external-guard condition with false while retaining a compilable branch; it is never included in the production patch.

## Remaining limits and integration seam

This closes the demonstrated external-scope false-default hole by explicit uncertainty, not a complete binding/default precedence implementation. External assignment provenance, binding-derived values, unresolved engine paths, library constraints and broad implicit precedence remain outside available-value support. Conservative same-scope unsupported outcomes should be visible in inspection. Exact binding/assignment declaration text in the reason is not a structured relationship API.

The parent must still independently review this revision, deliberately apply it, prepare the pinned engine/provenance, and verify TypeBox publication, real browser values, selection, drafts, saved geometry/reopen, readability and visual quality. No large-model performance measurement was run. The source-effect inventory is once per normalization, but per-attribute matching still depends on authored effect count and semantic queries; the original ADCS assembly/stakeholder models remain necessary acceptance inputs.

Only the new private revision directory and this new research note were written. No shared Go or TypeScript files, existing reports, assets, pins, dependencies, build/server/browser processes, commits, pushes or remote services were changed. No subagents were started.
