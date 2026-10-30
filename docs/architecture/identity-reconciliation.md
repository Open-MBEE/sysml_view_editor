# Identity across source revisions

Investigation recorded 2026-10-26; implementation policy updated 2026-10-29. The original comparisons below establish the identity hazards and bounded rename join. Production preservation now uses that evidence for reviewed commands and a conservative policy for free-form source edits; actual checks are recorded in [verification](../verification.md).

## Findings

No currently exposed identifier is a persistent cross-revision identity. An unchanged renderer symbol, declaration span and usage-context path can all identify a different usage after a source edit. Qualified names also change on rename and can be reused by replacement declarations.

There is a viable bounded path for verified renames: Toolkit supplies actual edit splices and changed interchange IDs. Replaying the splices against the exact old UTF-8 sources reproduces the worker's returned sources. Transporting recorded OpenSysML declaration spans and every ancestor context through those verified name edits identifies unique counterparts in both assembly views, including repeated inherited ports. The probe checks model rename postconditions as well. The original experiment proves its tested rename. The implementation policy below defines the production subset; it does not establish persistent identity for arbitrary text replacement.

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

The transported matches include every node, inherited port and connection correspondence in both views. They do not rely on `n2` retaining its spelling or on a port label being unique. This establishes the bounded join for this verified definition rename. Candidate construction uses verified splices and OpenSysML origins; it does not equate Toolkit UUIDs to origin IDs. At investigation time the adapter returned neither field. It now carries source-bound splices and creation-owner extents; Toolkit UUID maps remain SDK evidence, not cross-engine persistent IDs.

## Implemented preservation policy

The [transformation result](../../src/lib/workspace/editing/evidence.ts) carries complete sources, normalized before/after digests, filename-keyed UTF-8 splices and optional creation-owner extent. The workspace clones and validates the transport, verifies membership and exact byte replay, rejects overlapping/out-of-bounds or split-code-point edits, and normalizes document field order before binding the published digest. Creation must stay within its recorded owner; promotion of only its terminal semicolon is allowed.

The [reconciliation module](../../src/lib/workspace/views/reconciliation.ts) evaluates old/new artifacts separately for every saved view, including inactive views. Saved source/model hashes must match the old applied snapshot. A match requires the transported declaration origin, complete context, expected qualified name, unchanged kind and compatible owner/resolved type bindings. Rename uses the command's explicit target-prefix remapping; it never joins by a display label or reused `n2` ID. Matches must be unique in both directions, and matched node parents must correspond. Only matched artifact nodes retain positions; port/connection correspondences establish identity without becoming saved geometry.

Free-form drafts use one conservative replacement interval per changed file, derived from common Unicode prefix/suffix text and expressed in UTF-8 bytes. For this path, a declaration's recorded header through its name must remain outside every change. Partial span overlaps, missing origins, duplicate correspondence, changed ownership/types and uncertain ancestor paths invalidate affected mappings. Whole-file rewrites can therefore lose more layout than a verified rename. This policy supports bounded unchanged-header edits, Unicode prefixes and unrelated-file edits; it does not infer persistent identity from equal names, spans or text.

Mapped presentations are prepared with the semantic candidate, then published atomically on acceptance. Draft editing and symbol movement invalidate issued proposals, including edit/revert and move/revert sequences. Malformed edit evidence or failed semantic postconditions preserve the applied source/model/layout/history. An unavailable or ambiguous view mapping is reported in the source review and invalidates only that view's unsafe positions; valid source can still be accepted. Source application reports invalidated positions in workspace status. Undo/redo restore accepted project/model snapshots with their presentations.

The version-1 bundle shape is unchanged. It stores sources/drafts/compatible positions, while edit evidence and origin joins remain transient. Fresh import reparses source and restores only hash-compatible positions. New symbols receive deterministic automatic layout until moved; existing renderer bounds checks may arrange incompatible coordinates again with a notice. Manual overlap avoidance, interactive parent resizing, file-moving controls and general persistent identity remain outside this implementation.

The [structural authoring contract](graphical-authoring.md) describes part and connection commands built on this path. The [roadmap](../next-steps.md) distinguishes delivered slices from remaining notation, language-assistance and recovery work.

## Reproduction and evidence

Use the repository's pinned Node/npm and prepared engines:

```sh
npm run test:e2e -- --project=functional identity.spec.ts --max-failures=1 --output sandbox/playwright/identity-results --reporter=list
```

Playwright builds current production assets before starting its isolated preview server. The investigation writes full input documents, normalized models, both per-source-set evaluations and generated engine provenance as JSON under `sandbox/playwright/identity-results/identity-investigates-*/`. The second scenario retains `toolkit-rename-report.json` and `verified-rename-candidates.json` under `sandbox/playwright/identity-results/identity-inspects-*/`. Those files are also Playwright attachments. Re-running that command replaces its output directory.

The original investigation scenarios are local Chromium worker/SDK contract checks. Separate [preservation](../../tests/e2e/preservation.spec.ts) and [authoring](../../tests/e2e/authoring.spec.ts) browser scenarios now check actual accepted source, identities, serialized positions and rendered coordinates through undo/redo and fresh import. They do not establish hosted CI, other browsers, complete accessibility, performance at scale or arbitrary source reconciliation.
