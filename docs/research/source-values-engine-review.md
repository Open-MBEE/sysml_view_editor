# Independent review of source-value bridge candidate

Recorded 2026-11-11. Reviewed the private [candidate and implementation claims](source-values-implementation.md), not an integrated engine change. Production bridge files and prepared assets were unchanged when tested. Parent frontend changes were preserved.

## Finding: P2 — outer source scopes are omitted from occurrence resolution

Do not integrate the candidate as-is. `source_values.go:214–249` examines only `owners` built from renderer correspondence contexts (`source_values.go:298–320`). Those contexts begin at the exposed/rendered root; they do not include every lexical namespace that can declare a qualified assignment or binding affecting that occurrence. `sourceBinding` also examines only each context owner and its `MemberSources` (`source_values.go:175–196`). Consequently the candidate can report an inherited default as **available** even when a known source declaration outside those scopes requires different provenance or an explicit unsupported result.

Two independently retained strict-parse examples reproduce the omission. In each, expose only `P::a` in an `InterconnectionView`:

```sysml
package P {
    private import ScalarValues::*;
    part def Base { attribute number : Real default = 12.50; }
    part a : Base;
    attribute replacement : Real = 99;
    bind a.number = replacement;
}
```

The model parses without error diagnostics and evaluates to a complete view. The candidate publishes `a`'s `number` as `status: available`, `expression: 12.50`, provider `P::Base::number`. Its own stated standalone-binding safety rule instead requires unsupported source-value precedence, with the binding source retained. This review does not evaluate the binding or claim an executed numeric result.

The second example replaces the last two lines with:

```sysml
attribute overrideNumber :>> a.number = 99;
```

This also passes strict parsing and complete view evaluation. A separate semantic probe resolves `ChainTargetPath` to exactly `[P::a, P::Base::number]`. The candidate nevertheless publishes `12.50` as available, rather than choosing the exact `99` expression/provider through a supported rule or declaring the external contextual assignment unsupported. The default's bytes are real; the defect is selection/completeness of its occurrence-specific provenance, not invented expression text.

Both counterexample assertions fail as intended in [outer-scope-final.log](../../sandbox/source-values/engine-review/outer-scope-final.log). Exact source and black-box assertions are in [review_test.go](../../sandbox/source-values/engine-review/review_test.go). Package time reported for both failing controls together: 0.134 s. Earlier `external-binding.log` and `outer-scope.log` retain the preceding probes; the final log additionally proves the resolved qualified target path.

Resolve source scopes separately from the renderer occurrence chain. Inspect relevant lexical/namespace declarations and resolve their semantic endpoint/target paths against the full selected occurrence, retaining original correspondence IDs and metadata contexts. A bounded repair can conservatively return unsupported when an affecting external assignment/binding is detected; it must not silently preserve the default as if the provider graph were complete. Do not match names or evaluate a binding to manufacture a value. Cover same-file, cross-file/split namespace, independently selected roots and nested occurrences, with a parallel untouched usage proving that assignments cannot leak between contexts.

## Other review results and limits

Independently reran the original candidate’s complete combined and engine Go suites with a private cache and without the additional failing review tests: both passed (reported package times 3.135 s and 0.268 s). [Retained output](../../sandbox/source-values/engine-review/candidate-full.log). Passing those suites does not cover the new counterexamples.

The implementation's raw-source slicing, expression containment, provider origin, flag and context checks are appropriate for the demonstrated supported cases. The candidate includes own, inherited and valueless redefinition paths, explicit nested/qualified contexts, ambiguity/cycle controls and unsupported missing-source paths. These observations do not override the concrete outer-scope failure above.

The #18 golden adjustment removes only the two additive keys `sourceAttribute` and `sourceAttributes`, recursively copying rather than mutating the actual envelope. Other source origins, IDs, graph nodes, endpoint fields, contexts and selected scope remain compared. The dedicated metadata regressions separately assert the new fields. No confirmed weakening beyond this documented additive exclusion was found.

Preparation adds both new Go files to the overlay digest and copies them into the engine package. No pin, dependency or saved-project field changes are present. Syntax alone is not a WASM/build/provenance check; the parent still owns deliberate preparation and browser verification.

Library constraint/default precedence remains outside demonstrated support, as the implementation report acknowledges. Large-model performance was not benchmarked: repeated per-attribute owner/member/redefinition scans deserve measurement on the original assembly/stakeholder sources, but no performance defect is claimed without a retained measurement. Browser rendering, TypeBox publication validation, stale UI results, source navigation, saved positions through fresh reopen and desktop/narrow visual acceptance were not tested by this review.

## Reproduction and actions

Read repository instructions, engine README, the assessment, agreed contract, candidate source/tests/patch and preparation mapping. Added only this report and isolated [engine-review](../../sandbox/source-values/engine-review/) scratch files/cache. The overlay refers to existing candidate files read-only and adds one virtual review test file. It never changes canonical source or the candidate itself.

```bash
sandbox/source-values/engine-review/run-review.sh counterexamples \
  > sandbox/source-values/engine-review/outer-scope-final.log 2>&1
# Expected exit 1, both missed outer-scope assertions.
sandbox/source-values/engine-review/run-review.sh candidate-full \
  > sandbox/source-values/engine-review/candidate-full.log 2>&1
# Original candidate suites, excluding the additional review controls.
```

These commands use the existing pinned Go 1.27.3 and OpenSysML 0.12.0 source, offline module cache, `-mod=readonly`, private `GOCACHE` and explicit overlays. No shared preparation, WASM build, browser, server, dependency install, commit, push or remote mutation ran.
