// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // run sequentially — tests share auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Give API calls time to complete (ByteCrtrs calls can be slow)
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Consumer SPA — talks to mock server + BC IIFE proxy
    {
      name: 'consumer',
      testIgnore: /\/admin\//,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
    },
    // Admin SPA — separate parcel build at port 3003 with basename /csr.
    // Tests mock /api/* with page.route() so no real backend needed.
    {
      name: 'admin',
      testMatch: /\/admin\/.*\.spec\.js$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3003',
      },
    },
  ],

  // Start mock server, consumer parcel, admin parcel before running tests
  webServer: [
    {
      command: 'node server/index.js',
      url: 'http://localhost:3001/api/v1/health',
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: 'npx parcel public/index.html --port 3000 --no-cache',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Admin parcel — admin.html is the entry, served at root on port 3003.
      // BrowserRouter basename="/csr" means React routes are /csr/login etc.
      command: 'npx parcel public/admin.html --port 3003 --no-cache',
      url: 'http://localhost:3003',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
