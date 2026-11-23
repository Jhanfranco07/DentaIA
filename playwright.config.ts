import { defineConfig, devices } from "playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import fixtures from "./e2e/isolation/fixtures.json";

const port = Number(process.env.E2E_PORT ?? "43117");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("E2E_PORT inválido");
const baseURL = `http://127.0.0.1:${port}`;
const browserEnv: Record<string, string> = {};
for (const name of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"]) {
  if (process.env[name]) browserEnv[name] = process.env[name];
}
const browserLog = join(tmpdir(), `dentaia-chrome-${process.pid}.log`);
browserEnv.CHROME_LOG_FILE = browserLog;

export default defineConfig({
  testDir: "./e2e/public",
  globalSetup: "./e2e/isolation/global-setup.cjs",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    serviceWorkers: "block",
    // A dead local proxy also catches browser redirects that bypass route handlers.
    proxy: { server: fixtures.supabaseUrl, bypass: "127.0.0.1,localhost" },
    launchOptions: { env: browserEnv, args: [`--log-file=${browserLog}`, "--disable-logging"] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
