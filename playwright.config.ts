import { defineConfig, devices } from "playwright/test";

const port = Number(process.env.E2E_PORT ?? "43117");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("E2E_PORT inválido");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e/public",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${process.platform === "win32" ? "npm.cmd" : "npm"} run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "e2e-public-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "",
      DENTAIA_SMILE_API_URL: "",
      DENTAIA_SMILE_PRODUCTION_ENABLED: "false",
      DENTAIA_SMILE_PREVIEW_ENABLED: "false",
      OPENAI_API_KEY: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      STRIPE_SECRET_KEY: "",
    },
  },
});
