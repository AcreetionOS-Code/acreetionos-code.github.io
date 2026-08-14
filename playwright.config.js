// @ts-check
const { defineConfig } = require('@playwright/test');

// Smoke tests serve the repo with python3 http.server (no build step needed —
// the site is plain static HTML/CSS/JS).
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8765',
  },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8765/',
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
