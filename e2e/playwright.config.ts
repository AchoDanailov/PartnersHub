import { defineConfig, devices } from '@playwright/test'

const ci = !!process.env.CI

// Runs against the local Supabase stack with the Edge Functions served (see CONTRIBUTING.md).
// Playwright starts the web dev server, or reuses one already running outside CI.
// Vite reads VITE_* from web/.env.local, or from the environment (CI).
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm --prefix ../web run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !ci,
  },
})
