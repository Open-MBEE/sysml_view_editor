# Workbench panels and action icons

The workbench composes owned shadcn Resizable, Tooltip and Popover primitives around the existing editor components. `react-resizable-panels` is pinned to 4.14.8; Tooltip and Popover use the existing Radix dependency. The registry sources and retained MIT notices define provenance. The older `sysml_ide` supplies interaction examples; its PaneForge/Dockview application shell is not imported.

## Panel behavior

Explorer and Inspector resize beside the central editor. Source and Diagram share an adjustable divider in Split mode. Below 900 px the editor split becomes vertical. Issues is a separate, resizable bottom dock. Defaults collapse Inspector on a fresh narrow viewport; an edge rail can reopen it. Header options offer Narrow/Widen or Shorter/Taller without dragging, and Workspace layout offers source/diagram share controls and Reset layout.

Each side panel remembers its expanded percentage through collapse and restore. Reopening uses that percentage unless it would fall below the tool’s pixel minimum, in which case the minimum is requested without replacing the saved percentage. Pixel minimums keep Explorer (145 px), Inspector (190 px) and Issues (96 px) usable; side panels are capped at 420 px and Issues at 60%. The source/diagram panes have horizontal minimums of 160 px for Source and 200 px for Diagram, or 100 px vertically, and their divider cannot collapse an editor while Split mode is selected. The library applies constraints against available space. On screens below 600 px, explicitly opening one side tool collapses the other.

Dividers have accessible names and library-provided pointer/keyboard behavior. They remain registered in the layout when a tool collapses: removing a divider from layout can invalidate its association with the neighboring panels. The source/diagram divider is disabled outside Split mode. Hidden contents remain mounted and inert, keeping draft text and component state out of keyboard navigation. Single-editor modes reapply their layout when a resize callback reports space retained by the hidden pane after constraint registration. This avoids the old Diagram minimum leaving a blank strip after Split → Code; returning to Split retains the saved share.

Explicit collapse moves focus to the corresponding visible edge-rail reopen control. Explicit reopen returns focus to the panel's collapse button, after the restored content is no longer hidden/inert. New diagnostic/error text opens Issues without taking editor focus. A user can close and reopen that dock independently. Explicit model, diagram or requirements-data selection opens Inspector without taking desktop focus from the selected item. Below 600 px this transfers focus to the visible Inspector collapse control, because opening it collapses Explorer. Unrelated renders do not reopen a manually collapsed Inspector.

The canvas waits for measured dimensions and initialized nodes before fitting. Authored trees/interconnections enter at 100% when a complete fit would be below 60%, with a top-aligned component (rather than empty container space) or centered selected occurrence. Fit view remains an explicit complete-graph overview, and 100% reads the exact selected diagram node or port owner (or the first structural component, then root, when none is selected). Trees allow zoom down to 10%, so an overview is not limited by the old 50% floor. These actions alter only the camera. Explicit Code/Split/Diagram mode changes refit the available diagram, retaining the previous workflow. Dragging dividers or collapsing side tools does not repeatedly fit or arrange nodes, so the user's camera and saved model-space coordinates survive those changes.

## Preferences and preservation

`workbench/shell/layout.ts` owns a closed TypeBox schema for `sysml-workbench-layout-v1`. It stores version 1, the last expanded side/dock percentages, the source split share and tool collapse flags. Values are bounded; invalid, unknown, oversized or incompatible records fall back to defaults. No document text or semantic identifiers enter these preferences.

Reads and writes tolerate blocked browser storage. A failed save retains the live layout for the visit and reports the failure under Workspace layout. Reset applies responsive defaults. Preferences are specific to a browser origin; they are not part of the portable project.

Panel changes do not invoke workspace transactions, reparse source, alter diagram geometry, mark the project modified or add undo history. Source and Diagram remain mounted through mode changes. Project bundles retain their existing version-1 format. Download provides a portable copy; the separate local recovery workflow offers explicit restore/discard after reload. Remembering panel preferences is not work recovery.

## Source editor

`workbench/source/SourceEditor.tsx` owns one CodeMirror 6 view. The stream language supplies lexical keyword/comment/string/number coloring and brace indentation; engine parsing, diagnostics and semantic edits retain their existing owners. Shared theme roles style highlighting, gutters, selections and the built-in search panel. Semantic completion, hover, definition navigation, formatting and syntax-aware folding are not supplied by this lexical mode.

Local text changes update workspace drafts. Busy operations reconfigure editing access without replacing the view or local history. A different file or externally replaced source starts a fresh editor state, preventing local undo from reviving discarded work or another file's edits. The view itself stays mounted through resizing and editor-mode changes. Source reveal translates raw UTF-16 positions to CodeMirror's LF-based positions, including CRLF and Unicode. Text edits retain untouched line separators, including mixed endings; inserted lines use the file's first separator. Portable sources, drafts, geometry and the version-1 project format retain their existing schemas and ownership.

## Toolbar ownership

`WorkspaceToolbar` contains only `ArrangementSelector` and Workspace layout. Source only, Source + Model and Model only retain the internal `code`, `split` and `diagram` states. The mutually pressed arrangement controls are centered in their global bar, independent of the active Diagram/table/matrix representation. `ModelPaneHeader` composes the visibly labeled representation buttons, applied/draft/busy status and diagram target controls for [#42](https://github.com/Open-MBEE/sysml_view_editor/issues/42).

`SourcePaneHeader` lives inside SourceEditor and receives the existing source transaction callbacks from Workbench. It shows the active filename, a per-file draft badge, source undo/redo, workspace source status and labeled Apply/Discard actions. The badge compares that file's draft and applied text; a different file's draft can keep the workspace status pending without marking the active file. SourceEditor supplies its own Find references/Format source actions through a header composition callback; its CodeMirror instance and source-assistance ownership remain unchanged.

Source actions become hidden/inert with Source in Model-only mode. Showing Source makes them reachable; arrangement changes never apply or discard. The existing diagram metadata continues to distinguish the applied model from pending drafts. Source history and action groups align inside the actual pane and wrap at constrained pane widths, so global toolbar alignment no longer measures Explorer/Inspector pixel widths. Source split-ratio observation remains for the single-pane constraint-registration guard, and persisted preferences are unchanged. In the vertical arrangement, Source’s minimum height follows the measured, wrapping header plus 80 px of editor space. A ResizeObserver updates that limit when the header width/content changes, ignoring zero-height measurements while Source is hidden; horizontal Source width limits are unchanged.

Sidebar collapse controls remain in their own headers, with contextual edge reopen rails. The activity rail and sectioned Explorer are tracked separately by [#43](https://github.com/Open-MBEE/sysml_view_editor/issues/43). Broader responsive/accessibility integration remains [#44](https://github.com/Open-MBEE/sysml_view_editor/issues/44). See the [agreed product design](../design/workbench-product-decisions.md) for staged scope and preservation gates.

## Model header and renderer lifetime

`ModelPaneHeader` uses the existing Workbench `dataMode` and transaction handlers. `DiagramTargetControls` owns named-view selection, exploration scope/representation focus, view-kind metadata and existing contextual authoring buttons. It is composed once into the header; Diagram no longer renders a competing target header. Its controls remain mounted but hidden/inert for tables/matrices, preserving exploration focus refs without exposing diagram-only controls.

The Diagram renderer remains at its existing stable position/key and is hidden for data representations. Its layout, camera, selection, asynchronous arranging/failure reporting and canvas Fit/100%/lock controls remain renderer-owned. `supportsDiagram` shares the original UI capability gate with the header: an evaluated engine artifact can still have no renderer here, as with sequence views. Busy status distinguishes work in progress from the applied revision still being displayed; unapplied drafts do not imply a new rendered model.

Tables/matrices are explicitly labeled Project-wide requirements. Their search, sorting, filters, CSV export, loading/error/retry and guarded inspection remain owned by RequirementsPanel. Header overflow uses a bounded native scroll area when the vertical Model pane is deliberately reduced; representation and target controls remain keyboard reachable. The broader responsive/assistive-technology integration remains #44.

## Icons and controls

Lucide icons use the shared shadcn Button sizes, theme roles and focus indicators. Compact history and mode actions use `ui/IconButton.tsx`: each has an explicit accessible name, a Tooltip and a decorative SVG. The root supplies one delayed Tooltip provider, and hints pass pointer events through to the underlying UI.

| Action                                     | Icon                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| Source undo / redo                         | Undo2 / Redo2                                                  |
| Source only / Source + Model / Model only  | CodeXml / Columns2 / Layers                                    |
| New project / Open / Download              | FilePlus2 / FolderOpen / Download                              |
| Apply / discard draft                      | Check / X                                                      |
| Appearance                                 | Palette                                                        |
| New part / connection                      | SquarePlus / Cable                                             |
| Source reveal / reviewed rename / new view | CodeXml / Pencil / Eye                                         |
| Diagram zoom / fit / lock                  | ZoomIn / ZoomOut / Scan / LockKeyhole variants                 |
| Panel visibility                           | Explorer Folder activity; contextual panel close/open variants |
| Panel options / reset layout               | Ellipsis / RotateCcw                                           |

Apply and Download retain visible labels; frequent compact actions retain precise names such as Undo source. CodeMirror draft undo/redo is distinct from accepted source transaction history. Standard editor/search shortcuts are documented in the README; Tab retains focus navigation. Existing kind labels remain visible alongside Explorer icons; those icons do not establish SysML notation support.

[Browser testing](../testing.md) describes verification; [verification](../verification.md) records actual outcomes and remaining gaps. Full tab docking, floating windows and complete accessibility auditing remain separate work. Engine-backed language queries are documented in [source editing and recovery](source-assistance-recovery.md).

## Model ownership tree

`workbench/explorer/model-tree.ts` projects the applied model using recorded `ownerId` relationships. It does not infer ownership from qualified-name prefixes, type references or diagram geometry. The separate Views list owns view navigation; view declarations and their rendering members are omitted from the Model tree. Missing/cyclic ownership is displayed at the top level with a notice, retaining reachable declarations.

`ModelTree.tsx` owns expansion and keyboard focus for the visit. Root packages begin collapsed. Rows show the declaration name and resolved type label, or a human-readable kind when untyped; tooltips retain full identifiers. Deep indentation is bounded, and very narrow trees hide the secondary column while retaining accessible descriptions. Tree layout never changes a source, project, transaction or saved position.

Navigation follows the [WAI-ARIA tree pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): arrows move through visible rows and fold/unfold branches, Home/End reach the visible extremes, typed prefixes find visible names, and Enter/Space select the focused declaration. Focus and selection are separate. One treeitem participates in Tab order; shared focus styling distinguishes it from the inspected row.

ExplorerSection owns independent session-only Files/Views/Model disclosure state. Section bodies stay mounted while hidden/inert, preserving tree expansion and focus state. New view and tree-wide actions are separate header targets. ActivityRail exposes only the implemented Explorer destination and delegates visibility to the existing panel controller; it owns no layout preferences. It replaces the adjacent collapsed Explorer rail, retaining the Inspector reopen control. Existing sidebar visibility preferences and `sysml-workbench-layout-v1` remain unchanged.

Diagram selection opens the Model section and the selected declaration's owner chain without taking focus from the diagram. A UI request counter handles a second selection of the same symbol after its branch has been folded. These are reveal requests, not semantic revisions or identity reconciliation. Selecting a tree row retains the existing Inspector behavior; source-range reveal still requires diagram correspondence. Expansion is not portable project data or automatic work recovery.

## Entry and session lifetime

The public landing lives at `/`; `/app` starts with a project launcher. Source/diagram panels are created on first successful project opening and remain mounted while the launcher or landing is displayed. Inactive workbench surfaces are hidden and inert, retaining the live source editor, history and camera. Appearance state belongs to one application provider. Modal controls close when their owning route becomes inactive, and focus returns to visible controls or the current route heading. A full browser reload is a new session with an explicit recovery choice.

## Shell code ownership

`Workbench.tsx` retains the live session, project-opening validation, selection and reviewed-command orchestration. `ProjectHeader.tsx`, `WorkspaceToolbar.tsx`, `SourcePaneHeader.tsx` and `ModelPaneHeader.tsx` render shell controls through explicit callbacks. `projectFiles.ts` owns local bundle construction, file reading and browser download preparation; workspace validation and saved-state tracking retain their existing contracts. Panel controls and preferences remain in `WorkbenchPanels.tsx` and `layout.ts`. Surface CSS is imported through `ui/theme.css`; see the [design-system ownership table](../design-system.md#ownership).

## Responsive and accessibility integration

Pane-local controls use intrinsic wrapping; Model representation buttons can wrap their labels within narrow panes even beside Inspector. Existing 900 px vertical Split and below-600 mutually exclusive side tools are retained. Opening a collapsed tool first releases its reopen rail before requesting space, avoiding a narrow-panel constraint deadlock. Hidden panels and sections remain mounted/inert. Projects and Workspace layout have distinct Folders/PanelsTopLeft icons; forced-color representation/arrangement selection has a persistent border separate from the focus outline. Reduced-motion behavior remains the shared rule in `base.css`.

`workbench-chrome.spec.ts` checks actual pane extremes, viewport transitions, exact drafts/bundle/editor/camera preservation, minimum-height canvas control access and forced-color focus/selection. Targeted accessibility-tree and screen-reader observations are recorded in [verification](../verification.md); they do not establish comprehensive assistive-technology support.
