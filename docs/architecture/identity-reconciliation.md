# Identity across source revisions

Recorded 2026-10-26. This investigation compares the pinned browser engines before/after source changes and determines what evidence could support layout reconciliation. It covers the first two investigation tasks in the [development sequence](../next-steps.md); automatic position retention remains unimplemented.

## Findings

No currently exposed identifier is a persistent cross-revision identity. An unchanged renderer symbol, declaration span and usage-context path can all identify a different usage after a source edit. Qualified names also change on rename and can be reused by replacement declarations.

There is a viable bounded path for verified renames: Toolkit supplies actual edit splices and changed interchange IDs. Replaying the splices against the exact old UTF-8 sources reproduces the worker's returned sources. Transporting recorded OpenSysML declaration spans and every ancestor context through those verified name edits identifies unique counterparts in both assembly views, including repeated inherited ports. The probe checks model rename postconditions as well. This is evidence for the tested rename, not a general identity algorithm or application layout feature.

The [source-contract findings](engine-identity-sources.md) explain the distinct identity domains and cite the pinned engine sources. The retained [browser investigation](../../tests/e2e/identity.spec.ts) supplies runtime evidence with production worker bundles and the actual prepared WASM engines. It sends validated worker requests and validates model/evaluation replies; it does not substitute engine responses.

## Comparison matrix

The fixture starts with the unchanged two-file [assembly example](../../examples/assembly/model.sysml), plus an in-memory `notes.sysml` containing an unexposed marker and a derived part definition. Its two named views are evaluated separately for every source set. The original example files are not modified.

| Source set                                                  | Observed result                                                                                                           | Matching implication                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Baseline, then identical sources in fresh workers           | Entire normalized model and both evaluations agree exactly                                                                | Reproducibility for these pinned inputs; no claim of persistent identity across edits                 |
| Rename unexposed `Notes::Marker` in the separate notes file | Model hash changes; both view results are otherwise byte-equivalent JSON values                                           | This bounded unrelated edit leaves the evaluated correspondences intact                               |
| Toolkit renames definition `Device` → `ControllerDriver`    | Usage types and port qualified names update; traversal symbols stay the same while declaration origins and contexts shift | Rename lineage and translated source spans are needed; equal traversal symbols alone are insufficient |
| Toolkit renames usage `primary` → `activeDevice`            | The connection reference updates; its traversal symbol stays the same while qualified name, origin and contexts change    | A qualified-name join alone loses the renamed usage                                                   |
| Prepend a comment containing `λ` and `🔧`                   | Declaration offsets increase by the UTF-8 byte length, rather than JavaScript string length                               | Use the engine's byte offsets; translate ancestor origins too                                         |
| Swap equal-length `primary` and `standby` declarations      | The old primary's symbol, origin and context identify standby; primary receives the other traversal symbol                | Even the combined old identifier tuple can match the wrong usage                                      |
| Insert `auxiliary : Device` before primary                  | Primary retains its qualified name but receives a different traversal symbol                                              | Re-evaluate each view and resolve new symbol IDs                                                      |
| Rename source file to `assembly.sysml`                      | Qualified names remain; origins and contexts change filename                                                              | A file move needs explicit file/declaration mapping                                                   |
| Change primary's type to `Notes::SpareX`                    | Qualified name and traversal symbol remain; resolved type changes                                                         | A name match does not establish compatible bindings or presentation                                   |
| Move monitor from Station into bay                          | Its qualified owner and model ownership change                                                                            | Preserve owner/usage lineage explicitly; do not reuse the former context                              |

The baseline output port has one shared declaration origin but three occurrences in `structure` and two in `devices`. The test checks distinct symbols and full context values, then resolves each context's immediate owner to the intended primary, standby or monitor usage. The definition and usage renames repeat these checks with the new declaration/usage names.

For example, in `AssemblyViews::structure`, baseline primary is `n2`, its origin is `model.sysml@324:22`, and its context is `[model.sysml@274:230, model.sysml@301:162, model.sysml@324:22]`. Swapping primary and standby reuses that exact tuple for standby. This is a retained counterexample to matching by unchanged symbol/span/context strings.

## Toolkit evidence and the cross-engine join

The second browser scenario probes the prepared Toolkit SDK directly and compares its returned sources with the real transformation worker. It records `checkEdit`, `edit`, declaration UUIDs and ownership paths before/after the rename, then reparses and evaluates those sources through the OpenSysML production worker.

For the definition rename with a Unicode prefix:

- Preview and committed edit reports agree on splices and ID mappings, with no findings.
- Four name/reference splices replace exactly the UTF-8 bytes for `Device`. Applying them in descending offset order reproduces both returned source files exactly, including unchanged comments and view source.
- A splice's `unit` is a **filename string**, while `session.source()` takes the numeric unit handle returned by `session.units()`. These are different fields and must not be interchanged.
- The ID map contains four changed UUID pairs: the definition and its three ports. The separately queried primary/standby usage UUIDs remain unchanged in this case and are omitted from the map. Absence from the map alone is not a continuity guarantee.
- The queried qualified names resolve uniquely in both engine models. The complete normalized models pass the application's existing rename postconditions for declaration count, ownership and resolved types.
- Transporting each old declaration span, including every context ancestor span, through the exact verified splices yields one new correspondence per old entry in each view. The probe rejects partial-boundary overlaps, missing origins, nonunique candidates and reuse of a new symbol by two old symbols. Renamed qualified names are checked after the origin/context join.

The transported matches include every node, inherited port and connection correspondence in both views. They do not rely on `n2` retaining its spelling or on a port label being unique. This establishes the bounded join for this verified definition rename. Candidate construction uses verified splices and OpenSysML origins; it does not equate Toolkit UUIDs to origin IDs. The application currently returns neither the splices nor the ID map to the workspace.

## Policy supported by the evidence

For the next implementation, retain positions only when a source-bound edit establishes a unique before/after declaration and complete usage-context match, with compatible ownership and resolved types. Resolve the old and new artifact symbols independently in each named view. A shared inherited declaration alone must never transfer one usage's position to another.

For verified renames, extend the transformation result with validated edit evidence, bind it to the exact before/after sources, and reconcile evaluated artifacts before accepting the source transaction. The tested name-only splice transport is a candidate building block. It must fail closed for unsupported edits and unknown correspondence.

For arbitrary source drafts, unchanged names, spans and context strings are insufficient. The unrelated-file experiment establishes a useful fixture, but does not prove that every edit in another file leaves type resolution, imports, exposure and other dependencies unchanged. Define and verify a bounded preservation rule for unaffected declarations and dependency bindings before retaining those positions. Owner/file moves, replacements, added/deleted declarations and ambiguous matches need explicit treatment.

Automatic retention, position compatibility after reconciliation, transaction failure handling, undo/redo and fresh save/reopen are the next implementation and verification tasks. The current workspace continues to invalidate presentations on applied source changes and accepted semantic proposals; the project format is unchanged.

## Reproduction and evidence

Use the repository's pinned Node/npm and prepared engines:

```sh
npm run test:e2e -- --project=functional identity.spec.ts --max-failures=1 --output sandbox/playwright/identity-results --reporter=list
```

Playwright builds current production assets before starting its isolated preview server. The investigation writes full input documents, normalized models, both per-source-set evaluations and generated engine provenance as JSON under `sandbox/playwright/identity-results/identity-investigates-*/`. The second scenario retains `toolkit-rename-report.json` and `verified-rename-candidates.json` under `sandbox/playwright/identity-results/identity-inspects-*/`. Those files are also Playwright attachments. Re-running that command replaces its output directory.

These are local Chromium worker/SDK contract checks. Existing UI tests cover rename acceptance and save/reopen; the investigation adds no UI or layout-retention behavior and does not establish hosted CI, other browsers, complete accessibility, performance at scale or support for arbitrary source reconciliation.
