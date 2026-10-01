import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: a fresh server (empty state, demo accounts on) and the Vite dev client.
 *   npm run test:e2e          (first time: npx playwright install chromium)
 * The server listens on 8180 and the client on 8181, so a running dev setup on 8080/8081 is not touched.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8181',
    trace: 'retain-on-failure',
    viewport: { width: 1366, height: 900 }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } }],
  webServer: [
    {
      command: 'node e2e/start-server.mjs',
      url: 'http://localhost:8180/health',
      timeout: 120_000,
      reuseExistingServer: false
    },
    {
      command: 'npx vite --port 8181 --strictPort',
      url: 'http://localhost:8181',
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_API_URL: 'http://localhost:8180' }
    }
  ]
});
