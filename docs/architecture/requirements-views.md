# Requirements and satisfaction diagrams

Planned session, 2026-11-03, on `feature/requirements-traceability`. This is an implementation plan, not a capability claim. Agreed scope: requirements, their hierarchy and declared satisfaction relationships. Start read-only for model semantics; presentation movement and source navigation are permitted.

## User outcome

Open the requirements example or the compressor project, choose an appropriate authored view, and understand:

- Which requirement definitions and usages are shown, including available declared identifiers, names and documentation.
- Which requirements contain other requirements, independently of definition/usage typing.
- Which exact model elements have declared, resolved satisfaction relationships to those requirements.
- Where each element and relationship is declared in source, including repeated usages with distinct context.

A satisfaction declaration is not proof that a requirement is met. Do not display pass/fail, verified status or global coverage percentages. An absent visible link means no satisfaction link is shown in this scope; it does not establish that the whole model has no satisfier.

## Starting evidence and gates

`Diagram.tsx` currently accepts only tree, interconnection and definition artifacts. The capacity requirements fixture is catalogued as a native `requirement` artifact with `MinimumCapacity`, `usableCapacity` and `storage` nodes plus `typing`/`satisfy` edges, but the app has no renderer for it. The compressor requirements view is a partial `tree` projection. Confirm both through fresh actual-worker captures; do not assume that every requirement-bearing view has the same artifact kind.

The retained `engine-bridge/opensysml/relationships.go` implements `EvaluateRelationships` for resolved allocation, satisfaction and verification endpoints, including declaration/source/target origins. Its retained Go tests cover aliases, cross-file endpoints, deterministic results and refusal of invalid/incomplete evidence. This code is a useful seam, not fresh execution evidence for this session. The browser semantic worker currently exposes parse and named-view evaluation only.

The current artifact node schema does not explicitly transport requirement identifiers, documentation or constraints. Native renderer code already supplies a `detail` field combining a short identifier and bounded documentation excerpt, but the TypeScript schema does not type it. Confirm its actual bytes and omissions before choosing separate metadata fields. Prefer the existing `EvaluateView` artifact when it supplies sufficient evidence; expose `EvaluateRelationships` in the browser only if a demonstrated gap requires it. Do not recover relationships or identities with source regexes, infer links from labels, or equate a declared subject with a satisfaction assertion.

Preserve authored view exposure and filters. The capacity view filters for requirements but its recorded native graph includes `storage`; compare selected membership, artifact nodes and correspondence to understand engine-provided related context. Do not assume all artifact nodes are directly exposed, hide native context without explanation, or synthesize additional nodes ourselves. For truly absent endpoints, show explicitly outside-view context or use a deliberately authored traceability view exposing both endpoint families. Never inject hidden view declarations.

## Session checkpoints

Each checkpoint must leave a reviewable, working subset. Record actual commands, outcomes and gaps in verification; keep transient traces under ignored `sandbox/`.

| Checkpoint                        | Deliverable                                                                                                                                                             | Completion gate                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Prove the engine contract      | Retained captures from the actual pinned browser workers for capacity and compressor requirements, resolved satisfaction, nested ownership, aliases and repeated usages | Exact endpoints, origins and complete/invalid/indeterminate states are demonstrated. Identify how view exposure/filter membership and requirement metadata are obtained. Stop the renderer design from assuming missing evidence.                                                                     |
| 2. Define the projection boundary | Owning TypeBox schemas, normalized requirement data and relationship correspondence; browser transport for the proven read-only operation                               | Workspace stays independent of React, DOM and engine implementations. Replies bind to the applied revision; malformed, stale, cancelled and partial results cannot replace valid state. Preserve engine pins, checksums and provenance.                                                               |
| 3. Render requirements            | Dedicated requirement cards and hierarchy/typing notation for the bounded fixture set                                                                                   | Definition versus usage, containment versus typing, identifiers, names and available documentation are distinguishable. Missing metadata has an honest fallback. Existing diagram families still render correctly.                                                                                    |
| 4. Add satisfaction traceability  | Declared satisfaction edges with exact endpoint identity and declaration reveal                                                                                         | Direction and labels follow verified engine evidence. Several satisfiers, several requirements and repeated usage names are unambiguous. Hidden endpoints are explained rather than silently dropped or invented.                                                                                     |
| 5. Make browsing usable           | Selection, Inspector details, source reveal, keyboard navigation, fit/zoom and bounded layout movement                                                                  | Browsing changes no source, drafts or semantic history. Switching views/files retains the intended context. Labels and edges remain usable at desktop and narrow widths in light/dark.                                                                                                                |
| 6. Verify persistence and failure | Exact save/reopen and compatible geometry; deliberate failure and stale-response scenarios                                                                              | Existing named-view positions are not borrowed for another representation. Preserve version-1 compatibility where possible; any saved-format change requires an explicit schema/version decision and compatibility fixtures before implementation. Rejected work retains the live project and drafts. |
| 7. Review and integrate           | Updated example catalog, capabilities, owning contracts, screenshots and PR to develop                                                                                  | Fast checks, fresh production build, focused real-engine regressions and full visual project pass. Inspect intentional baseline changes. Hosted CI is reported separately. Keep manual deployment as a separate authorized step.                                                                      |

Suggested atomic commit boundaries are engine evidence/bridge, validated projection, renderer, satisfaction interactions, preservation regressions and documentation. Combine boundaries when splitting would leave broken transport or callers. Do not publish placeholder UI for an unproven contract.

## Subagents and worktrees

Use one coordinator/integration checkout and three bounded coding worktrees. The current checkout holds uncommitted planning edits; this planning step does not commit, push or create coding worktrees. Before implementation, establish an authorized committed planning baseline. After the engine evidence gate, the coordinator publishes the smallest compiling contract checkpoint, and all implementation branches start from that exact commit rather than an independently advancing `develop`.

| Owner              | Branch / sibling worktree suffix                           | Exclusive implementation ownership                                                                                                                                                                                                                             |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordinator        | `feature/requirements-traceability` / primary checkout     | Owning workspace schemas/validation/reconciliation, shared worker request schema, `Diagram.tsx` dispatch and node/edge selection, Workbench/Inspector integration, `ui/theme.css`, shared test helpers, persistence decisions and capability/architecture docs |
| Engine agent       | `feature/requirements-engine` / `-requirements-engine`     | Retained OpenSysML bridge overlays and their Go tests, `engines/opensysml/` adapter/worker changes, engine preparation/provenance updates only when necessary, engine-specific probe fixtures/captures                                                         |
| Renderer agent     | `feature/requirements-renderer` / `-requirements-renderer` | New `RequirementNode.tsx`, `RequirementEdge.tsx` only if needed, `requirements.ts`, `requirements.test.ts`, and `ui/requirements.css`; no edits to the shared shell or contract                                                                                |
| Fixture/test agent | `test/requirements-diagrams` / `-requirements-tests`       | New `examples/requirements-traceability/` fixtures, `tests/e2e/requirements.spec.ts`, `requirements-support.ts`, requirements additions to `visual.spec.ts` and new snapshots, example catalog/index updates after real captures                               |

Planning audits may inspect the primary checkout read-only. Coding agents must edit only their assigned worktree and paths. Shared-file needs go to the coordinator; an agent must not widen ownership silently. The three older dirty language/recovery/editor-test worktrees are unrelated and remain untouched.

### Execution waves

1. **Evidence first.** Engine agent probes the existing capacity and compressor artifacts, native `detail`, selected versus contextual nodes, source correspondence, nested ownership versus native owner-to-type composition, repeated usages, and positive/negated satisfaction. Fixture agent prepares small model inputs and assertion inventories; renderer agent studies notation and dimensions. No UI assumptions are frozen from invented data.
2. **Contract checkpoint.** Coordinator resolves the returned evidence into the smallest validated artifact contract and shares its exact commit/schema. Agree on relation direction, source mapping, optional metadata, incomplete evidence and exposure/context handling. If negated satisfaction cannot be distinguished, do not display it as a positive satisfaction assertion.
3. **Parallel implementation.** Engine, renderer and test agents build their isolated slices against that contract. Controlled renderer/unit fixtures establish UI behavior only; they do not stand in for pinned-engine acceptance. Any changed contract is an explicit coordinator checkpoint that dependent branches consume before continuing.
4. **Integrate incrementally.** Coordinator reviews and integrates engine/contract changes first, renderer files next, then fixtures/tests, wiring shared selection and Inspector paths. Keep atomic compiling commits when commits are authorized. Preserve branch ancestry; no force pushes or overwriting another agent's changes.
5. **Regression and visual review.** Coordinator alone runs production browser builds, focused requirements/preservation checks and baseline generation/comparison. Agents can run isolated unit/type checks. Inspect all intentional screenshots and demonstrate important assertions failing under a bounded fault before restored passing runs.
6. **Close the session.** Update actual capabilities and verification, run the required shared-code regression scope, open one feature PR to `develop` and report hosted checks when push/PR work is authorized. Manual Vercel publication remains separate. Remove only clean merged coding worktrees after preserving their evidence and checking for unpublished work.

Each agent's handoff must state its base commit and contract version, files changed, executed commands/results, skipped coverage, artifacts, unresolved risks and its proposed integration commit(s). Do not claim successful conformance from a build or screenshot alone.

### Shared integration decisions

- Prefer rendering the proven native `requirement` artifact before inventing a new requirement extraction endpoint. Full requirement documentation may need additional engine evidence; a combined abbreviated `detail` string is not structured metadata.
- Ground exact relationship meanings and notation in the formal SysML v2 specification alongside pinned-engine evidence. The imported tutorial series supports the shared definition/usage mental model, not detailed satisfaction/use-case conformance.
- A native `composition` edge can connect an owner to a type while labeling an undrawn owned usage. Do not call that literal ownership of the drawn type; prove hierarchy through resolved membership and edge correspondence.
- Native edge correspondence uses `edge:<index>` while current generic rendered edges use `edge-<index>`. Align selectable identity and source correspondence in coordinator-owned code; never match edges by label.
- Requirement graphs need kind-aware topology validation, not only the existing interconnection validation. Reject duplicate IDs, dangling endpoints and unsupported/ambiguous correspondence without replacing a valid diagram.
- Keep requirement creation/satisfaction editing disabled. The broadly available New part action must not appear to author requirements.
- A tree-to-requirement representation change must not silently borrow incompatible positions. Keep absolute coordinate ownership in the existing presentation flow; any persistence change follows the project-format gate.
- Do not broaden diagram support by treating every tree containing a requirement as a full requirements projection. The compressor view needs its own evidence and an explicit delivered scope.

### Test/build coordination

Install dependencies from the committed lockfile per coding worktree using the selected Node runtime and context checks. Do not commit `node_modules`, link it as an untracked source file, or share mutable engine preparation outputs among concurrent builds. Keep each worktree's generated files in its own ignored `sandbox/` and `static/vendor/`.

The production browser test runner builds the current source and reserves port 4175. Run only one such build/test sequence at a time under the coordinator. The fixture/test agent is the sole writer of `visual.spec.ts` and its requirements snapshots; do not add a separate visual spec without changing project matching deliberately. Add one coherent `@critical` requirements workflow; extended failure cases stay in the full suite. Request Context7 documentation before library-dependent implementation, follow current shadcn conventions, and add no production dependencies without approval.

## Look and interaction

Reuse the current shadcn/Radix controls and theme tokens. Requirements should have a recognizable restrained header, a small definition/usage label, prominent declared identifier/name and readable documentation. Use compartments only for metadata actually supplied by the engine. Long text needs deliberate wrapping or an explicit expand action; it must not cover edges or handles.

Use separate visual treatments and text labels for containment, typing and satisfaction. Do not use color alone. Distinguish contextual satisfying model elements from requirements. Prefer a clear automatic layout and existing fit/zoom controls over introducing a general-purpose routing editor in this slice.

Selection should reveal requirement details or a relationship's declaration and resolved endpoints. Provide accessible names, visible keyboard focus and focus return for any dialog. Selection is transient; any future create/edit/delete/reconnect action needs the reviewed semantic transaction path.

## Fixtures and acceptance evidence

Follow the [example-library workflow](../../examples/README.md). Extend small independent fixtures deliberately rather than treating the large compressor model as the only proof.

- Capacity example: declared identifier, documentation, requirement definition/usage and the exact storage-to-capacity satisfaction relationship.
- Hierarchy fixture: nested requirement usages and typing, proving that ownership and typing do not collapse into one edge meaning.
- Traceability fixture: multiple requirements/satisfiers, identical display names under different owners, aliases and cross-file references, and negated satisfaction that must never be labeled positive. Author an explicit view exposing the intended nodes.
- Failure fixtures: unknown references, malformed/partial transport, engine asset failure, cancellation and superseded evaluation. Test valid empty relationships separately from unavailable evidence.
- Compressor integration: retain all nine source files, drafts, independent source/view choice and existing structural layouts while browsing its requirements.

For important new regressions, demonstrate failure under a bounded fault, restore the behavior and rerun. Assertions should establish exact semantic endpoint identity, source location and project preservation, not only node counts or screenshots. Add a focused critical real-engine path for the new supported workflow without promoting every extended matrix case into PR CI.

Run `npm run check`, `npm run build`, relevant functional browser scenarios and the full visual project. Inspect desktop/narrow and light/dark captures, keyboard access and any dialog focus containment/return. Full semantic regressions are required when shared projection, reconciliation or transaction behavior changes. No skipped assertion, relaxed mismatch threshold or automatic baseline update substitutes for diagnosing a failure.

## Deferred work

Verification-case diagrams and result ingestion, coverage dashboards, requirement/satisfaction graphical authoring, automatic declaration-free exploration, new general routing controls, matrices/tables and additional behavior diagram families are separate follow-ups. Verification declarations must never be presented as executed tests.

This plan does not promise complete SysML requirements notation or language conformance. If the first checkpoint cannot establish identifiers, hierarchy or satisfaction endpoints for a fixture, record the limitation and narrow the delivered subset explicitly rather than infer semantics.
