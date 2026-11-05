# Application shell

Current implementation, updated 2026-11-01. The application uses the shared Geist/Lucide/shadcn controls and appearance tokens. Product identity is **OpenMBEE View Editor**, at **Sandbox** stage; legal and third-party attribution remains in the repository notices.

## Entry and opening

- `/` presents the product, documentation/feedback/license links, **Open app** and **Try an example**.
- `/app` starts an empty launcher with **Load example**, **New project**, **Open files or project** and **Local recovery**. An existing live session adds **Resume project**.
- `/app/?example=1` requests the example once and is canonicalized to `/app` before opening; reload does not repeat the example action. Static hosting must serve the SPA fallback for `/app` while preserving asset paths.

No model loads implicitly. The built-in example opens its pneumatic named view in Diagram mode. New projects open source with a temporary project overview and remain modified until downloaded. Imports without named views also open an overview; imports with named views retain their existing selection. Imports are copies; Download exports a portable bundle. Recovery is a separate browser copy, not a disk save.

Applied source is validated before replacing the project. Replacing dirty work requires confirmation. Cancelled or failed replacement retains current source, drafts, model, history and compatible presentations. Failed operations remain visible and can be retried.

## Session and focus

The workbench is created on entry, but source/diagram panels mount only after a successful opening. Once opened, they remain mounted while the launcher or landing is displayed; hidden surfaces are inert. Home, Resume and browser Back/Forward retain the live source editor/selection, history, Inspector selection, camera and diagram positions. A full reload creates a new session and offers stored recovery explicitly; it does not restore session history or camera.

One appearance provider owns preferences across all surfaces. Dialogs close when their owning surface becomes inactive; focus returns to a visible trigger or the current heading/workspace. The workbench Save shortcut is active only while the workspace is visible and ready. Unsaved-work unload protection remains active while internal navigation hides the workspace.

## Workbench grouping

The app bar groups product/home navigation, Projects, project name/origin and persistence/settings actions. Source transaction history, apply/discard and Code/Split/Diagram controls use the measured toolbar layout. Sidebar toggles belong to their tools. The diagram header selects an actual **Named view** or **Explore model**. Exploration has separate scope and representation controls, uses applied source, and disables graphical authoring/movement. Named views retain their supported representation, applied/draft status and authoring actions. Source-file selection does not replace the diagram scope.

See [layout contracts](workbench-layout.md), [source/recovery policies](source-assistance-recovery.md) and [project format](project-format.md). [Testing](../testing.md) and [verification](../verification.md) own checks and observed results.

## Future opening workflows

These are capability gates, not shipped controls:

| Workflow                | Required before delivery                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatic exploration   | Validated read-only projection with scope/representation independent of files and authored views; see the [exploration plan](model-exploration.md)                                      |
| Local folder import     | Explicit membership/exclusions/limits, permission handling and file-import fallback                                                                                                     |
| Folder write-back       | Exact write set, permissions, external-change detection and preservation on failure                                                                                                     |
| Flexo project/branch    | Select a deployment/auth flow, prove interchange/identity, resolve branch to immutable commit and label generated source; see [integration research](../research/openmbee-flexo-mms.md) |
| Remote publication      | Reviewed change set, repository identity retention, server-enforced concurrency and ambiguous-outcome recovery                                                                          |
| Recent projects/context | Validated persistence, permission renewal and schema compatibility; navigation references are not backups                                                                               |

The [roadmap](../next-steps.md) defines the next sequence. Resolve folder scope and Flexo deployment/authentication when their implementation slices begin.
