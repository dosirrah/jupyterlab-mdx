import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright-tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:8888'
  },
  webServer: {
    command: 'docker compose up',
    url: 'http://127.0.0.1:8888/lab',
    reuseExistingServer: true,
    timeout: 120_000
  }
});

