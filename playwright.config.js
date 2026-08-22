// @ts-check
const { defineConfig } = require('@playwright/test');

// Smoke tests serve the repo with python3 http.server (no build step needed —
// the site is plain static HTML/CSS/JS).
// NOTE: port 8823 — 8765 is claimed by the local AIDEN daemon (aiden.main).
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:8823',
  },
  webServer: {
    command: 'python3 -m http.server 8823 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8823/',
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
});
