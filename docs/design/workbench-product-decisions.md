# SysML View Editor — Product, Navigation, and Toolbar Design Decisions

**Status:** Agreed target design; implementation tracked in the [Product Design Update milestone](https://github.com/Open-MBEE/sysml_view_editor/milestone/1)

**Version:** 1.1 — repository baseline, refreshed against merged PR #38

**Date:** 2026-11-16

**Repository:** [Open-MBEE/sysml_view_editor](https://github.com/Open-MBEE/sysml_view_editor)

**Repository path:** `docs/design/workbench-product-decisions.md`

**Scope:** Hybrid modeling workbench, navigation architecture, Explorer, activity rail, panel behavior, editor toolbars, representation selection, icons, responsive layouts, accessibility, migration, and verification.

> **Decision status legend:** **Locked direction** means agreed as the target design; **proposed implementation** means a concrete recommended implementation that still needs code/review/testing; **deferred** means intentionally excluded from the near-term scope. This document records design decisions, not a claim that code changes have been made.

## 1. Executive summary

The product will evolve as a **hybrid SysML v2 modeling workbench**, combining the workspace architecture and discoverability of an IDE with the diagram/canvas interaction conventions of a visual modeling tool. It should neither be a purely file-first code editor nor a diagram-only modeling application.

**Core product principle:** The UI must distinguish four orthogonal actions:

1. **Navigate** — choose a file, named view, model element, or other artifact.
2. **Represent** — choose how model information is displayed (diagram, requirements table, traceability matrix).
3. **Arrange** — choose which panes are visible and how they are sized (Source only, Source + Model, Model only; Explorer/Inspector/Issues visibility).
4. **Operate** — act within the current context (apply source, rename, create part, connect ports, zoom, fit, etc.).

Controls should be placed next to the context they affect. In particular, a button that hides a sidebar is not interchangeable with a control that switches model representation.

### Decisions at a glance

| Decision                                                                  | Status                      | Consequence                                                                                          |
| ------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| Hybrid modeling workbench                                                 | **Locked direction**        | Support both code authoring and diagram/model exploration as first-class workflows.                  |
| Compact hybrid navigation                                                 | **Locked direction**        | A sparse activity rail plus a sectioned Explorer; avoid one rail destination per entity type.        |
| Three Explorer sections: Files, Views, Model                              | **Locked direction**        | Expose three distinct relationships to the model, not one synthetic hierarchy.                       |
| Two stable editor panes: Source + Model                                   | **Locked direction**        | Pane arrangement is separate from each pane's content.                                               |
| Source only / Source + Model / Model only                                 | **Locked direction**        | Retain existing internal `code` / `split` / `diagram` modes initially.                               |
| Model representations: Diagram / Requirements table / Traceability matrix | **Locked direction**        | Use a labeled representation selector inside Model, independent of pane arrangement.                 |
| Pane-local controls and headers                                           | **Locked direction**        | Source commands belong to Source; model selectors belong to Model; canvas controls remain on canvas. |
| Keep resizable-panel infrastructure and state preservation                | **Locked direction**        | No near-term Dockview migration or redesign of engine/persistence contracts.                         |
| Introduce ActivityRail, ModelPaneHeader, SourcePaneHeader                 | **Proposed implementation** | Staged extraction and composition from existing components.                                          |
| Cross-project Search rail activity                                        | **Proposed implementation** | Add when a real search experience is available; do not ship a decorative destination.                |
| Problems rail activity                                                    | **Deferred**                | Continue using existing Issues bottom dock initially; avoid duplicate diagnostic surfaces.           |
| Independent editor tabs, docking, floating panes                          | **Deferred**                | Do not change editor state model prematurely.                                                        |

## 2. Product mental model and information architecture

### 2.1 Workspace regions

The target desktop shell has these regions:

```text
Project/global header
└── Project identity, project commands, settings/help

Workspace arrangement bar
└── Source only | Source + Model | Model only | Workspace layout

Activity rail | Primary sidebar | Central editor workspace | Inspector
                                  └── Source pane and/or Model pane

Bottom Issues dock and status footer
```

The **activity rail** selects a broad work context; the **primary sidebar** exposes its navigable contents; the **central editor** presents and edits artifacts; the **Inspector** shows selection-specific information; the **Issues dock** lists diagnostics. A panel collapse control only adjusts visibility.

### 2.2 Three independent navigational projections

The Explorer exposes three related, but different, projections:

- **Files:** physical editable `.sysml` sources; answers _Where is this authored?_
- **Views:** named SysML views; answers _How is this presented?_
- **Model:** semantic ownership graph/tree; answers _What owns this element?_

A part may be declared in one file, owned semantically by a package, and included in several named views. The UI must not imply that filenames, model ownership, and view membership form a single tree.

### 2.3 Active file, view, selection, and focus are independent

- **Active source file** identifies which draft is shown in Source.
- **Active named view / exploration** identifies the current diagram target.
- **Active model representation** identifies diagram/table/matrix.
- **Semantic selection** identifies an element inspected or revealed.
- **Keyboard focus** identifies the current interaction target.
- **Workspace arrangement** determines visible pane slots.

These are separate state dimensions. Do not infer one from another except through an explicit, documented navigation command.

## 3. Compact hybrid navigation

### 3.1 Activity rail

**Locked direction:** Use a small, stable rail instead of a full VS Code clone. The activity rail does not replace the Explorer; it changes the content of the primary sidebar.

**Initial scope:**

- **Explorer** (`Files` icon): primary destination containing Files, Views, Model sections.
- **Search** (`Search` icon): proposed destination once cross-project search exists; distinguish filename, semantic declaration, and text matches.

**Do not initially add:**

- Separate **Model** rail activity (would duplicate Explorer's Model section).
- Separate **Views** rail activity (would duplicate Explorer's Views section).
- **Problems** activity (would duplicate existing Issues dock without a richer workflow).
- **Diagram** activity (diagram is a Model representation, not a navigation activity).
- **Inspector** activity (Inspector is contextual, not a primary work context).

Possible future entries may be introduced when they represent complete workflows, not merely new entity types. Settings/help belong in the global header or secondary footer, not in the primary navigation set by default.

### 3.2 Rail interaction contract

| Event                                      | Result                                            | Must not change                             |
| ------------------------------------------ | ------------------------------------------------- | ------------------------------------------- |
| Click inactive activity                    | Activate it and open primary sidebar              | Active file/view, drafts, selection, camera |
| Click active activity while sidebar open   | Collapse primary sidebar                          | Active file/view/selection                  |
| Click active activity while sidebar closed | Reopen sidebar                                    | Active file/view/selection                  |
| Reopen sidebar                             | Restore last activity and section expansion state | Model/project state                         |
| Switch activity                            | Replace primary sidebar contents                  | Editor artifact and pane arrangement        |

Rail controls are buttons with descriptive names/tooltips. Use focus and selected visual states independently. When integrated, the activity icon itself should serve as the Explorer reopen affordance; avoid also preserving a redundant adjacent 32 px Explorer reopen rail.

### 3.3 Explorer sections

Explorer contains **Files**, **Views**, and **Model**, each with an independently collapsible header.

| Section | Header icon             | Header affordances                   | Content                                      |
| ------- | ----------------------- | ------------------------------------ | -------------------------------------------- |
| Files   | `Folder` / `FolderTree` | Chevron, optional count              | `.sysml` source entries and draft indicators |
| Views   | `Network`               | Chevron, `Plus` action for New view  | Named SysML view list                        |
| Model   | `ListTree`              | Chevron, optional find/filter action | Semantic ownership tree                      |

**Section header behavior:** Clicking its non-action region toggles the section; `Plus`/Search remain independent focusable buttons. Expansion state survives hiding/reopening Explorer. Clicking a chevron in the Model tree expands ownership branches **without selecting a different semantic element**.

**Selection behaviors:**

- Select file: update active file; preserve active named view. As currently implemented, if in Model-only mode, reveal Source by switching to Split.
- Select named view: choose the view and show Diagram representation; preserve active file and drafts.
- Select model element: update selection/Inspector without automatically switching files, diagrams, or source content.
- Select diagram symbol: synchronize semantic selection and reveal the Model tree owner chain without stealing focus from the diagram.
- Reveal source is an explicit navigation action; use recorded correspondence/origin rather than inventing file/source mapping from tree labels.

## 4. Two-pane editor architecture

### 4.1 Locked model

The central workspace consists of two stable slots:

**Source pane:** selected SysML source file; CodeMirror draft editor, language assistance, local draft undo/redo, source status, and accepted source-transaction history.

**Model pane:** selected model representation, either named diagram or temporary exploration, project-scoped requirements table, or traceability matrix. Its view/scope and representation controls belong to the Model pane.

The panes may coexist or one may be hidden; **hiding a pane does not destroy its active content or discard work**.

### 4.2 Arrangement vs representation

These are intentionally separate controls:

| Layer                 | Visible options                                              | Existing internal state           | Meaning                            |
| --------------------- | ------------------------------------------------------------ | --------------------------------- | ---------------------------------- |
| Workspace arrangement | **Source only**, **Source + Model**, **Model only**          | `mode: 'code'                     | 'split'                            | 'diagram'` | Which slots appear  |
| Model representation  | **Diagram**, **Requirements table**, **Traceability matrix** | `dataMode: 'diagram'              | 'table'                            | 'matrix'`  | What Model displays |
| Diagram target        | Named view / Explore model                                   | `state.view`, `state.exploration` | Which diagram content is evaluated |
| Source target         | Selected `.sysml` file                                       | `file`                            | Which document is edited           |

Do not use **Diagram** as both the outward name of a layout and a representation. The internal enum `diagram` can remain during the first migration to avoid unnecessary changes.

### 4.3 Arrangement selector

| Button         | Icon       | Tooltip / accessible name | Internal action      |
| -------------- | ---------- | ------------------------- | -------------------- |
| Source only    | `CodeXml`  | Show source only          | `setMode('code')`    |
| Source + Model | `Columns2` | Show source and model     | `setMode('split')`   |
| Model only     | `Layers`   | Show model only           | `setMode('diagram')` |

Use a mutually exclusive selected state; currently `aria-pressed` is appropriate for the existing `IconButton` group. Each button needs visible selected state, hover state, focus indication, and tooltip. `Layers` is intentionally distinct from `Network`: the former means the **Model pane**, while the latter means **diagram representation**.

### 4.4 Model representation selector

A **labeled selector**, not three unlabeled icon buttons:

| Item                | Icon      | Meaning                             |
| ------------------- | --------- | ----------------------------------- |
| Diagram             | `Network` | Graphical view or model exploration |
| Requirements table  | `Table2`  | Project-scoped requirements data    |
| Traceability matrix | `Grid3X3` | Project-scoped relationship matrix  |

Changing representation updates `dataMode` only and must **not** change the outer arrangement. Choosing a named view sets the diagram representation; that is an explicit request to open a diagram. Tables and matrices should not display a named-view control if they are not actually filtered by that named view.

The current `dataMode` implementation can remain initially; long-term representation-specific state can use a discriminated union, but **do not migrate to a plugin-like representation framework in the first PR**.

## 5. Toolbar and panel-header anatomy

### 5.1 Global project header

Scope: OpenMBEE identity, project name/origin, project lifecycle commands, help/appearance, project download. Do not put diagram zoom or source undo in this global header.

Review the currently repeated `PanelsTopLeft` icon: it is used for **Projects** and **Workspace layout**. Avoid one high-frequency icon representing unrelated actions. Use a project/folder-oriented icon for the Projects action, reserve `PanelsTopLeft` for layout.

### 5.2 Workspace arrangement bar

**Proposed dimensions:** 44–48 px height, following existing tokens. Contains arrangement selector and layout options only; it is independent of Source and Model panes.

The `WorkspaceLayoutMenu` can expose changes to source/model space allocation and reset layout. Continue to use the current `WorkbenchPanels` layout controller and preferences. Do not duplicate Inspector/Explorer collapse controls here when they already appear in contextual headers.

### 5.3 SourcePaneHeader

**Identity row:** `FileCode2` icon, active filename (truncated), _per-file_ unapplied draft indicator, source actions/context overflow as needed.

**Transaction controls:** accepted source undo (`Undo2`), redo (`Redo2`), project-level source apply/discard actions, and explicit status text:

- `Source applied`
- `Draft not applied`
- `Working…`

`Apply source` and `Discard` always retain visible text (wrap to second row when needed). Tooltips for undo/redo must say **Undo source** and **Redo source** to distinguish them from CodeMirror draft-local undo/redo.

**Critical nuance:** `state.unapplied` is workspace-level. A badge next to a particular filename must compare that file's draft and applied text. Do **not** show a per-file dirty badge because another file has an unapplied draft. Apply/discard may still be workspace-level operations as currently implemented; make their scope clear if necessary.

Do not silently apply/discard when Source is hidden. When Source is hidden, source actions remain reachable by switching arrangement.

### 5.4 ModelPaneHeader

**Primary row:** model representation selector and model context identity.

**Diagram context only:** Named view / Explore model selector; scope/representation controls while exploring; view kind/revision status; supported diagram authoring actions (`New part`, `Connect ports`) when available.

**Table/matrix context:** Representation title and project scope. Table/matrix-specific search/filter/sort/export stay within their actual content component and should not be moved into generic diagram controls.

**Status:** Must identify whether the rendered model reflects applied source, whether a draft is pending, whether evaluation is ongoing, and whether rendering is unavailable or temporary exploration is active. An unapplied source draft does **not** imply the diagram has already been updated.

**Avoid duplicate headers:** The current `Diagram.tsx` already renders `pane-heading` with named-view selection, exploration controls, metadata, and diagram actions. Relocate or compose these into `ModelPaneHeader`; do not leave two competing view selectors or duplicate New part/Connect ports controls.

### 5.5 Diagram canvas controls

Retain current `DiagramControls.tsx` bottom-left controls:

- `ZoomIn`, `ZoomOut`, `Scan` (fit), and the **100%** readable-selection action with current zoom
- `LockKeyhole` / `LockKeyholeOpen`

These manipulate the canvas viewport/interaction and should not share the global arrangement bar. They are only visible for the Diagram representation. Keep `Fit view` separate from automatic panel resizing behavior.

### 5.6 Explorer / Inspector / Issues headers

| Panel     | Header identity                      | Contextual buttons                     |
| --------- | ------------------------------------ | -------------------------------------- |
| Explorer  | EXPLORER                             | `Ellipsis` options; `PanelLeftClose`   |
| Inspector | INSPECTOR + selected element summary | `Ellipsis` options; `PanelRightClose`  |
| Issues    | ISSUES + count                       | `Ellipsis` options; `PanelBottomClose` |

The panel's own header owns its collapse button. When collapsed, provide a contextual reopen affordance: Explorer via the activity rail once integrated, Inspector via right edge, Issues via footer or bottom edge. Avoid controls whose only symbol is an ambiguous chevron when their action is to hide an entire panel.

## 6. Icon semantics and interaction grammar

### 6.1 Consistency rules

1. One icon should have one primary meaning within a given context.
2. Sidebar visibility icons are separate from arrangement and representation icons.
3. Icon-only buttons require tooltips, accurate accessible names, visible active state, and focus indication.
4. Dangerous or committing actions such as Apply source, Discard, and Download project retain text labels.
5. `Ellipsis` menus contain **secondary actions scoped to the current panel**; do not hide primary navigation or editor mode switching there on wide screens.
6. Model-kind icons are decorative contextual aids, **not claims of SysML diagram-notation conformance**; retain visible kind/type labels.
7. Distinguish selection from keyboard focus and source/view navigation.

### 6.2 Icon inventory

| Control                  | Lucide icon                            | Interaction category        |
| ------------------------ | -------------------------------------- | --------------------------- |
| Explorer activity        | `Files`                                | Navigation                  |
| Search activity          | `Search`                               | Navigation                  |
| Files section            | `Folder` or `FolderTree`               | Navigation                  |
| Views section            | `Network`                              | Navigation section identity |
| Model tree section       | `ListTree`                             | Navigation section identity |
| New named view           | `Plus` plus label/tooltip              | Action                      |
| Source only              | `CodeXml`                              | Workspace arrangement       |
| Source + Model           | `Columns2`                             | Workspace arrangement       |
| Model only               | `Layers`                               | Workspace arrangement       |
| Diagram representation   | `Network`                              | Representation              |
| Requirements table       | `Table2`                               | Representation              |
| Traceability matrix      | `Grid3X3`                              | Representation              |
| Workspace layout         | `PanelsTopLeft`                        | Layout                      |
| Reset layout             | `RotateCcw`                            | Layout                      |
| Hide/show Explorer       | `PanelLeftClose` / `PanelLeftOpen`     | Visibility                  |
| Hide/show Inspector      | `PanelRightClose` / `PanelRightOpen`   | Visibility                  |
| Hide/show Issues         | `PanelBottomClose` / `PanelBottomOpen` | Visibility                  |
| Source undo/redo         | `Undo2` / `Redo2`                      | Source transaction          |
| Apply/discard            | `Check` / `X` with text                | Source transaction          |
| New part / Connect ports | `SquarePlus` / `Cable` with text       | Model authoring             |
| Zoom / fit               | `ZoomIn`, `ZoomOut`, `Scan`            | Diagram canvas              |
| Lock/unlock              | `LockKeyhole`, `LockKeyholeOpen`       | Diagram canvas              |
| Secondary options        | `Ellipsis`                             | Context menu                |

`Eye` for **New view** is potentially ambiguous with visibility; prefer explicit text `New view` with a `Plus` glyph in a section-header action.

## 7. Canonical interaction state transitions

| User event                     | Arrangement                    | Model representation        | Active file | Active view            | Other invariants                                          |
| ------------------------------ | ------------------------------ | --------------------------- | ----------- | ---------------------- | --------------------------------------------------------- |
| Click Source only              | Code                           | Preserve                    | Preserve    | Preserve               | Do not apply or discard drafts                            |
| Click Source + Model           | Split                          | Preserve                    | Preserve    | Preserve               | Restore saved split ratio                                 |
| Click Model only               | Diagram (internal)             | Preserve                    | Preserve    | Preserve               | Preserve source/editor state                              |
| Select representation          | Preserve                       | Set selected representation | Preserve    | Preserve               | Does not mutate project                                   |
| Select file in Explorer        | If Model only, switch to Split | Preserve                    | Update      | Preserve               | No silent named-view change                               |
| Select named view              | Preserve                       | Diagram                     | Preserve    | Update                 | No silent active-file change                              |
| Select model tree element      | Preserve                       | Preserve                    | Preserve    | Preserve               | Update selection/Inspector only                           |
| Select requirement table row   | Preserve                       | Preserve                    | Preserve    | Preserve               | Open Inspector; do not navigate to source automatically   |
| Select diagram symbol          | Preserve                       | Preserve                    | Preserve    | Preserve               | Update semantic selection and tree reveal; no focus steal |
| Open diagnostic                | If Model only, switch to Split | Preserve                    | Update      | Preserve               | Reveal source location                                    |
| Reveal requirement source      | Split                          | Preserve                    | Update      | Preserve               | Maintain draft-validity guard                             |
| Hide Explorer/Inspector/Issues | Preserve                       | Preserve                    | Preserve    | Preserve               | No source/semantic/camera mutation                        |
| Resize sidebar/divider         | Preserve                       | Preserve                    | Preserve    | Preserve               | Do not auto-fit diagram                                   |
| Apply source                   | Preserve                       | Preserve                    | Preserve    | Prefer same named view | Evaluate new applied model through existing workflow      |

**Source-of-truth note:** Existing code in `Workbench.tsx` intentionally switches Model-only to Split on file selection, uses `dataMode='diagram'` when a named view is selected, and routes diagnostics or explicit source-reveal commands to source. Requirement-row selection opens Inspector; source navigation is a separate, guarded action. Keep these explicit navigation exceptions rather than claiming all events are zero-impact on arrangement.

## 8. Responsive layout and sizing

The target **conceptual** breakpoints (do not add new breakpoints without testing existing rules):

| Viewport    | Target behavior                                                                           |
| ----------- | ----------------------------------------------------------------------------------------- |
| >=1200 px   | Rail + Explorer, optional Inspector, horizontal split when both panes visible             |
| 900–1199 px | Collapsible Explorer; Inspector typically collapsed; groups may wrap                      |
| 600–899 px  | Narrow workbench, vertical Source/Model split per existing `<900` rule                    |
| <600 px     | Explorer/Inspector mutually exclusive, editor prioritized; secondary actions can overflow |

**Existing behavior to retain:** Split becomes vertical below 900 px. Opening Explorer on a very narrow screen collapses Inspector and vice versa. Inspector defaults closed on a fresh narrow layout. Dividers retain accessible keyboard/pointer resize behavior and panel minimum sizes. The existing CodeMirror and diagram remain mounted through mode changes, and hidden content stays inert.

**Proposed initial tokens** (subject to testing against existing Geist/shadcn CSS):

- Activity rail: ~48 px wide; button targets ~40×40 px.
- Global arrangement bar: 44–48 px tall.
- Pane headers: at least 40–44 px high, with wrapping rows when constrained.
- Toolbar icon targets: ~32×32 px; icons ~16–18 px.
- Spacing consistent with existing 4/8/12/16/24 px scale.
- Visible focus outline ~2 px; no color-only differentiation.

Responsive rules should also use **container queries based on actual pane width**: wide windows with both Explorer/Inspector open can yield narrow editor panes. On small widths, wrap critical Apply/Discard controls rather than converting them into ambiguous icon-only buttons. A more radical overlay-Explorer design is optional later, not required for initial migration.

## 9. State, persistence, and preservation

Keep these separate:

| Domain                                      | Source of truth                                     | Proposed persistence                                    |
| ------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Applied model, draft sources, geometry      | Existing workspace/project model                    | Existing portable project bundle and recovery contracts |
| Active source file and named view           | Existing `Workbench`/workspace session              | Existing session/recovery behaviors                     |
| Arrangement (`code`/`split`/`diagram`)      | Existing `Workbench` mode                           | Keep initial behavior                                   |
| Representation (`diagram`/`table`/`matrix`) | Existing `Workbench` `dataMode`                     | Keep session behavior initially                         |
| Panel size/collapse                         | Existing `WorkbenchPanels` controller / `layout.ts` | Browser preference                                      |
| Rail activity / Explorer section expansion  | New navigation UI state                             | Session initially; avoid changing portable project data |
| Selection / keyboard focus                  | Existing Inspector, ModelTree, diagram components   | Session, not project source semantics                   |

Do not put model identifiers/source content into layout preferences. Do not increment semantic revision, mark the project dirty, or push undo history for pure navigation/layout operations.

**Preserve the layout storage schema** `sysml-workbench-layout-v1` in the first migration; only migrate it if a genuinely incompatible layout data shape is required. The portable bundle format remains unchanged.

## 10. Accessibility requirements

- Icon buttons have accurate accessible names and tooltip text.
- Arrangement control has mutually exclusive selected state (`aria-pressed` with current button implementation).
- Representation select has a visible label and programmatic name.
- Collapsed panes are hidden/inert to keyboard navigation; focus transfers to a visible reopen affordance.
- Editor and diagram selections do not steal focus merely to synchronize another projection.
- Model tree retains WAI-ARIA tree behavior and separate focused vs selected rows.
- Tooltip/hover must not be the only indicator of state; selected backgrounds and focus rings remain visible in forced colors and reduced-motion modes.
- Avoid conflicting shortcuts with CodeMirror (especially draft undo/redo and search).
- If adding a Toggle Explorer shortcut, document and test it. Do not invent a default shortcut that conflicts with existing code editor bindings.
- New menus and selectors need keyboard and screen-reader testing, not just geometry screenshots.

## 11. Verified current code touchpoints

The design was discussed against the repository's current files:

| File                                             | Current relevant responsibilities                                                          | Proposed change                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `src/lib/workbench/shell/Workbench.tsx`          | `mode`, `dataMode`, selected file/view, orchestration, model representation buttons        | Compose separate pane headers; retain existing state/actions                                                |
| `src/lib/workbench/shell/SourceToolbar.tsx`      | Source transactions + Code/Split/Diagram selector                                          | Extract global arrangement selector and pane-local source controls                                          |
| `src/lib/workbench/shell/WorkbenchPanels.tsx`    | Resizable layout, persisted preferences, global toolbar alignment, collapse/focus behavior | Keep layout controller; render headers within panes; remove measured-toolbar alignment only after migration |
| `src/lib/workbench/shell/layout.ts`              | `sysml-workbench-layout-v1` preference schema, ratios, collapse flags                      | Preserve compatibility                                                                                      |
| `src/lib/workbench/explorer/Explorer.tsx`        | Files, named views, ModelTree                                                              | Add section headers and clearer selected states; no semantic hierarchy rewrite                              |
| `src/lib/workbench/explorer/ModelTree.tsx`       | Semantic ownership/focus/selection behavior                                                | Preserve tree semantics                                                                                     |
| `src/lib/workbench/diagrams/Diagram.tsx`         | Existing named-view select, exploration fields, diagram `pane-heading`, contextual actions | Move/compose header into ModelPaneHeader; avoid duplicate controls                                          |
| `src/lib/workbench/diagrams/DiagramControls.tsx` | Bottom-left zoom, fit, lock controls                                                       | Preserve                                                                                                    |
| `src/lib/ui/workbench.css`                       | Toolbar alignment, panel layout, pane headers and responsive rules                         | Update styles using existing tokens; remove obsolete rules when extraction complete                         |
| `docs/architecture/workbench-layout.md`          | Current layout and icon contracts                                                          | Update once implementation matches design                                                                   |
| `docs/design-system.md`                          | Style tokens, controls, accessible conventions                                             | Update after decisions are implemented                                                                      |

References: repository README, `docs/architecture/workbench-layout.md`, and `docs/design-system.md`. Hosted sandbox may lag the default/development branch; code and visual behavior should be checked against the actual target branch before submitting changes.

## 12. Staged migration and PR plan

### PR 1 — Toolbar extraction, no semantics change

- Extract `WorkspaceToolbar` and `ArrangementSelector` from existing `SourceToolbar`.
- Introduce `SourcePaneHeader` using existing source transaction callbacks.
- Keep `mode` and current project/session state unchanged.
- Preserve existing `SourceToolbar` behavior during transition, removing it only after the replacement is integrated.
- Verify draft/edit history, apply/discard, mode switches, layout preservation.

**Exit:** Toolbar controls have correct ownership; no functional regressions.

### PR 2 — ModelPaneHeader composition

- Introduce `ModelPaneHeader` and a labeled representation selector from existing `dataMode` controls.
- Relocate/compose `Diagram.tsx`'s named-view selector, exploration controls, diagram metadata, and contextual authoring controls.
- Do not duplicate view selectors or show named-view controls on project-level tables/matrices.
- Preserve model evaluation and diagram renderer mounting behavior.

**Exit:** One clear Model header across diagram/table/matrix with accurate status.

### PR 3 — Explorer and compact navigation

- Introduce sectioned Files/Views/Model Explorer with collapsible headers.
- Add sparse ActivityRail only for implemented activities (Explorer first; Search when functional).
- Route Explorer collapse/reopen through rail and remove redundant edge reopen control.
- Keep Inspector and Issues as contextual/bottom dock mechanisms.

**Exit:** Rail/Explorer state changes do not change editor artifacts, source drafts, or selection.

### PR 4 — Responsive, accessibility, visual consistency

- Update CSS and design tokens for pane-local headers and arrangement selector.
- Add container-width wrapping and tiny-width states.
- Test pointer, keyboard, screen reader, forced colors and responsive transitions.
- Update EditorTour selectors, labels, README, design system, and architecture documentation.

**Exit:** No clipped critical actions; focus and state indication remain correct.

**Suggested component additions** (paths may be adjusted to current shell conventions):

```text
src/lib/workbench/shell/WorkspaceToolbar.tsx
src/lib/workbench/shell/ArrangementSelector.tsx
src/lib/workbench/shell/SourcePaneHeader.tsx
src/lib/workbench/shell/ModelPaneHeader.tsx
src/lib/workbench/shell/ActivityRail.tsx    # when actually integrated
```

Avoid wholesale Dockview migration or redesigning `createWorkspace` while performing this UI refactor.

## 13. Acceptance checklist and verification

- [ ] Active source filename and active model representation are obvious independently.
- [ ] Source only / Split / Model only arrangement changes preserve draft text and active file/view.
- [ ] Requirements table ↔ Matrix ↔ Diagram changes preserve pane arrangement.
- [ ] Selecting a named view opens Diagram representation without changing active source file.
- [ ] Selecting a source file from Model-only mode reveals Source via Split without changing named view.
- [ ] Diagram clicks synchronize semantic selection/Model tree without stealing canvas focus.
- [ ] Unapplied source clearly indicates that Model displays the applied revision.
- [ ] A per-file modified indicator reflects that file, not unrelated workspace drafts.
- [ ] Apply and Discard remain labeled at narrow pane widths.
- [ ] Source local draft undo and accepted source transaction undo remain separate.
- [ ] No duplicate named-view selection/header actions remain.
- [ ] Panel collapse/restore preserves source editor, history, selection and diagram camera.
- [ ] Dragging pane dividers does not refit diagram or change saved geometry.
- [ ] Layout preferences retain existing browser-storage compatibility.
- [ ] Navigation, presentation, and layout changes do not alter the project bundle or semantic revision.
- [ ] Mode/representation buttons have tooltips, accessible names, selected state, and keyboard operation.
- [ ] Explorer/Inspector/Issues focus recovery remains correct.
- [ ] All relevant UI and visual regression tests pass on desktop and narrow viewports, in light/dark.

Suggested affected suites: `tests/e2e/toolbar.spec.ts`, `panels.spec.ts`, `source-editor.spec.ts`, `diagnostics.spec.ts`, `model-tree.spec.ts`, plus any representation/requirements visual tests.

## 14. Explicitly deferred product directions

- Independent editor tabs/documents (code, diagrams, tables as separately dockable artifacts).
- Dockview/PaneForge replacement, floating windows, and arbitrary docking.
- Full command palette unless tied to a concrete search/command workflow.
- Additional rail destinations (Problems, Model, Views) without demonstrable navigation need.
- New renderers, simulation/execution, semantic engine changes, or SysML notation claims.
- Generalized representation plugin framework or major representation-state refactor.
- Persistence of layout inside portable model projects.
- Rewriting camera-fit and layout-preservation logic for stylistic reasons.

These are viable future directions, not required for the next shipping iteration.

## 15. Questions remaining for implementation review

These do **not** reopen the main architecture decision:

1. Should the compact rail ship with **Explorer only**, or wait until Search has a real implementation? **Recommendation:** do not add an inert Search entry; ship rail once it supports meaningful navigation.
2. Should `SourcePaneHeader` show a single row on large panes or a stable two-row header? **Recommendation:** one row when comfortable, two when constrained, without moving high-consequence actions into icon-only overflow.
3. Where should source/project-wide Apply status appear when Model-only is visible? **Recommendation:** a non-actionable applied/draft status in Model, with actions reachable by showing Source; avoid duplicated commit controls.
4. Should selecting a named view focus the Model pane when Split is already open? **Recommendation:** provide a clear active-pane indicator without stealing focus from unrelated interactions.
5. Should a narrow-screen Explorer eventually use a temporary overlay? **Recommendation:** defer until usability testing shows the current collapsible panel consumes too much workspace.

## 16. Engineering handoff

**Implementation objective:** Refactor the workbench chrome into a global arrangement bar and pane-local Source/Model headers while retaining all existing workspace semantics, source/editor lifetime, evaluation behavior, and diagram preservation guarantees. Once stable, integrate the compact Explorer/activity-rail navigation.

**Do not interpret this document as permission to:** change the SysML engine interfaces, alter project bundle schemas, rewrite undo semantics, remove existing exploration actions, or replace the panel library.

**Definition of done:** The UI communicates at a glance **(1) which source is being edited, (2) what evaluated model representation is being viewed, and (3) how those contexts are arranged**, with automated preservation and accessibility checks supporting those promises.

## 17. Stage 1 implementation and verification map

The original v1.0 brief was supplied by Rohan on 2026-11-16. This repository baseline preserves its design direction, records #38’s 100% reading control and explicit requirement inspection, and maps the first bounded implementation. It does not mark the later design stages implemented.

- [#41 — Source toolbar extraction](https://github.com/Open-MBEE/sysml_view_editor/issues/41) owns the first PR. [#42](https://github.com/Open-MBEE/sysml_view_editor/issues/42), [#43](https://github.com/Open-MBEE/sysml_view_editor/issues/43) and [#44](https://github.com/Open-MBEE/sysml_view_editor/issues/44) retain the Model header, rail/Explorer and broader responsive/accessibility integration.
- `Workbench.tsx` continues to own `mode`, `dataMode`, active file and existing source transaction callbacks. No workspace operations move into layout components.
- `WorkspaceToolbar`/`ArrangementSelector` own the outer arrangement and layout menu. `SourcePaneHeader` owns source identity, a per-file draft badge and existing workspace source transactions. SourceEditor keeps its CodeMirror instance and language-assistance actions.
- `WorkbenchPanels` retains panel registration, mode restoration, collapse/focus behavior and the v1 preference schema. Toolbar alignment measurements become unnecessary only once controls live inside their actual panes; source-ratio observation needed by the single-pane restoration guard remains.

| Acceptance                                                                            | Existing baseline / focused extension                                                    |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Source transaction history remains exact and independent of local draft history       | `toolbar.spec.ts`, `source-editor.spec.ts`, workspace critical save/reopen/history cases |
| Pane arrangement stays independent of Diagram/table/matrix selection                  | New stage-1 browser workflow across the three arrangements and representations           |
| Active filename badge reports that file’s draft, not another file’s pending changes   | New multi-file draft/selection browser regression                                        |
| Source controls belong to Source and are reachable by showing it                      | Source-header containment, Model-only hidden controls and keyboard arrangement checks    |
| Source/editor lifetime, split ratios, active file/view and bundles survive navigation | `panels.spec.ts`, `source-editor.spec.ts`, portable download/reopen checks               |
| Primary source controls fit their pane and remain labeled                             | Actual pane-width geometry checks and reviewed desktop/narrow light/dark captures        |

Every result must distinguish observed baseline behavior, the implemented change, focused acceptance and hosted CI. No dependency, engine pin, semantic interface, portable format or layout-storage migration is part of this stage.
