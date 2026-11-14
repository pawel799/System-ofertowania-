/*
 * Testy E2E (e2e/*.spec.ts) na zbudowanej stronie: `npm run build`, potem `npm run test:e2e`.
 * Strona i funkcje jak na Cloudflare (wrangler pages dev, lokalne KV), poczta – atrapa (e2e/atrapa-poczty.mjs).
 * W CI: .github/workflows/testy.yml (przed wdrożeniem).
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;
const POCZTA = 8799;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    launchOptions: { args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    { command: "node e2e/atrapa-poczty.mjs", url: `http://localhost:${POCZTA}/`, reuseExistingServer: !process.env.CI },
    {
      command: [
        `npx wrangler pages dev out --kv OFFERS --r2 MODELS --port ${PORT} --persist-to .wrangler/e2e --compatibility-date=2026-10-23`,
        `--binding MAIL_API_URL=http://localhost:${POCZTA}/emails --binding MAIL_API_KEY=test`,
        "--binding NOTIFY_EMAIL=wlasciciel@test.pl --binding CRON_SECRET=sekret-e2e --binding PANEL_TOKEN=admin-e2e",
      ].join(" "),
      url: `http://localhost:${PORT}/`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
