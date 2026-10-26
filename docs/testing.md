# Browser testing

The functional Playwright project tests the production app with the pinned browser engines. The visual project adds screenshot comparisons in bundled Chromium. Each test has an isolated browser context; the shared fixture fails on uncaught page errors. Failure screenshots, traces and the HTML report go under ignored `sandbox/playwright/`. The validation workflow is configured to upload these as `playwright-evidence` for seven days; local runs do not establish a hosted CI result.

## Run checks

Use Node from `.nvmrc` and the existing npm installation:

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

Playwright builds current source before starting its own preview server. Port 4175 must be available; it deliberately refuses to reuse another server that might serve an older build. The build timeout includes engine preparation; prepare engines separately first if starting from an empty cache.

Run a focused project or scenario during development:

```sh
npm run test:e2e -- --project=functional --grep 'downloads and reopens'
npm run test:e2e -- --project=visual
PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:e2e -- --project=functional
```

The browser-channel override applies only to functional checks. Visual checks always use the Chromium version installed for the locked Playwright version. The checked-in baselines were generated on Linux; use the same OS, browser and fonts for comparisons. Other platforms need separately reviewed baselines, not wider mismatch thresholds. Visual tests fix the viewport, locale, timezone, system theme and reduced-motion preference, and wait for the example diagram and local fonts before capture.

## Example library

The [example catalog](../examples/README.md) supplies independent source projects, per-view engine expectations and visual targets. `npm run test:examples` runs its metadata/inventory/index checks and all library browser scenarios. These scenarios observe the actual worker replies, verify named views and node/relationship multisets, check rendered/partial/unavailable app behavior, and download/reopen exact sources. Unavailable renderers are tested as explicit app behavior rather than skipped. Current diagram PNGs and engine JSON are retained per view under `sandbox/playwright/results/examples-example-library-*/` and attached to the HTML report. These captures record current behavior; they are not visual-comparison baselines or evidence that every listed visual target is satisfied.

## Test outcomes

Write a concrete expected outcome before implementation. Explore the actual UI to choose accessible locators; prefer role/name or label over CSS structure. Keep special renderer coordinate reads in `tests/e2e/support.ts`. Compare model-space positions, since camera fit/zoom can change screen coordinates without changing saved geometry.

Use real engines for supported semantic command acceptance, source application, and save/reopen. Controlled workspace responses remain useful for stale/forged proposals and cancellation. Network failure tests must establish that the injected failure occurred and check retained work plus recovery after removing the fault. A mocked engine result is not evidence of engine conformance.

Visual checks complement source, identity and geometry assertions. Current baselines cover the default palette in light/dark workbenches, expanded Appearance dialogs and nested assembly diagrams, plus a 768 px workbench and dialog. Functional checks exercise all palettes and custom colors, structural containment, physical connector endpoints, keyboard port selection and group/child movement through save/reopen. Full visual parity across every palette and browser is not established. Keyboard checks cover Appearance and inherited-port/source interaction, not the complete editor. Automated accessibility scanning and Firefox/WebKit coverage are not currently configured.

## Investigate failures and review baselines

```sh
npx playwright show-report sandbox/playwright/report
npx playwright show-trace sandbox/playwright/results/<failed-test>/trace.zip
```

Inspect the trace, assertion and screenshot to determine whether the application or test is wrong. Repair the cause and preserve the acceptance criterion. Retries, skipped tests, broader pixel tolerances or baseline replacement do not explain a regression.

For an intentional visual change or a new screenshot, generate only the affected baselines:

```sh
npm run test:e2e -- --project=visual --grep 'workbench and appearance' --update-snapshots
```

Inspect each generated image and available diff before retaining it. Keep expected PNGs alongside the visual spec; transient captures and experiments belong in `sandbox/`. Rerun the affected tests without `--update-snapshots`. Never update snapshots automatically in CI or treat successful baseline generation as a passing comparison.

For a critical regression, demonstrate that the assertion detects a deliberate, bounded fault, restore the original behavior, and rerun. Keep fault experiments isolated from unrelated user edits. Report the injected fault, expected failure and restored passing result without claiming broader coverage.
