import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174/graveyard/', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { BASE_PATH: '/graveyard', PORT: '4174' },
    url: 'http://127.0.0.1:4174/graveyard/',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
});
