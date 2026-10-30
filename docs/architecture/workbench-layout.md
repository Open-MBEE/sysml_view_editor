# Workbench panels and action icons

The workbench composes owned shadcn Resizable, Tooltip and Popover primitives around the existing editor components. `react-resizable-panels` is pinned to 4.14.8; Tooltip and Popover use the existing Radix dependency. The registry sources and retained MIT notices define provenance. The older `sysml_ide` supplies interaction examples; its PaneForge/Dockview application shell is not imported.

## Panel behavior

Explorer and Inspector resize beside the central editor. Source and Diagram share an adjustable divider in Split mode. Below 900 px the editor split becomes vertical. Issues is a separate, resizable bottom dock. Defaults collapse Inspector on a fresh narrow viewport; an edge rail can reopen it. Header options offer Narrow/Widen or Shorter/Taller without dragging, and Workspace layout offers source/diagram share controls and Reset layout.

Each side panel remembers its expanded percentage through collapse and restore. Pixel minimums keep Explorer (145 px), Inspector (190 px) and Issues (96 px) usable; side panels are capped at 420 px and Issues at 60%. The source/diagram panes have horizontal minimums of 160 px for Source and 200 px for Diagram, or 100 px vertically, and their divider cannot collapse an editor while Split mode is selected. The library applies constraints against available space. On screens below 600 px, explicitly opening one side tool collapses the other.

Dividers have accessible names and library-provided pointer/keyboard behavior. They remain registered in the layout when a tool collapses: removing a divider from layout can invalidate its association with the neighboring panels. The source/diagram divider is disabled outside Split mode. Hidden contents remain mounted and inert, keeping draft text and component state out of keyboard navigation.

Explicit collapse moves focus to the corresponding visible edge-rail reopen control. Explicit reopen returns focus to the panel's collapse button, after the restored content is no longer hidden/inert. New diagnostic/error text opens Issues without taking editor focus. A user can close and reopen that dock independently.

The canvas waits for measured dimensions and initialized nodes before fitting. Explicit Code/Split/Diagram mode changes refit the available diagram, retaining the previous workflow. Dragging dividers or collapsing side tools does not repeatedly fit or arrange nodes, so the user's camera and saved model-space coordinates survive those changes.

## Preferences and preservation

`workbench/shell/layout.ts` owns a closed TypeBox schema for `sysml-workbench-layout-v1`. It stores version 1, the last expanded side/dock percentages, the source split share and tool collapse flags. Values are bounded; invalid, unknown, oversized or incompatible records fall back to defaults. No document text or semantic identifiers enter these preferences.

Reads and writes tolerate blocked browser storage. A failed save retains the live layout for the visit and reports the failure under Workspace layout. Reset applies responsive defaults. Preferences are specific to a browser origin; they are not part of the portable project.

Panel changes do not invoke workspace transactions, reparse source, alter diagram geometry, mark the project modified or add undo history. Source and Diagram remain mounted through mode changes. Project bundles retain their existing version-1 format and still require download to preserve source/drafts across reloads; remembering panel preferences is not work recovery.

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

Apply and Download retain visible labels; frequent compact actions retain precise names such as Undo source. Native text-area undo is distinct from accepted source transaction history. No new undo keyboard binding or unimplemented shortcut hint is introduced. Existing kind labels remain visible alongside Explorer icons; those icons do not establish SysML notation support.

[Browser testing](../testing.md) describes verification; [verification](../verification.md) records actual outcomes and remaining gaps. Full tab docking, floating windows, editor-language assistance and complete accessibility certification remain separate work.
