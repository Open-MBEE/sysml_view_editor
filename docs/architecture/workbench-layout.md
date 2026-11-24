# Workbench panels and action icons

The workbench composes owned shadcn Resizable, Tooltip and Popover primitives around the existing editor components. `react-resizable-panels` is pinned to 4.14.8; Tooltip and Popover use the existing Radix dependency. The registry sources and retained MIT notices define provenance. The older `sysml_ide` supplies interaction examples; its PaneForge/Dockview application shell is not imported.

## Panel behavior

The model-first shell places Explorer on the left, Source on the right and inspection below the central model workspace. Bottom tabs select Properties, Relationships or Issues. The default is Explorer plus model; source and inspection open on demand. The existing Source only / Source + Model / Model only modes remain supported. Below 900px Source stacks below the central workspace and Explorer yields space while source is open.

Independent header controls toggle each supporting panel. Focus model and panel maximise/restore are temporary layouts, separate from saved normal sizes/visibility. Close returns focus to the visible corresponding toggle. Explicit requirement inspection opens Properties; ordinary tree/diagram selection only updates the selection. New diagnostics open Issues without intentionally moving keyboard focus. File selection and guarded Open source reveal Source. Explicit reveal requests are consumed within their project surface; replacing a project does not replay earlier Source/inspection requests.

The existing resizable-panel library supplies pointer and keyboard resizing with larger hit areas than the 1px visible divider. Hidden content remains mounted and inert. The shell owns no semantic transactions. Panel transitions preserve draft/editor lifetime and camera; Fit view and Read at 100% remain explicit camera actions. Initial diagram fitting still applies on a newly evaluated view without a retained session camera. Revisiting a model tab restores its camera under that diagram identity and applied model hash. Geometry remains in the existing presentation owner.

## Preferences and preservation

`layout.ts` validates closed version-2 records under `sysml-workbench-layout-v2`: Explorer/source/bottom sizes, visibility flags and the bottom tab. Supported version-1 records are validated and migrated conservatively; the old Inspector width is not reinterpreted as a bottom height. Invalid/unknown/oversized data falls back to model-first defaults. Failed writes retain live preferences and show a warning in Workspace layout. No model identifiers or source enter layout preferences, project bundles or recovery through this change.

Workspace tab descriptors and back/forward history are session-local and use existing view/document/exploration identities. Navigation goes through the workspace's current revision checks; failed requests retain the existing displayed work. Table/matrix representations remain project-wide. Each exploration scope has one tab; changing its view type updates that tab rather than opening an identical second tab. Camera caches remain keyed by full scope/representation identity. Model selection remains shared. Table filters and table/document scrolling are not snapshotted per tab and can reset when their surface remounts. Closing the final tab is disabled; closing any other tab activates a surviving one before removing the active descriptor. Source tabs retain drafts even when closed. Project replacement clears both tab lists and per-project editor/camera state.

## Source editor

`workbench/source/SourceEditor.tsx` owns one CodeMirror 6 view, caching per-file EditorState and scroll position for source tabs. A cached state is restored only when its exact raw draft text still matches; external replacements start fresh state. Successful project replacement creates a new editor session. The stream language supplies lexical keyword/comment/string/number coloring and brace indentation; engine parsing, diagnostics and semantic edits retain their existing owners. Shared theme roles style highlighting, gutters, selections and the built-in search panel. Semantic completion, hover, definition navigation, formatting and syntax-aware folding are not supplied by this lexical mode.

Local text changes update workspace drafts. Busy operations reconfigure editing access without replacing the view or local history. File tabs restore their own matching editor state; externally replaced text starts fresh state so undo cannot revive discarded work or another file's edits. The view itself stays mounted through resizing and editor-mode changes. Source reveal translates raw UTF-16 positions to CodeMirror's LF-based positions, including CRLF and Unicode. Text edits retain untouched line separators, including mixed endings; inserted lines use the file's first separator. Portable sources, drafts, geometry and the version-1 project format retain their existing schemas and ownership.

## Toolbar ownership

`WorkspaceToolbar` contains `ArrangementSelector` and the independent panel/focus/layout controls. Source only, Source + Model and Model only retain the internal `code`, `split` and `diagram` states. The mutually pressed arrangement controls are centered in their global bar, independent of the active Diagram/table/matrix representation. `ModelPaneHeader` composes model history, contextual diagram controls and pending-draft/busy/rendering notices. One workspace tab strip selects opened diagrams, project data and documents; the adjacent picker opens additional content. Arrangement remains independent of active content.

`SourcePaneHeader` lives inside SourceEditor and receives the existing source transaction callbacks from Workbench. It shows the active filename, a per-file draft badge, source undo/redo, workspace source status and labeled Apply/Discard actions. The badge compares that file's draft and applied text; a different file's draft can keep the workspace status pending without marking the active file. SourceEditor supplies its own Find references/Format source actions through a header composition callback; its CodeMirror instance and source-assistance ownership remain unchanged.

Source actions become hidden/inert with Source in Model-only mode. Showing Source makes them reachable; arrangement changes never apply or discard. The existing diagram metadata continues to distinguish the applied model from pending drafts. Source history and action groups align inside the actual pane and wrap at constrained pane widths, so global toolbar alignment no longer measures Explorer/Inspector pixel widths. The right Source pane has a 280px desktop minimum; narrow layouts stack it vertically with a 240px minimum. Panel constraints remain subject to the available viewport.

Supporting panels retain local collapse/maximise controls and reopen from the persistent header toggles. Broader responsive/accessibility integration remains [#44](https://github.com/Open-MBEE/sysml_view_editor/issues/44). See the [redesign plan](../design/redesign-implementation-plan.md) for phased scope and preservation gates.

## Model header and renderer lifetime

`ModelPaneHeader` uses the existing Workbench `dataMode` and transaction handlers. `DiagramTargetControls` owns the scope breadcrumb chooser, exploration view-type focus, named-view kind metadata and contextual authoring buttons. It is composed once into the header; Diagram no longer renders a competing target header. Its controls remain mounted but hidden/inert for tables/matrices, preserving exploration focus refs without exposing diagram-only controls.

The Diagram renderer remains at its existing stable position/key and is hidden for data representations. Its layout, camera, selection, asynchronous arranging/failure reporting and canvas Fit/100%/lock controls remain renderer-owned. `supportsDiagram` shares the original UI capability gate with the header: an evaluated engine artifact can still have no renderer here, as with sequence views. Busy status distinguishes work in progress from the applied revision still being displayed; unapplied drafts do not imply a new rendered model.

Tables/matrices are explicitly labeled Project-wide requirements. Their search, sorting, filters, CSV export, loading/error/retry and guarded inspection remain owned by RequirementsPanel. Workspace tabs, model navigation and the Model header share one bounded native scroll area when the Model pane is deliberately reduced, retaining room for canvas controls. Representation and target controls remain keyboard reachable. The broader responsive/assistive-technology integration remains #44.

## Icons and controls

Lucide icons use the shared shadcn Button sizes, theme roles and focus indicators. Compact history and mode actions use `ui/IconButton.tsx`: each has an explicit accessible name, a Tooltip and a decorative SVG. The root supplies one delayed Tooltip provider, and hints pass pointer events through to the underlying UI.

| Action                                     | Icon                                           |
| ------------------------------------------ | ---------------------------------------------- |
| Source undo / redo                         | Undo2 / Redo2                                  |
| Source only / Source + Model / Model only  | CodeXml / Columns2 / Layers                    |
| New project / Open / Download              | FilePlus2 / FolderOpen / Download              |
| Apply / discard draft                      | Check / X                                      |
| Appearance                                 | Palette                                        |
| New part / connection                      | SquarePlus / Cable                             |
| Source reveal / reviewed rename / new view | CodeXml / Pencil / Eye                         |
| Diagram zoom / fit / lock                  | ZoomIn / ZoomOut / Scan / LockKeyhole variants |
| Panel visibility                           | PanelLeft / PanelRight / PanelBottom           |
| Panel options / reset layout               | PanelsTopLeft / RotateCcw                      |

Apply and Download retain visible labels; frequent compact actions retain precise names such as Undo source. CodeMirror draft undo/redo is distinct from accepted source transaction history. Standard editor/search shortcuts are documented in the README; Tab retains focus navigation. Existing kind labels remain visible alongside Explorer icons; those icons do not establish SysML notation support.

[Browser testing](../testing.md) describes verification; [verification](../verification.md) records actual outcomes and remaining gaps. Full tab docking, floating windows and complete accessibility auditing remain separate work. Engine-backed language queries are documented in [source editing and recovery](source-assistance-recovery.md).

## Model ownership tree

`workbench/explorer/model-tree.ts` projects the applied model using recorded `ownerId` relationships. It does not infer ownership from qualified-name prefixes, type references or diagram geometry. The separate Views list owns view navigation; view declarations and their rendering members are omitted from the Model tree. Missing/cyclic ownership is displayed at the top level with a notice, retaining reachable declarations.

`ModelTree.tsx` owns expansion and keyboard focus for the visit. Root packages begin collapsed. Rows show the declaration name and resolved type label, or a human-readable kind when untyped; tooltips retain full identifiers. Deep indentation is bounded, and very narrow trees hide the secondary column while retaining accessible descriptions. Tree layout never changes a source, project, transaction or saved position.

Navigation follows the [WAI-ARIA tree pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): arrows move through visible rows and fold/unfold branches, Home/End reach the visible extremes, typed prefixes find visible names, and Enter/Space select the focused declaration. Focus and selection are separate. One treeitem participates in Tab order; shared focus styling distinguishes it from the inspected row.

ExplorerSection owns independent session-only Files/Views/Documents/Model disclosure state. Section bodies stay mounted while hidden/inert, preserving tree expansion and focus state. New view and tree-wide actions are separate header targets. Header panel controls replace the separate activity rail. The source/model arrangement selector remains independent of representation.

Diagram selection opens the Model section and the selected declaration's owner chain without taking focus from the diagram. A UI request counter handles a second selection of the same symbol after its branch has been folded. These are reveal requests, not semantic revisions or identity reconciliation. Selecting a tree row updates inspection content without opening the bottom dock; source-range reveal still requires diagram correspondence. Expansion is not portable project data or automatic work recovery.

## Entry and session lifetime

The public landing lives at `/`; `/app` starts with a project launcher. Source/diagram panels are created on first successful project opening and remain mounted while the launcher or landing is displayed. Inactive workbench surfaces are hidden and inert, retaining the live source editor, history and camera. Appearance state belongs to one application provider. Modal controls close when their owning route becomes inactive, and focus returns to visible controls or the current route heading. A full browser reload is a new session with an explicit recovery choice.

## Shell code ownership

`Workbench.tsx` retains the live session, project-opening validation, selection and reviewed-command orchestration. `ProjectHeader.tsx`, `WorkspaceToolbar.tsx`, `SourcePaneHeader.tsx` and `ModelPaneHeader.tsx` render shell controls through explicit callbacks. `projectFiles.ts` owns local bundle construction, file reading and browser download preparation; workspace validation and saved-state tracking retain their existing contracts. Panel controls and preferences remain in `WorkbenchPanels.tsx` and `layout.ts`. Surface CSS is imported through `ui/theme.css`; see the [design-system ownership table](../design-system.md#ownership).

## Responsive and accessibility integration

Controls wrap inside their panels; the app header gains a second row at phone widths. Inspection and content tabs support arrow/Home/End focus navigation. Hidden panels, sections and inactive bottom tabs remain inert. Focus and selection remain separate; forced-colour and reduced-motion behaviour retain shared theme rules. Bottom content scrolls when larger details do not fit the available height. When an explicit inspection request opens the dock at narrow widths, keyboard focus moves to its close control after panel resizing; this prevents focus remaining on a table row clipped by the smaller model pane. Desktop inspection preserves the calling control’s focus.

`model-first-layout.spec.ts` exercises editor/draft/camera preservation, explicit inspection, keyboard tab navigation, source-file undo across tabs, workspace history, and light/dark desktop/narrow captures. The verification record distinguishes the full visual/critical gate from additional focused checks. These results are not a complete accessibility certification.

## Generated document integration

Documents is an independent Explorer section using the same mounted disclosure behavior. Documents open workspace tabs through Explorer or the shared content picker. ModelPaneHeader shows contextual actions and applied/draft status; it hides diagram targets for data/document tabs without changing arrangement or the active source file/view. The document pane renders applied-source content and retains explicit guarded source reveal. Embedded diagrams use read-only previews with the same source-value validation context as named views; Open as named view is a separate action.

Source acceptance, undo and redo independently refresh the selected document even if the separate diagram refresh fails. Document progress and transport failures are visible, and newer actions suppress obsolete refresh work. Document data is derived session state and does not enter the portable project or layout preference schema.

## Workspace navigation controls

Explorer discovers named views and documents; the workspace has one strip for opened content. The adjacent **Open workspace tab** (+) popover provides project-wide Requirements/Traceability and lists named views/documents when Explorer is hidden. Activation uses the same revision-aware `activateTab` path as existing tabs. Choosing content focuses the active tab after it is registered; Escape closes the picker and returns focus to its trigger. The picker is disabled during model work. It does not author declarations or alter panel visibility.

The persistent named-view dropdown, representation-button row and repeated visible workspace title are removed. A compact contextual toolbar retains model history, a Project overview home action, conditional Explore selection, pending-draft/update/rendering notices, Inspect and guarded structural editing actions. Exploration shows one wrapping, fully qualified scope breadcrumb with an on-demand chooser and one view-type selector. The scope summary, duplicate ownership-view caption, permanent Scope/Representation field labels and healthy Applied model notice are removed. Project data remains project-wide; table/matrix tabs do not claim to render the active named view. Changing representation within the same scope refreshes the current history descriptor without discarding forward entries, so Back restores the representation last visited. Temporary browsing state remains outside portable project data.
