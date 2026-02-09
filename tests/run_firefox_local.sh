#!/usr/bin/env bash
set -euo pipefail

# Local-only Firefox test harness
# Requires Node.js, npm, and Firefox

command -v firefox >/dev/null || { echo "ERROR: Firefox is not installed"; exit 1; }
command -v npm >/dev/null || { echo "ERROR: npm is not installed"; exit 1; }

echo "Installing dependencies..."
npm install

echo "Installing Playwright Firefox browser..."
npx playwright install firefox

echo "Running Firefox tests..."
npm run test:firefox

echo "✓ Tests complete. View report with: npx playwright show-report"

