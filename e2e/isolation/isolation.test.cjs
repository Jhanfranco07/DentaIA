"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, copyFileSync, unlinkSync, rmdirSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");

test("NODE_OPTIONS preloads the guard from a path with spaces and blocks outbound TCP", () => {
  const directory = mkdtempSync(join(tmpdir(), "dentaia guard space "));
  const guard = join(directory, "network guard.cjs");
  try {
    copyFileSync(resolve(__dirname, "network-guard.cjs"), guard);
    const script = `const assert=require('node:assert/strict');
      assert.equal(globalThis[Symbol.for('dentaia.e2e.networkGuard')], true);
      assert.throws(() => require('node:net').connect({host:'example.invalid',port:443}), /E2E_NETWORK_BLOCKED/);`;
    const result = spawnSync(process.execPath, ["-e", script], {
      cwd: resolve(__dirname, "../.."), encoding: "utf8", windowsHide: true,
      env: { PATH: process.env.PATH, Path: process.env.Path, SystemRoot: process.env.SystemRoot,
        DENTAIA_E2E_NETWORK_GUARD: "1", NODE_OPTIONS: `--require="${guard.replace(/\\/g, "/")}"` },
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  } finally {
    unlinkSync(guard);
    rmdirSync(directory);
  }
});
