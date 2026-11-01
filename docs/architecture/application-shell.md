# Application shell and opening a project

Planning draft, 2026-11-01. The agreed exploration model is recorded in [model exploration](model-exploration.md). This document proposes the surrounding entry and workbench experience; it does not describe implemented landing, folder or remote-repository support.

## Product journey

Separate three experiences: learning what the editor does, choosing a project, and working on the model. Use a public introduction followed by a directly accessible app launcher. Returning engineers can enter the app without repeating the introduction.

1. Landing page: concise product explanation, Open app and Try an example, following the earlier workspace’s restrained introduction and startup flow.
2. App launcher: Open local folder or Connect to Flexo, plus Open project file, New project, examples and explicit local recovery when available.
3. Workbench: validate and resolve the selected project, then restore a supported previous context or choose the automatic exploration described in the exploration plan.

Opening the app should not silently open a demo. Trying an example is explicit. Returning users should be able to enter the launcher directly without passing through product messaging. Recent entries are navigation references, not guaranteed backups or live permissions.

## Visual reference and OpenMBEE identity

Use the earlier workspace as the visual and interaction reference. Live inspection confirmed a restrained landing page with a compact header and Open App action, a two-column introduction, supporting getting-started/feedback/license sections, and an in-app “How would you like to start?” chooser. Local captures are retained under ignored `sandbox/shell-reference/`.

Carry forward that hierarchy through the current design system rather than copying the predecessor's component implementations or capability claims. The current application’s shared shadcn/Radix primitives, Geist typography, Lucide icons, appearance tokens and resizable shell remain the implementation foundation.

- Product identity: **OpenMBEE View Editor**, with **SysML v2 modeling workspace** as the descriptor.
- Status: **Sandbox**, consistent with this repository’s stage.
- Landing header/footer and app identity use OpenMBEE branding. Use approved OpenMBEE assets when available rather than inventing a logo.
- Documentation, feedback, source and license links target the current OpenMBEE repository and its actual files.
- Preserve applicable copyright, license and third-party attribution notices. Product branding does not determine legal authorship; do not copy the predecessor’s lineage or license prose without checking this repository’s notices.

Adapt the startup chooser into a clear project launcher. Make local folder and Flexo entry paths explicit, with project-file import, New project and examples available alongside them. Add a remote project/branch chooser only when the remote connection capability exists. Avoid obscuring an already-created empty workbench behind the initial launcher; present it as the app’s starting surface and retain existing work when reopening the launcher.

Keep the workbench’s project identity, persistence actions and exploration controls aligned and separately grouped. The reference already separates Model/Views/Files navigation and scope/representation controls; carry that distinction into the planned exploration experience without adopting unsupported renderer features.

## Local folder path

Choose a folder, identify the supported project sources, validate the complete source set and open the model. Folder access is a user-granted capability. Define project membership and exclusions explicitly before implementing recursive discovery; do not silently truncate projects to the current source limits.

Keep folder-backed editing distinct from importing files or a downloaded project bundle. Current Open imports copies and Download exports a bundle; it does not write changes to an imported folder. A future Save files action must identify exactly which files it writes, require valid write permission, detect external changes and retain work on failed writes. Local recovery remains a separate browser copy.

Permission cancellation or unsupported browser capabilities should leave the launcher/current session intact and offer supported file/project import. A remembered folder may need renewed access. The first folder milestone can be import-only if labeled accurately; direct write-back is a separate implementation gate.

## Flexo path

Connect to a configured service, authenticate as required, choose a project and branch, and resolve the selected branch to a fixed commit before checkout. Display project, branch, checked-out commit and access mode in the workbench. Branch selection identifies a versioned model, not a folder on the user's computer.

Follow the [Flexo integration research](../research/openmbee-flexo-mms.md): prove unchanged semantic interchange and repository identity preservation, then deliver read-only checkout before shared-branch write-back. A remote graph may have no original source files; distinguish generated authoring text from original files. Do not present reconstructed text as a faithful recovered folder.

A later Publish changes action reviews semantic changes relative to the checked-out commit and requires server-enforced stale-head rejection. Authentication failures, moved branches, failed conversions and ambiguous publication outcomes must retain local work. Selecting a remote source does not imply immediate write access or automatic publication.

## Workbench shell

Use the existing shadcn/Radix controls, Geist typography, Lucide icons, appearance tokens and light/dark themes. Aim for a quiet engineering workspace: neutral surfaces, restrained accent, readable boundaries and compact labeled controls. Keep product messaging on the landing page.

- App bar: project switcher/name, source context (folder, imported project or remote project/branch), clear persistence action and appearance/account actions where relevant.
- Navigation: model hierarchy and named views, with source files as an independent authoring navigation tool. Remote checkouts must identify generated sources appropriately.
- Exploration header: visible scope and representation choices, separate from source-file tabs and application layout modes.
- Main area: diagram, source or split arrangement using the existing resizable shell.
- Inspector: contextual selection details and supported actions.
- Issues/status: diagnostics and operation feedback, with applied/draft state distinct from saved/downloaded/published state. Browser recovery must not be reported as a disk save or remote commit.

Keep contextual actions near the content they affect. Opening a project belongs to the app shell; choosing Structure belongs to the diagram context; Apply source belongs to the source transaction controls. Avoid a single crowded row mixing navigation, semantic changes, presentation tools and persistence.

## Implementation sequence

1. Review the journey and screen hierarchy; produce landing, launcher and workbench wireframes using the existing design system.
2. Add a launcher around current New/Open project/example/recovery capabilities. Retain the current workspace during cancelled or failed replacement, and preserve focus when returning from dialogs or the launcher.
3. Implement the first read-only automatic exploration slice. Keep scope/representation visible and source navigation independent.
4. Add folder import with explicit membership, permissions, source limits and fallback behavior; implement file write-back only after preservation and concurrency requirements are satisfied.
5. Prove remote interchange and introduce read-only project/branch checkout. Enable reviewed publishing only after identity and server concurrency gates pass.
6. Define validated recent-project and browsing-context persistence without changing portable formats implicitly.

The desired launcher can have local and remote entry paths, but shipped controls must reflect available capabilities. Do not expose a working-looking remote connector or save action before its underlying contract is implemented.

## Review questions

- What is the smallest useful folder-opening scope within current source limits, and when should direct file saving ship?
- Which Flexo deployment/authentication contract is the first integration target?

The public landing/direct app entry direction and OpenMBEE identity are agreed. Resolve the remaining integration questions when their implementation slice becomes concrete, rather than requiring every answer before planning the shell.

## Session scope and wireframes

This session delivers the entry experience and shell around existing capabilities. Automatic exploration receives a pinned-engine contract investigation; implementing that new projection contract, direct folder saving and Flexo connectivity are subsequent milestones. The existing named-view renderer remains the working diagram path in this slice.

Design direction: preserve the reference hierarchy, with variance 4/10, motion 1/10 and density 4/10 on entry screens, increasing to the established engineering density inside the workbench. Shared theme tokens and shadcn components apply throughout. Use a typographic OpenMBEE identity until approved brand assets are supplied.

```text
LANDING
OpenMBEE View Editor                       Appearance  Open app
----------------------------------------------------------------
OpenMBEE                 Write SysML. Explore your system.
View Editor              Local source, named views, reviewed edits.
SysML v2 workspace       Try an example
----------------------------------------------------------------
Start with a model       Sandbox status       Documentation / notices
```

```text
PROJECT LAUNCHER
OpenMBEE View Editor                       Appearance  Local recovery
----------------------------------------------------------------
Open a project                           [Resume project, if present]
Load example           New project           Open files or project
Built-in model         Empty source project   SysML files / project bundle
----------------------------------------------------------------
Folder write-back and Flexo checkout remain planned capabilities.
Existing recovery: explicit Restore / Discard. Errors remain visible here.
```

```text
WORKBENCH
OpenMBEE  Projects | Project name / source context        Download project
----------------------------------------------------------------
Source history         Apply / Discard draft            Code / Split / Diagram
----------------------------------------------------------------
Explorer         Source document | Named view / representation      Inspector
Model / Views    Independent source and diagram navigation          Selection
Files            Resizable panes and contextual diagram controls
----------------------------------------------------------------
Issues          Applied / draft feedback          Local recovery / revision
```

Success means the landing and launcher never start an example implicitly. Opening/replacing a project validates source before switching; cancellation and failure retain the current project, draft, history, selection, camera and compatible layout. Returning to the launcher or landing and back keeps the live workbench session mounted. Full reload intentionally returns to the launcher, offering existing browser recovery explicitly. Browser Back/Forward and direct app links must behave consistently with that lifecycle.

Verification covers desktop/narrow light/dark captures of all three surfaces, keyboard focus and dialog containment/return, actual-engine project opening and semantic regressions, plus a deliberate fault proving an important preservation assertion. Existing application tests will explicitly choose their example fixture rather than depend on implicit startup behavior.
