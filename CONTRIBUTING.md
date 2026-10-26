# Contributing

Start with [current capabilities](docs/capabilities.md), [next steps](docs/next-steps.md), [architecture](docs/architecture/README.md) and the [design system](docs/design-system.md). The immediate goal is a small assembly that can be understood and edited from source or diagram while preserving layout and unrelated source content.

## Get started

Use Node 26.3.1 from `.nvmrc` and npm 11.16.0. Run commands from the repository root:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

The app opens an example project. Try opening a named view, applying source, reviewing a part rename, undoing it, and downloading/reopening the project before changing those workflows. The [README](README.md#development) explains engine preparation, prerequisites and browser setup.

Choose a focused user task with a small, non-sensitive SysML fixture. Bug reports should include the input, reproduction steps, expected and observed behavior, browser and relevant engine versions. For feature work, explain the user workflow and acceptance criteria. Discuss changes to public module interfaces, project formats, engine pins or modeling semantics in an issue before broad implementation. Documentation, accessibility improvements and reproducible bug fixtures are useful contributions too.

## Complete a vertical slice

A semantic command belongs in `workspace/editing/` and follows prepare → transform → validate → check postconditions → accept. Add the engine mapping under its adapter and expose the command through the workbench. Add failure, stale-revision and preservation cases alongside the successful fixture. Diagram, keyboard and property entry points share that command.

A renderer consumes evaluated artifacts and their correspondence. Record unsupported constructs explicitly. Keep symbol geometry separate from source semantics and retain accessible names and keyboard access for controls.

For interface changes, follow the [design system](docs/design-system.md), use the shared shadcn primitives and extend existing semantic tokens. Appearance preferences stay outside model transactions and project files. Review registry updates and new dependencies before adding them.

Keep views understandable: one named-view list, a contextual creation action and advanced settings when needed. Opening an existing view does not require a new declaration. Keep file paths, semantic ownership and graphical nesting distinct.

Preserve unsupported source constructs, comments and unrelated formatting during graphical edits. Use recorded identity/correspondence for source navigation and layout reconciliation; do not infer identity from labels or screen positions. When an engine cannot provide a safe transformation or mapping, retain the source and report the limitation.

Schemas live with the module that owns the contract. Infer the TypeScript data type from its TypeBox schema. Validate unknown input without coercion; enforce semantic relationships in the workspace. Test malformed and future-version input when changing persisted or transported data.

## Review and checks

Use a feature branch and a focused pull request. Run `npm run check`, `npm run build` and browser scenarios appropriate to the change. CI runs these checks against the pinned engines; local success is not evidence that hosted CI passed. Include exact results and skipped checks in the PR template. Keep examples, capabilities and setup instructions consistent with behavior.

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

For an installed Chrome, use `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:e2e -- --project=functional`. Browser tests build current source and exercise the real WASM engines. Visual comparisons use bundled Chromium and reviewed baselines; follow [the browser testing workflow](docs/testing.md) for focused runs and baseline review. Controlled engine responses in unit tests establish workspace behavior, not engine conformance. Run checks appropriate to the change; explain skipped checks, including browser tests for documentation-only changes.

A change is ready for review when its acceptance criteria are demonstrated, affected failure/preservation cases have evidence, documentation matches the behavior, and compatibility effects are recorded. Add regressions for meaningful behavioral changes. For UI changes, check keyboard access, focus, both themes and supported palettes. Describe limitations explicitly rather than implying broader SysML support.

Preserve licenses and provenance for reused source. Dependency additions need maintainer agreement. Use the existing npm lockfile; never bypass peer-dependency resolution or machine package-manager guards.

Preserve unrelated working-tree changes and keep temporary files under ignored `sandbox/`. Use clear Conventional Commit messages and the repository PR template; stage explicit paths. Never include credentials or private models in a contribution.

On DSG-managed checkouts, run `ctxcheck` and inspect Git status before dependency changes, commits, pushes or remote operations. Use the DSG identity and `github.com-dsg` SSH alias. Other contributors should verify their own checkout, identity and remote; they do not need DSG's local context tooling. Commits and pushes require user authorization in agent-assisted sessions.

## Maintainer responsibilities

Maintainers review semantic and format changes, publish release notes, document compatibility and arrange release/security ownership through repository access. This initial foundation does not establish an external governance agreement, upstream acceptance, formal language conformance or a release-support commitment.
