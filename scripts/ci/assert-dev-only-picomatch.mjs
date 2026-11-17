import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"));
const runtimeDeps = { ...manifest.dependencies, ...manifest.optionalDependencies };
if (Object.hasOwn(runtimeDeps, "picomatch")) {
  console.error("SECURITY FAILURE: picomatch must not be a production dependency while GHSA-fc5q-39xc-vjpf remains unpatched.");
  process.exitCode = 1;
}
const entries = Object.entries(lock.packages || {}).filter(([path]) =>
  path === "node_modules/picomatch" || path.endsWith("/node_modules/picomatch"));
if (!entries.length) {
  console.log("No locked picomatch dependency detected.");
} else {
  for (const [path, pkg] of entries) {
    if (pkg.dev !== true) {
      console.error(`SECURITY FAILURE: ${path}@${pkg.version || "unknown"} is not dev-only.`);
      process.exitCode = 1;
    } else {
      console.log(`Guard verified: ${path}@${pkg.version || "unknown"} is dev-only (advisory remains open).`);
    }
  }
}
