# Independent review of revised source-value scopes

Recorded 2026-11-11. Reviewed the private [outer-scope revision](source-values-engine-revision.md), not an integrated bridge or rebuilt worker. The reviewed patch/source hashes are retained in [reviewed-sha256.txt](../../sandbox/source-values/engine-revision-review/reviewed-sha256.txt). Production files, shared assets and parent frontend work were not changed.

## P2: a usage-local binding leaks into its independently exposed definition

The revision repairs the original missed outer namespace assignments/bindings, but its unconditional path comparison at private `source_values.go:337` can invent an occurrence context from the target declaration's lexical owner. A relative binding end resolved to an inherited declaration consequently matches the separately exposed definition itself.

The retained strict-parse model has no error diagnostics and a complete interconnection rendering:

```sysml
package P {
    private import ScalarValues::*;
    part def Base { attribute number : Real default = 12.50; }
    part a : Base {
        attribute replacement : Real = 99;
        bind number = replacement;
    }
    part b : Base;
}
package V {
    view structure : StandardViewDefinitions::InterconnectionView {
        expose P::Base;
        expose P::a;
        expose P::b;
    }
}
```

`ConnectorEndFeaturePaths` returns `[P::Base::number]` for the first end of the binding owned by `P::a`. `sourceLexicalPath(path)` prefixes `P::Base`, which then matches the definition's `[Base, number]` occurrence. The definition's own declared default becomes **unsupported**, citing the binding inside `a`. `a` is appropriately unsupported and parallel `b` retains `12.50`; the defect is the unsupported state leaking back into the source definition. The independently exposed definition should retain its declared default rather than be described as affected by an unrelated usage-local binding.

`TestRevisionReviewLocalBindingDoesNotAffectDefinition` fails at that exact assertion in [review-final.log](../../sandbox/source-values/engine-revision-review/review-final.log). The final broadened [spelling-ast-final.log](../../sandbox/source-values/engine-revision-review/spelling-ast-final.log) retains the same failure with additional path/source-form probes. The reproduction test is [review_test.go](../../sandbox/source-values/engine-revision-review/review_test.go). This is a source-provenance/display-availability failure, not an evaluated numeric result or graph mutation.

Repair relative paths using their binding/assignment source scope and semantic membership, preserving renderer contexts. Do not blindly prepend that scope to every path: an explicit external target must remain external. The parent is addressing the repair separately; this review does not claim that an untested parent edit resolves it.

## Qualification boundary and source-bound AST seam

Three valid spellings inside `a` were additionally parsed with zero diagnostics and rendered completely:

| Written binding end | Semantic feature path     |
| ------------------- | ------------------------- |
| `number`            | `[P::Base::number]`       |
| `P::Base::number`   | `[P::Base::number]`       |
| `P::b.number`       | `[P::b, P::Base::number]` |

Thus the feature path alone loses namespace qualification. The explicit external `P::b.number` control currently marks `b` unsupported and keeps the definition available; a repair must retain that safety outcome. The probe is `TestRevisionReviewQualifiedEndSpelling` in the final log. It records the observed API distinction, not a normative adjudication of every qualified feature-reference spelling.

The source AST retains more information without regex: `Model.ConnectorObjectEnds(binding)[i].Attachment` exposes the attachment node. `ast.QualifiedName` retains `Global` and `Parts`; `ast.FeatureReference.Name` and `ast.FeatureChainExpr.Operand` preserve qualified heads and chains. The final log records direct qualified-name parts as well as feature-chain AST dumps. `ast.Dump` alone prints only the generic type for a bare `QualifiedName`, so the probe explicitly inspects its fields. Aliases and unresolved paths still require semantic identity/uncertainty handling; source spelling alone is not a provider resolver.

## Other checks

Seven foreign-scope controls pass: aliases to a usage and namespace, imported names, an explicit qualified binding inside another definition, alias-based qualified redefinitions, namespace-alias redefinitions and imported redefinitions. Each requires the targeted `P::a` to be unsupported and untouched `P::b` to retain its available `12.50`. They have no error diagnostics; the alias-to-usage cases retain non-error diagnostic entries and are not described as warning-free. These controls establish the tested paths, not exhaustive safety for all unknown foreign or alias scopes.

Independently reran the revised candidate's complete original combined and engine packages, excluding the added review file: both pass in [full.log](../../sandbox/source-values/engine-revision-review/full.log), reported times 3.787 s and 1.098 s. This includes the original reviewer counterexamples and the revision's outer-scope controls. Passing those suites does not cover the newly failing independently exposed definition control.

A P3 cleanup remains in private `source_values_test.go:39–40`: the local `attribute.Context` field's struct tag contains a stray quoted semantic import path after the valid `json:"context"` part. Remove that accidental line. The leading JSON key still decodes in these runs; this review does not claim it invalidates the retained context assertions.

The additive golden exclusion still removes only `sourceAttribute` and `sourceAttributes`; no new confirmed identity or endpoint weakening was found. Library constraint/default precedence and unresolved source paths remain bounded limitations. No performance defect is claimed: this review did not benchmark large models. Browser values, transport publication, source navigation, saved positions, preparation provenance and visual acceptance remain parent-owned and were not exercised here.

## Reproduction and work performed

```bash
sandbox/source-values/engine-revision-review/run-review.sh \
  > sandbox/source-values/engine-revision-review/spelling-ast-final.log 2>&1
# Expected exit 1: the independently exposed definition assertion fails.
```

The runner uses pinned Go 1.27.3, OpenSysML 0.12.0 canonical source, offline module cache, `-mod=readonly`, its own GOCACHE and a private overlay that reads the unchanged candidate and adds only the review test. The full-suite command uses the original revision overlay with the review's private cache; its exact output is retained above. No canonical source or module metadata was edited.

Read repository/engine instructions, the original review, agreed contract, revision report, complete revised source and relevant semantic/AST APIs. Wrote only the new [engine-revision-review scratch directory](../../sandbox/source-values/engine-revision-review/) and this note. No production edits, shared preparation/builds, browser/server work, dependency changes, commits, pushes, remote operations or subagents ran.
