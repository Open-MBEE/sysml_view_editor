# November stabilization review

Recorded 2026-11-23 against `develop` at `88e3bc7`. This review covers existing features, open PRs and reported bugs. New case renderers, stakeholder diagrams, calculation-dependency views and adding files to an open project remain separately scoped features. Local results do not establish a merge or deployment.

## PR dispositions

Independent standards and specification reviews found no implementation findings in the six PR diffs. Local integration applies the five develop-targeted diffs without changing their intended scope.

| PR                                                            | Scope                                                           | Disposition                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#48](https://github.com/Open-MBEE/sysml_view_editor/pull/48) | Existing React Flow dependency patch and its transitive patches | Locally integrated for full-suite verification; no manifest or engine changes.                                                                                                                                                                           |
| [#49](https://github.com/Open-MBEE/sysml_view_editor/pull/49) | Reference-list click callbacks                                  | Locally integrated. Direct props preserve navigation and stale-reference rejection while respecting React's Effect Event calling restriction.                                                                                                            |
| [#50](https://github.com/Open-MBEE/sysml_view_editor/pull/50) | Unused session wrapper                                          | Locally integrated; no callers found.                                                                                                                                                                                                                    |
| [#51](https://github.com/Open-MBEE/sysml_view_editor/pull/51) | Unused document exports/types                                   | Locally integrated; internal validation and owning schemas remain.                                                                                                                                                                                       |
| [#52](https://github.com/Open-MBEE/sysml_view_editor/pull/52) | Unused diagram-slot rules                                       | Locally integrated; no matching markup found.                                                                                                                                                                                                            |
| [#4](https://github.com/Open-MBEE/sysml_view_editor/pull/4)   | Main-branch CI bootstrap                                        | Still applicable to `main`, which only has the main push trigger. Before merge, align the proposed triggers with the current Git workflow: main, release and hotfix, without duplicate develop push validation. Requires the normal code-owner approval. |

The broader local run additionally reproduced an existing exploration fixture failure: it asked to collapse Explorer after responsive auto-collapse. Establishing the intended closed-tool state at desktop width before resizing fixes the test while retaining its exact scope/kind/fit assertions; the focused corrected case passes. No product behavior was changed for this failure.

The failing historical checks on #48 and #49 stopped at the old raw audit step. Neither run established a browser failure on its PR head. They still need current hosted checks after any branch synchronization.

GitHub [withdrew GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) on 2026-11-18 because it was not a security issue. Production and development-inclusive audits now return zero findings. The local change removes the expiring waiver and its exception-specific tests; the audit gate rejects all findings and retains malformed/transport-error controls. No vulnerability-fix claim is made for a dependency update.

### Standards

No documented-standard violations or applicable code-smell findings were found in the six reviewed PR diffs.

### Specification

No missing requirements, scope creep or incorrect implementation was found against the six PR descriptions. This is distinct from the current workflow-policy alignment recommended for #4 above. Total findings: Standards 0; Specification 0.

## CubeSat timeout report

Reported behavior: applying 104,785 characters times out at 60 seconds twice; a prose-trimmed 58,023-character version applies in under 20 seconds. The reported Toolkit element count is 12,805 for both. The exact trimmed input, browser and served artifact at the time of the report have not been identified. Rohan indicated that the reporter mostly uses a Mac, but could not confirm the test browser, device or date.

The local replay uses the three reported source files at revision `924e253c`, joined with a single newline between files. This produces exactly 104,785 JavaScript characters. Input content and downloaded bundles stay under ignored `sandbox/stabilization/`; no model content is embedded in this review.

Observed locally:

- Current pinned browser worker parses the full source in about 1.2 seconds with no diagnostics and 493 editor snapshot declarations. Snapshot declaration counts and Toolkit element counts measure different things.
- Full app Apply from a one-file seed succeeds in about 2.9 seconds. The downloaded applied source matches the complete input exactly.
- A second full app run with concurrent suite load applies in about 4.4 seconds, reads requirements and the matrix, and preserves exact source through Undo/Redo and download. The table contains 40 rows: 13 definitions and 27 usages; the matrix reports three linked elements. This is not a claim that every relationship was independently audited.
- The currently hosted provenance uses the same upstream commit `760c4d1fc8edfa4e214423099065c0a7c1b24e2d` but a different overlay/binary. The hosted worker and binary, downloaded and executed locally, parse the same full source in about 1.4 seconds without diagnostics. This is a hosted-artifact replay, not a test of the hosted application's complete Apply workflow or the reporter's device.

The reported timeout has not reproduced in these paths. There is no demonstrated source-size threshold or justified timeout change. Retain the 60-second bound until an exact failing workflow and environment are available. Next reproduction should include the same previously applied project/layouts, selected view, browser/device, and deployment identity; compare the reporter's exact trimmed input only after acquiring it. Do not remove documentation from applied source as a workaround in the application.

## Existing issue reconciliation

| Issues                                                                                                                           | Evidence and next disposition                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#30](https://github.com/Open-MBEE/sysml_view_editor/issues/30)                                                                  | Readable entry scale, Fit and 100% controls landed in #38. Recheck the exact large stakeholder/interconnection examples before calling the report resolved.                                                                                                                                                                                                                                                |
| [#31](https://github.com/Open-MBEE/sysml_view_editor/issues/31), [#32](https://github.com/Open-MBEE/sysml_view_editor/issues/32) | #45–47 implemented pane-local controls, explicit arrangement labels and responsive Explorer/chrome. Existing regression coverage establishes bounded desktop/narrow behavior; closure should cite the applicable acceptance criteria rather than the presence of the guide.                                                                                                                                |
| [#33](https://github.com/Open-MBEE/sysml_view_editor/issues/33)                                                                  | Existing inspection regressions cover hidden Inspector reveal and table selection without automatic source navigation. A separate replay of the full reported CubeSat source also opens the exact metrics, stakeholders and assembly view identities without page errors or source changes. This establishes current navigation for that replay, not the cause of the original delayed/failed interaction. |
| [#34](https://github.com/Open-MBEE/sysml_view_editor/issues/34)                                                                  | Source/Model header work separates draft state, representation and busy status. The original transient report still needs exact reproduction; do not equate a passing controlled status test with reproducing that report.                                                                                                                                                                                 |
| [#19](https://github.com/Open-MBEE/sysml_view_editor/issues/19)                                                                  | The original minimal comparison is reproduced and explained by native graph selection versus containment expansion. A real-engine browser regression checks exact selected/rendered declarations and draft preservation; see the bounded assessment below. No membership resolver change is justified by this fixture.                                                                                     |
| [#21](https://github.com/Open-MBEE/sysml_view_editor/issues/21), [#22](https://github.com/Open-MBEE/sysml_view_editor/issues/22) | Current pinned WASM still rejects the original duplicate-name forms and accepts explicit reference/redefinition controls. See the naming assessment below. Track incomplete diagnostics separately from whether rejection is valid.                                                                                                                                                                        |
| [#20](https://github.com/Open-MBEE/sysml_view_editor/issues/20)                                                                  | GitHub currently marks this completed, but its latest investigation comment and retained research explicitly identify an unresolved intermediate-import defect. Reconcile that status; do not infer a safe resolver fix from closure.                                                                                                                                                                      |
| [#35](https://github.com/Open-MBEE/sysml_view_editor/issues/35)                                                                  | Its implementation summary still describes merged #37 as pending and closed #20/#24 as open. Reconcile those historical statements while preserving the unresolved resolver caveat above. This review prepares the corrections; it does not post comments or change GitHub issue states.                                                                                                                   |

Feature requests #16, #17, #25–29 remain outside this stabilization pass. Closed #24's authored-value work does not imply those broader capabilities are implemented.

## GeneralView filter and expansion

The retained `tests/fixtures/general-view-filter-scope.sysml` and `tests/e2e/view-filter-scope.spec.ts` isolate #19's example without importing the private case model. All four views use the same applied declarations:

| View                                              | Semantic exposure | Native artifact | Rendered declarations |
| ------------------------------------------------- | ----------------- | --------------- | --------------------- |
| PartDefinition filter                             | Sat               | definition      | Sat                   |
| No filter                                         | Sat               | tree            | Sat, a, b, c          |
| PartDefinition or PartUsage filter                | Sat               | definition      | Sat                   |
| Same filter, explicit Sat and Sat member exposure | Sat, a, b, c      | definition      | Sat, a, b, c          |

The [pinned engine's `generalSpecialization`](https://github.com/Open-MBEE/OpenSysML/blob/760c4d1fc8edfa4e214423099065c0a7c1b24e2d/internal/ir/view/general.go) explicitly selects graph families from supported metaclass filters and leaves unfiltered views as containment trees. This is native rendering policy, not a conclusion that SysML mandates this visual expansion. Exact worker correspondence confirms each declaration; source and unapplied drafts remain unchanged while switching views. The regression passes against the real browser worker. Deliberately removing the first view's classification filter makes its artifact-kind assertion fail (definition expected, tree received); restoring the fixture passes again. This explains the original minimal report; it does not resolve #20's separate import-admission defect or establish every filter/renderer combination.

## Verification naming assessment

The existing standards investigation and the current four-case pinned-WASM replay agree on the bounded cases: qualification does not give an unnamed verification member a unique effective name; both `c1.r1` and `c2.r1` derive `r1`. Specializing an objective does not make an ordinary added member explicitly redefine an inherited `r1`.

Reference-preserving forms accepted by the current pinned engine include:

```sysml
verification ev : W {
    objective {
        verify requirement leftEvidence ::> c1.r1;
        verify requirement rightEvidence ::> c2.r1;
    }
}
verification ev2 : V {
    objective { verify requirement local :>> r1 ::> c1.r1; }
}
```

These snippets assume the surrounding definitions from the minimal issue fixtures. Acceptance is bounded engine evidence, not full conformance or executed verification. Do not substitute ordinary `:>` for `::>`: subsetting and reference subsetting have different target semantics.

Primary basis inspected in the pinned official corpus: [SysML v2.0 Part 1](https://www.omg.org/spec/SysML/2.0/Language/PDF) §8.3.20.4 (ConstraintUsage naming feature), §8.3.21.7 (referenced constraint), RequirementUsage objective redefinition, and §8.3.24.2 (verification membership); [KerML v1.0](https://www.omg.org/spec/KerML/1.0/PDF) Feature effective-name derivation and Type inherited memberships with redefined features removed. The retained prior assessment additionally reports a recorded-reflection problem for ordinary subsetting; that earlier evidence was not rerun here and is not a deployed-fix claim.

Diagnostics remain incomplete: #21 still ends with an empty `from ` owner and #22 does not identify the conflicting owned member. Recommended disposition: treat the original rejection as expected for these minimal forms and retain a focused diagnostic-quality follow-up. A diagnostic fix must preserve rejection/code/severity and distinguish anonymous owners by source-backed context. No validation relaxation or upstream resolver/diagnostic fix is integrated in this pass.

## Verification evidence

Local logs, input copies and replay harnesses are ignored under `sandbox/stabilization/`; they may be absent in another checkout. Suite outcomes are recorded in [verification](../verification.md): 187 unit tests and 12 script tests pass; all 110 normal visual comparisons pass; all 148 current functional scenarios are covered by 146 full-run passes plus the corrected exploration case and new regression passing a fresh-build run. The original full run retains its one stale-fixture failure; the complete functional suite was not rerun after that test-only correction. No issues or PRs have been closed by this local review, and no commit, push or deployment is implied.
