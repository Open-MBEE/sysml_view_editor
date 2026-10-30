# Workbench design system

The React workbench carries forward the previous editor's appearance system. The visual language is maintained separately from the workspace and engine modules.

## Ownership

| File                                | Responsibility                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/lib/ui/tokens.css`             | Shared `--sysml-*` roles, spacing, light/dark themes and six palettes adapted from the previous editor |
| `src/lib/ui/shadcn.css`             | Tailwind integration and mapping shadcn roles onto those same tokens                                   |
| `src/lib/ui/primitives/`            | Owned React component sources from the official shadcn registry; Radix supplies dialog/slot behavior   |
| `src/lib/ui/controls.css`           | Self-hosted Geist typography, shared focus and forced-color rules                                      |
| `src/lib/ui/appearance.ts`          | Framework-independent preference validation, storage helpers and safe custom-color blending            |
| `src/lib/ui/AppearanceSettings.tsx` | Browser storage, system-theme subscription and appearance controls                                     |
| `src/lib/ui/Dialog.tsx`             | Shared controlled modal composition and focus return for workbench actions                             |
| `src/lib/ui/theme.css`              | Workbench arrangement and panel/diagram styling                                                        |

Use the installed shadcn primitives for new controls. The Button defaults to compact `sm` sizing with 12 px labels; callers choose an explicit variant. Do not introduce competing button styles or independent palette stores. Component sources are owned code: review registry updates rather than overwriting local changes blindly.

## Visual rules

- Use Geist for interface text and the shared monospace stack for source, identifiers and technical values. The bundled Geist asset covers Latin normal weights; other characters fall back to system fonts.
- Use the 4/8/12/16/24 px spacing scale for related controls and sections. Keep dense engineering content readable and advanced options behind explicit disclosure.
- Keep surfaces, model-kind fills, interaction state and status separate. Components consume role variables rather than palette-specific hex values.
- Use Lucide for interface actions. Model notation remains the responsibility of the diagram adapter, with visible kind text; interface icons do not establish SysML notation support.
- Selection and keyboard focus use outlines as well as color. Status needs text. Honor reduced motion and forced colors.
- Symbol movement changes presentation. A tint, theme or palette never changes semantic ownership, typing or validity.

## Appearance behavior

Light with Muted element colors is the fresh-browser default. Dark and Follow system are independent of the six palettes: Neutral, Muted, High contrast, Forest, Blueprint blue and Warm paper. Follow system reacts to operating-system changes while selected. Explicit Light/Dark overrides the system.

Preferences use the existing `sysml-appearance-v1` browser key and parser. This preserves compatible preferences when hosted on the same origin; a different origin does not share storage. Invalid fields fall back independently. Denied reads use defaults; failed writes retain settings for the visit and show a message.

Muted base colors can be customized for packages, part definitions and part usages, and reset. Existing direction-specific port preferences are retained by the parser, but port color controls remain unavailable until detailed port rendering exists. Color changes produce blended fills; readable text/border roles remain controlled by the theme.

The current graph adapter maps exact engine notation kinds `package`, `part def` and `part` to palette roles. Other kinds keep neutral surfaces and their engine kind label. Detailed notation, custom connection routing and compound elements remain documented limits.

Appearance is a user preference. It does not enter project bundles, mark projects modified, reparse source or add model undo history. Source application reconciles compatible presentation mappings according to the workspace contract; appearance never invokes reconciliation or changes geometry.

## Registry workflow

`components.json` configures the official React registry and local aliases. The shadcn MCP server can inspect components, usage examples and installation commands; it is development tooling and is not bundled into the app. It was already available in the development session; this repository does not modify personal MCP configuration.

After reviewing an item and its dependency changes, add only the controls needed for a concrete workflow:

```sh
npx shadcn@latest add @shadcn/button @shadcn/dialog @shadcn/input @shadcn/native-select
```

Run the repository context checks before dependency changes and follow its dependency approval rule. Review resulting sources, retain license notices, and run the regular checks and affected browser scenarios. Installation follows the [official Vite setup](https://ui.shadcn.com/docs/installation/vite); registry discovery follows the [official MCP documentation](https://ui.shadcn.com/docs/mcp).

This is a working foundation, not a claim of complete keyboard/screen-reader certification or parity with every previous control. Menus, command palette, tooltips, tree navigation and broader SysML notation should be added with the workflows that need them.
