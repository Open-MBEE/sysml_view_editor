# OpenMBEE View Editor design specification

This is the design source for the OpenMBEE View Editor redesign in Stitch. Preserve the existing OpenMBEE identity. Layout and component recommendations below are proposed product design decisions, not additional official OpenMBEE brand rules. Existing theme tokens and assets are authoritative when this document and generated output disagree.

## Purpose and character

The product is primarily a visual aid for exploring and navigating SysML models, with occasional editing. The model is the main content. Use calm, readable, muted engineering UI: white surfaces, dark blue text, restrained cyan selection, subtle card grouping and thin dividers. Avoid both decorative dashboard styling and excessively tiny IDE controls.

## Brand identity: required

- Product name: **OpenMBEE View Editor**. Preserve capitalization.
- Brand dark blue: `#10052F`. This is a very dark blue with a purple appearance; do not replace it with electric violet.
- Brand light blue: `#64DDFA`. Use sparingly, primarily in small accents and pale selected surfaces.
- Brand grey: `#D6D6D6`. Use for light-theme borders and separators, not body text on white.
- Typeface: **ABeeZee Regular**, with a system sans-serif fallback.
- Official brand reference: https://www.openmbee.org/brand.html
- Brand terms: https://www.openmbee.org/licenses.html . The name and logo are excluded from the site's general Apache/CC BY licenses. Do not assert a CC BY grant for these marks.

### Logo assets

Use the existing SVG bytes. Do not redraw, generate, recolour, distort, or replace the mark with hexagons, cubes or another geometric icon.

| Context          | Repository asset                      | Absolute URL for Stitch                                             |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------- |
| Light background | `static/brand/openmbee-icon-dark.svg` | https://dsg-sysml-workspace.vercel.app/brand/openmbee-icon-dark.svg |
| Dark background  | `static/brand/openmbee-icon.svg`      | https://dsg-sysml-workspace.vercel.app/brand/openmbee-icon.svg      |

Display the icon around 24px high, preserve its aspect ratio and leave breathing room. Pair it with the existing OpenMBEE / View Editor text treatment. The header home link has an accessible product name; a decorative icon inside it has empty alternative text. If an asset cannot load, retain the product text and report the missing asset rather than inventing a logo.

## Typography

Use ABeeZee for all interface labels, tabs, buttons, cards, body text, headings and diagram labels. Do not substitute Plus Jakarta Sans, serif fonts or another design-system font. The application includes only ABeeZee Regular 400, Latin subset; browsers synthesize heavier emphasis. Do not claim that a native ABeeZee semibold/bold file is included.

```css
@font-face {
  font-family: 'ABeeZee';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('https://dsg-sysml-workspace.vercel.app/fonts/abeezee/abeezee-latin-400-normal.woff2')
    format('woff2');
}
:root {
  font-family:
    'ABeeZee',
    system-ui,
    -apple-system,
    sans-serif;
  font-synthesis: weight;
  --sysml-font-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
}
```

Use the monospace stack only for source, line numbers and technical strings that benefit from fixed spacing. Keep ordinary diagram names in ABeeZee. Proposed desktop scale: 16–18px project/element title, 14px controls and body, 12–13px metadata and compact tabs, 13px source. These are design targets, not a claim about current application sizes. Use weight, spacing and placement to establish hierarchy; do not make every heading oversized or bold. Essential information must remain readable.

## Existing colour tokens

These values are copied from `src/lib/ui/tokens.css` and `controls.css`. Use semantic roles instead of assigning colours independently to components.

| Role                   | Light                 | Dark                  |
| ---------------------- | --------------------- | --------------------- |
| Surface                | `#FFFFFF`             | `#1B1139`             |
| Subtle surface         | `#F6F6F8`             | `#251B45`             |
| Canvas                 | `#FAFAFC`             | `#10052F`             |
| Text                   | `#10052F`             | `#F1F1F4`             |
| Secondary text         | `#4E4764`             | `#D6D6D6`             |
| Border                 | `#D6D6D6`             | `#5A5270`             |
| Diagram stroke         | `#10052F`             | `#D6D6D6`             |
| Primary accent         | `#10052F`             | `#64DDFA`             |
| Text on primary accent | `#FFFFFF`             | `#10052F`             |
| Selected surface       | `#E0F8FE`             | `#1D3F5C`             |
| Selected text          | `#10052F`             | `#C9F3FD`             |
| Grid                   | `#D6D6D6`             | `#3A3155`             |
| Success                | `#247254`             | `#9BC8AC`             |
| Information            | `#0B6F8F`             | `#64DDFA`             |
| Error text / surface   | `#B91C1C` / `#FEF2F2` | `#FCA5A5` / `#451E27` |
| Warning text / surface | `#92400E` / `#FFFBEB` | `#FDE68A` / `#3D301C` |
| Warning border         | `#D97706`             | `#D4A64B`             |

Light mode is the initial Stitch design target. Dark mode must use its complete token mapping, not an inverted light screenshot. Retain existing user-selectable palettes; this redesign does not remove them.

### Colour discipline and cards

- White header in light mode. No dark banner, gradients, neon purple, glow, or saturated cyan blocks.
- Neutral panel backgrounds with white cards. Use existing selected surface `#E0F8FE` for active navigation, with a small accent edge and a non-colour selection indicator.
- Card tint is quiet and local: a small icon tile, thin accent edge or faint header treatment. Do not colour the entire sidebar or every card differently.
- Model-kind colours identify kind, not validity. Existing light roles: source `#6D3AC6`, structure `#087C91`, behavior `#B65016`, states `#9B3590`, sequence `#3754BC`, requirements `#247254`, entities `#126F79`, parameters `#8B6110`. Use in small labelled badges or icons, not large text/background fields.
- A green requirement-kind badge does not mean the requirement is satisfied. Warning/error colours indicate actual corresponding states, never decoration.
- Existing muted diagram palette: package `#EDF1F5`, definition `#EAF1FC`, usage `#E9F4EF`, input port `#E3EFFF`, output port `#FFF3D6`, inout port `#E2F3F2`. Retain labels/shapes as well as colours. Do not make all ports cyan when direction is relevant.

## Implemented hierarchy refinement

The Explorer uses faint category-tinted headings and counts of files, view declarations, documents and indexed model elements. Model counts include collapsed descendants. Package icon tiles use a source-colour tint; definition and usage tiles use the existing palette surfaces. Labels and selection edges remain meaningful without colour.

The workspace title names the active tab, above representation controls. Applied/draft status remains separate and subdued. Inspection gives the selected element a larger title and a readable kind badge; technical identities remain available in the summary. Declared attribute expressions appear immediately in quiet value cards. Declaration/provider metadata is expandable within each card, and source navigation remains guarded by draft/source availability. These expressions are authored values, not evaluated results.

### Navigation follow-up

The current workspace still combines opened-content tabs, a named-view selector and representation buttons. User review identified this as redundant. The proposed follow-up is Explorer for discovering content, one workspace tab strip for opened diagrams/project-wide requirements/traceability/documents, and a compact action toolbar. This simplification is not part of the colour refinement above.

## Layout proposal: four available panels

Default viewing shows a compact navigator and a generous model workspace. Four panels can be opened deliberately; four panels are not mandatory on every visit.

1. **Left Explorer:** Files / Views / Documents / Model independently collapsible sections, retaining the existing ownership tree and separate navigation actions. No duplicate permanent activity rail.
2. **Main workspace:** document tabs for open diagrams, requirements tables, traceability matrices and documents. Breadcrumbs support navigation. The canvas receives the largest area.
3. **Right source:** the existing source editor with file tabs and explicit draft/applied status. Closed by default. Keep draft/history/language commands local to this panel.
4. **Bottom inspection:** Properties / Relationships / Issues tabs below the centre workspace only. Closed by default. Group identity, attributes and relationships compactly; selection updates content without forcing the panel open.

Compact application header: official branding, project identity, existing file operations and independent panel controls. A consolidated project menu and model search remain future refinements; do not display nonfunctional controls. Do not add repository branch, commit, deployment or cloud collaboration chrome without an actual product requirement.

### Panel controls and interaction

- Three consistently positioned top-right toggles represent left Explorer, bottom inspection and right source. Their icons reflect placement; pressed state reflects visibility.
- Each supporting panel has Close and Maximize/Restore controls. Visible divider handles allow resizing. Remember widths, heights and open state.
- Focus mode hides supporting panels and restores the previous arrangement when exited.
- Tabs choose content; panel controls choose placement and visibility. Changing tabs must not discard source drafts, selections or document state.
- Opening/closing panels preserves canvas zoom and position; Fit remains an explicit action. Do not automatically recenter on every toggle.
- Below 900px, source stacks beneath the central workspace and Explorer yields space while source is open. Preserve mounted content and provide minimum editor space, scrolling and maximise controls. Restore focus to visible controls on close. Modal overlays, when present, contain keyboard focus.
- Icon-only actions require accessible names, tooltips and visible keyboard focus. Define shortcuts deliberately; do not invent labels for unimplemented shortcuts.

## Component geometry and hierarchy

Existing spacing scale: 4, 8, 12, 16 and 24px. Existing control radius: 6px. Existing focus width: 2px, with 2px outline offset. Use 1px separators and restrained shadows only for floating surfaces. Proposed panel widths are approximately 220–260px navigator and 280–400px source, subject to available space; these are not fixed requirements. Target 28–32px compact controls and 32–36px navigation rows while maintaining usable hit targets.

Primary actions use the accent and on-accent token pair. Routine controls are quiet ghost/outline buttons. Disabled actions remain recognizable and must be disabled semantically, not merely faded. Active tabs use a clear line or shape in addition to colour. Cards group related information; do not wrap every individual property in its own decorative box.

Diagram nodes use clear names, subdued type labels, consistent attribute rows, readable connectors and labelled port direction. Distinguish selection from hover, focus, warnings and pending edits. Preserve source-owned semantics and presentation-owned geometry.

## Honest content and states

Use the inspection rover as illustrative model content: battery : Battery, capacityWh 480, reservePercent 20, distribution, mobility, controller and lidar. Illustrative values are not evidence of execution.

- Preserve explicit draft versus applied revision communication.
- Preserve the previous applied model and source drafts when application fails or times out.
- Distinguish declared satisfy/verify relationships from computed verification results.
- Never invent “Linked & Validated”, “constraints satisfied”, “PDR Approved”, engine success, approval, author, timestamps, branch/commit metadata or governance evidence.
- A badge reading Source applied is source-application status, not proof that all requirements are satisfied.
- Empty, loading and failure states must have useful text and an appropriate next action. Generated concepts must be marked Concept preview.

## Stitch generation contract

This document supersedes the auto-generated “OpenMBEE Engineering Workbench” style guide where it conflicts. Do not inherit its substituted logo, Plus Jakarta Sans, generated hexagon asset, additional activity rail, repository strip, extreme density or invented validation/governance claims.

Use the official SVG and ABeeZee WOFF2 URL directly in generated HTML. If Stitch's structured font enum cannot represent ABeeZee, preserve `ABeeZee` in custom font-family/CSS and report the limitation; an unrelated enum is not approval to substitute the font. Do not silently regenerate the logo when URL loading fails.

Before accepting a generated screen, check the logo asset, actual font CSS, exact palette, muted surfaces, panel/tab arrangement, visible controls, source state and absence of fabricated claims. A picture alone does not establish working resize/toggle behaviour or accessibility.

## Provenance

Existing brand and implementation evidence: `static/brand/README.md`, `static/fonts/abeezee/README.md`, `src/lib/ui/controls.css`, `src/lib/ui/tokens.css`, and `docs/research/openmbee-brand-review.md`. ABeeZee font distribution is Fontsource 5.3.0, SIL OFL 1.1; retained local license is `static/fonts/abeezee/LICENSE`. Layout proposals reflect the design discussion on 2026-11-23. No application implementation or deployment is implied by this specification.
