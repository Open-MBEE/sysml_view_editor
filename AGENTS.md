# Contributor instructions

- Use Node from `.nvmrc`, root npm scripts and the existing npm lockfile. Ask before adding production dependencies.
- Read `docs/architecture/README.md` before moving module interfaces or changing transaction flow. Read `docs/architecture/project-format.md` before changing saved data; include compatibility fixtures for format changes.
- Keep `workspace/` independent of React, the DOM, canvas libraries and engine implementations. Construct engine adapters in `workbench/shell/session.ts`; validate transport/persistence data through the owning TypeBox schemas.
- Source owns semantic declarations, view exposure and filters. Presentation owns geometry. Preserve drafts and reject stale or partial semantic proposals.
- For engine changes, read `engine-bridge/README.md`; preserve pins, checksums, notices and provenance. Compare behavior against the real worker contract.
- Run `npm run check`, `npm run build` and relevant browser checks before finalizing. Report actual results and skipped checks. Keep README and capabilities accurate.
- Put temporary files and captures in ignored `sandbox/`. Preserve unrelated changes. Before dependencies, commits, pushes or remote operations, inspect Git status and verify the checkout, Git identity, SSH agent and remote; honor configured local context checks. Commit/push only when requested, on a feature branch, with explicit staged paths and Conventional Commits.

## Frontend testing

- For SysML example additions or changes, follow [the example library workflow](examples/README.md) and retain explicit visualization targets and current gaps.

- Before changing a UI workflow, identify its user-visible success, failure and preservation outcomes; inspect the running app and existing tests before choosing locators. Add focused regressions for meaningful behavior changes.
- Use roles and accessible names for interactions and retrying Playwright assertions for readiness. Use renderer DOM hooks only for diagram identity/geometry that accessible locators cannot express; keep those reads in test helpers. Wait for observable state rather than fixed sleeps.
- Exercise semantic workflows with the actual pinned browser engines. Use controlled responses for workspace rules and explicit failure injection; label their scope and retain at least one real-engine browser path for each supported command.
- Assert the outcome: source and resolved references, intended usage identity, compatible positions after a fresh reopen, undo/redo, and retained drafts on failure. Node counts, successful clicks and screenshots alone do not establish semantic correctness.
- For appearance/layout changes, run the visual project and inspect changed screenshots at desktop/narrow sizes and in both themes. Check keyboard access, dialog focus containment and focus return. Automated checks do not establish complete accessibility.
- Follow [the browser testing workflow](docs/testing.md) for fresh builds, browser selection, visual baselines and failure artifacts. Diagnose application versus test failures from traces before changing expectations. Never skip a failing test, weaken an assertion or update a baseline solely to make a run pass; explain intentional expectation changes and inspect their evidence.
- For an important new regression, demonstrate that its assertion fails when the targeted behavior is broken, then restore the behavior and rerun it. Report exact commands, outcomes, skipped coverage and artifact locations; distinguish local results from hosted CI.
