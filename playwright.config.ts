import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'sandbox/playwright/results',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'sandbox/playwright/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'functional',
      testIgnore: '**/visual.spec.ts',
      use: { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL },
    },
    {
      name: 'visual',
      testMatch: '**/visual.spec.ts',
      // Baselines use Playwright's bundled Chromium, including when functional
      // checks use a locally installed browser through the channel override.
      use: {
        browserName: 'chromium',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        locale: 'en-US',
        timezoneId: 'UTC',
      },
    },
  ],
  webServer: {
    command:
      'npm run build && npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
