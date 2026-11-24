# Model-first workbench redesign: implementation assessment

Status: implemented and locally verified on `feature/model-first-workbench`, 2026-11-23. All three delivery phases are complete within the boundaries below. See [verification](../verification.md#model-first-workbench-redesign-local-branch) for actual checks and remaining coverage limits. No commit, push or deployment is implied. Visual reference: Stitch project https://stitch.google.com/projects/2382469832338618642 , variants 04 and 05a/05b. Brand authority: [DESIGN.md](DESIGN.md).

Use the mock for composition and styling, not its generated HTML or claims of working interactions. The reviewed 05b still contains thick dividers and “Workspace synced”; these are not requirements. Model shapes and connectors must remain derived from real engine artifacts, not the illustrative mock data.

## Target and relationship to earlier decisions

Preserve the existing Files / Views / Documents / Model Explorer. Default to Explorer plus model workspace. Independently open source on the right and inspection below the centre, with Properties / Relationships / Issues tabs. Add compact spatial toggles, focus mode, maximise/restore and browser-local layout preferences. Keep source-only access available for authoring and troubleshooting.

This refines the [November 16 product decisions](workbench-product-decisions.md): retain navigation/representation/arrangement/operation separation, pane-local commands, existing panel infrastructure and preservation guarantees. Proposed changes are the removal of the redundant activity rail, right source placement, bottom inspection, independent visibility instead of the current three-mode arrangement, and later workspace tabs. The old document remains historical; the current branch implements the replacement described here; verification is recorded separately.

## Baseline assessment before implementation

| Area                       | Baseline evidence                                                                                                                 | Required change                                                                                                                                                              | Relative scope                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Branding and appearance    | `ui/tokens.css`, `controls.css`, official SVGs and ABeeZee                                                                        | Reuse tokens; quieter chrome, card grouping and thinner visible separators                                                                                                   | Small                               |
| Explorer                   | `explorer/Explorer.tsx`, `ExplorerSection.tsx`, `ModelTree.tsx` already provide four sections and selection reveal                | Compact styling, remove duplicate rail, preserve keyboard tree and independent file/view selection                                                                           | Small                               |
| Panel shell                | `shell/WorkbenchPanels.tsx` already resizes/collapses mounted panels with inert hidden content and focus handling                 | Recompose centre+bottom inspection beside right source; independent toggles, focus/maximise restore and minimum sizes                                                        | Largest first-phase task            |
| Layout preferences         | `shell/layout.ts` validates strict version-1 browser-local preferences                                                            | New versioned layout schema with explicit migration/fallback; retain useful old sizes; distinguish temporary focus/maximise from saved normal layout                         | Medium                              |
| Selection and inspection   | `Workbench.tsx` increments `inspectionRequest` on symbol/tree selection; panel shell opens Inspector                              | Separate selection from explicit Inspect; adapt row/relationship/requirement callers without losing details or source mapping                                                | Medium                              |
| Inspection content         | `properties/Properties.tsx` already handles structural, requirement, relationship and source-value detail                         | Split shared information into Properties/Relationships without hiding specialised details; responsive horizontal bottom layout                                               | Medium                              |
| Source                     | `source/SourceEditor.tsx` uses CodeMirror and workspace drafts; source header owns Apply/Discard/history/language actions         | Move the existing editor intact; keep mounted through visibility changes; later file tabs must preserve per-file editor state                                                | Medium                              |
| Diagram camera             | `Diagram.tsx` currently resets automatic fitting when `layoutMode` changes; divider movement has separate preservation guarantees | Decouple layout visibility from diagram identity and fitting; preserve camera through toggle/focus/maximise; keep explicit Fit/read actions                                  | Medium, high regression sensitivity |
| Workspace tabs             | `Workbench.tsx` has one active file, representation, named view/exploration and rendered document                                 | Real tab identities, activation, close/fallback and revision-aware refresh; retain per-tab camera and per-file editor state; keep selection and table/document scroll shared | Large, separate phase               |
| Exploration and navigation | Bounded `workspace.explore` and diagram/source correspondence exist                                                               | Breadcrumb/history UI over supported scopes; revision-aware navigation and recovery from failed/stale requests                                                               | Separate functional feature         |

No engine replacement, generic docking framework, new production dependency or portable project format change is needed for the first layout slice. Browser layout preferences are distinct from project bundles and recovery data.

## Delivery sequence

### 1. Working layout and controls

Recompose existing Explorer, diagram, source editor, Properties and Issues in the target positions. Keep existing representation switching initially; do not fake document tabs. Provide navigator/source/inspection toggles, focus and maximise/restore, keyboard resizing, reasonable minimum dimensions and browser-local preference migration. Show source and inspection only on explicit actions, except that an application failure must still surface actionable issues. If Issues opens automatically on failure, show that tab in the shared bottom dock without discarding its previous tab state.

Success: import/example opens a useful model; select updates current selection without opening inspection; Inspect opens bottom detail; file/Open source opens right source; errors remain visible and navigable. Preserve exact drafts, CodeMirror undo/selection/scroll, applied revision, source history, named-view geometry and camera through all panel transitions. Focus must return to a visible control when its previous panel closes. Hidden content must remain inert and mounted as appropriate.

### 2. Visual and inspection refinement

Compact header controls; quieter section headings, selected rows and type badges; short bottom identity/attributes layout with overflow for larger content; Properties/Relationships/Issues tabs. Keep all existing requirement, inherited-value, port, unsupported-case and guarded-source details available. Do not impose a fixed shallow height that clips large property sets. Make real source commands reachable at narrow widths. Keep authoring available through existing reviewed transactions.

### 3. Workspace/source tabs and supported model navigation

Define tab identity from existing file/view/document/representation identities; support activation, close, last-tab fallback and per-tab UI state. Start with lightweight descriptors and the existing single workspace session rather than evaluating a full separate model per tab. Inactive data can be stale: validate/recompute on activation using current model/revision. Keep draft text project-owned; closing a source tab does not silently discard drafts. Retaining editor undo/scroll per file needs explicit ownership and tests, not merely rendering tab buttons. Table/matrix tabs remain project-wide unless an actual scoped contract is added.

#### Navigation improvements in phase 3

Breadcrumbs and back/forward for supported exploration scopes, selection reveal, connection endpoint navigation and explicit Explore/View source actions. Use real correspondence and usage context; repeated usages must not collapse onto a type definition. Unsupported unfolding remains explained. Failed, cancelled or superseded navigation retains current work. These behaviours go beyond moving panels and should be reviewed independently.

Defer arbitrary drag/drop docking, persistent exploration in portable bundles, cross-project search, new renderer families and simulated verification. Keep the first redesign bounded.

## Verification gates

Before UI workflow edits, inspect the running application and relevant browser tests. Extend `shell/layout.test.ts` for new schema, migration, invalid storage and restore rules. Use existing `workbench-chrome`, `source-editor`, `explorer`, diagnostics, requirements, document, authoring and recovery scenarios as preservation coverage rather than replacing them with screenshot-only tests.

Prove panel transitions preserve exact source/drafts, undo, editor selection/scroll, camera and saved positions. Cover explicit Inspect versus selection, issue reveal, focus restoration, source minimum size, storage denial, malformed/old preferences and narrow-window transitions. Tab work adds stale-revision, close/reopen and per-file undo tests; exploration work retains real-engine scenarios and repeated-usage fixtures.

Run `npm run check`, `npm run build`, appropriate real-engine functional browser checks and the visual project under the documented workflow. Inspect intentional screenshot changes at desktop and narrow widths, light and dark, plus forced-colour/reduced-motion and keyboard behaviour. Update baselines only after inspecting the intended changes. See the verification record for actual passing and pending checks.

## Review boundaries

Phase 1: four-section Explorer, model centre, source right, inspection/issues bottom, independent panel controls and preserved state. Reuse existing source/diagram/property content. Phase 2 adds muted styling and compact inspection; phase 3 adds tabs and supported model navigation. Most risk lies in state lifetime and revision-safe navigation, not CSS.
