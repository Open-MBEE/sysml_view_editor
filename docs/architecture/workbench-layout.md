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

## Toolbar alignment

The toolbar mirrors measured panel boundaries. In horizontal Split mode, source transaction history sits at Source's left edge, source status/discard/apply commands are centred over Source, and the mode selector is centred over Diagram. Workspace layout stays at the editor's right edge. The group widths update with the actual divider positions; viewport-wide `space-between` does not determine their placement.

Single-editor mode puts the mode selector and Workspace layout in separate columns with an 8 px gap. If the available editor width is at most 540 px, those controls move to another row so source commands remain reachable even when both side panels are wide.

Sidebar collapse controls remain in their own headers. A collapsed tool gets a narrow reopen rail at that same workspace edge, keeping those controls contextual and providing a stable focus target. Compact source commands retain a visible Discard label and Apply source; their accessible names remain explicit. Compact source commands take a full row below history so their group remains centred. Narrow toolbars reflow in groups without clipping controls, and the vertical editor arrangement centres each group across the editor area. Icon SVG bounds and toolbar/pane centre lines are covered by browser geometry assertions.

## Icons and controls

Lucide icons use the shared shadcn Button sizes, theme roles and focus indicators. Compact history and mode actions use `ui/IconButton.tsx`: each has an explicit accessible name, a Tooltip and a decorative SVG. The root supplies one delayed Tooltip provider, and hints pass pointer events through to the underlying UI.

| Action                                     | Icon                                                      |
| ------------------------------------------ | --------------------------------------------------------- |
| Source undo / redo                         | Undo2 / Redo2                                             |
| Code / Split / Diagram                     | CodeXml / Columns2 / Network                              |
| New project / Open / Download              | FilePlus2 / FolderOpen / Download                         |
| Apply / discard draft                      | Check / X                                                 |
| Appearance                                 | Palette                                                   |
| New part / connection                      | SquarePlus / Cable                                        |
| Source reveal / reviewed rename / new view | CodeXml / Pencil / Eye                                    |
| Diagram zoom / fit / lock                  | ZoomIn / ZoomOut / Scan / LockKeyhole variants            |
| Panel visibility                           | PanelLeft, PanelRight and PanelBottom open/close variants |
| Panel options / reset layout               | Ellipsis / RotateCcw                                      |

Apply and Download retain visible labels; frequent compact actions retain precise names such as Undo source. CodeMirror draft undo/redo is distinct from accepted source transaction history. Standard editor/search shortcuts are documented in the README; Tab retains focus navigation. Existing kind labels remain visible alongside Explorer icons; those icons do not establish SysML notation support.

[Browser testing](../testing.md) describes verification; [verification](../verification.md) records actual outcomes and remaining gaps. Full tab docking, floating windows and complete accessibility auditing remain separate work. Engine-backed language queries are documented in [source editing and recovery](source-assistance-recovery.md).

## Model ownership tree

`workbench/explorer/model-tree.ts` projects the applied model using recorded `ownerId` relationships. It does not infer ownership from qualified-name prefixes, type references or diagram geometry. The separate Views list owns view navigation; view declarations and their rendering members are omitted from the Model tree. Missing/cyclic ownership is displayed at the top level with a notice, retaining reachable declarations.

`ModelTree.tsx` owns expansion and keyboard focus for the visit. Root packages begin collapsed. Rows show the declaration name and resolved type label, or a human-readable kind when untyped; tooltips retain full identifiers. Deep indentation is bounded, and very narrow trees hide the secondary column while retaining accessible descriptions. Tree layout never changes a source, project, transaction or saved position.

Navigation follows the [WAI-ARIA tree pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): arrows move through visible rows and fold/unfold branches, Home/End reach the visible extremes, typed prefixes find visible names, and Enter/Space select the focused declaration. Focus and selection are separate. One treeitem participates in Tab order; shared focus styling distinguishes it from the inspected row.

Diagram selection opens the selected declaration's owner chain without taking focus from the diagram. A UI request counter handles a second selection of the same symbol after its branch has been folded. These are reveal requests, not semantic revisions or identity reconciliation. Selecting a tree row retains the existing Inspector behavior; source-range reveal still requires diagram correspondence. Expansion is not portable project data or automatic work recovery.

## Entry and session lifetime

The public landing lives at `/`; `/app` starts with a project launcher. Source/diagram panels are created on first successful project opening and remain mounted while the launcher or landing is displayed. Inactive workbench surfaces are hidden and inert, retaining the live source editor, history and camera. Appearance state belongs to one application provider. Modal controls close when their owning route becomes inactive, and focus returns to visible controls or the current route heading. A full browser reload is a new session with an explicit recovery choice.

## Shell code ownership

`Workbench.tsx` retains the live session, project-opening validation, selection and reviewed-command orchestration. `ProjectHeader.tsx` and `SourceToolbar.tsx` render shell controls through explicit callbacks. `projectFiles.ts` owns local bundle construction, file reading and browser download preparation; workspace validation and saved-state tracking retain their existing contracts. Panel controls and preferences remain in `WorkbenchPanels.tsx` and `layout.ts`. Surface CSS is imported through `ui/theme.css`; see the [design-system ownership table](../design-system.md#ownership).
