"use strict";

const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const { resolve } = require("node:path");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { existsSync, readFileSync, unlinkSync } = require("node:fs");

const port = Number(process.env.E2E_PORT ?? "43117");
const url = `http://127.0.0.1:${port}`;

function occupied() {
  return new Promise(resolveResult => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolveResult(true); });
    socket.once("error", () => resolveResult(false));
  });
}

function ready() {
  return new Promise(resolveResult => {
    const request = http.get(url, response => {
      response.resume();
      resolveResult(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.setTimeout(1000, () => request.destroy());
    request.once("error", () => resolveResult(false));
  });
}

function listenerPid() {
  const lines = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], { encoding: "utf8", windowsHide: true }).stdout ?? "";
  for (const line of lines.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns[0] === "TCP" && columns[1] === `127.0.0.1:${port}` && columns[3] === "LISTENING") return Number(columns[4]);
  }
  return null;
}

function stop(child, ownerPid) {
  if (process.platform === "win32") {
    if (ownerPid && ownerPid !== process.pid && listenerPid() === ownerPid) {
      try { process.kill(ownerPid, "SIGKILL"); } catch { /* Already stopped. */ }
    }
    try { child.kill("SIGKILL"); } catch { /* Already stopped. */ }
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already stopped. */ }
  }
}

module.exports = async function globalSetup() {
  if (await occupied()) throw new Error(`E2E port ${port} is already occupied; refusing to reuse a server`);
  const auditFile = join(tmpdir(), `dentaia-e2e-network-${process.pid}-${Date.now()}.log`);
  const ownerFile = join(tmpdir(), `dentaia-e2e-owner-${process.pid}-${Date.now()}.pid`);
  const launchEnv = { DENTAIA_E2E_AUDIT_FILE: auditFile, DENTAIA_E2E_OWNER_FILE: ownerFile };
  for (const name of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "HOME", "COMSPEC", "PATHEXT", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOMEDRIVE", "HOMEPATH"]) {
    if (process.env[name]) launchEnv[name] = process.env[name];
  }
  const child = spawn(process.execPath, [resolve(__dirname, "start-next.cjs"), String(port)], {
    cwd: resolve(__dirname, "../.."), stdio: "ignore", windowsHide: true,
    env: launchEnv,
    detached: process.platform !== "win32",
  });
  const deadline = Date.now() + 120_000;
  let ownerPid = null;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Isolated Next.js exited with code ${child.exitCode}`);
      if (await ready()) {
        ownerPid = existsSync(ownerFile) ? Number(readFileSync(ownerFile, "utf8")) : null;
        if (!Number.isInteger(ownerPid) || ownerPid <= 0 || (process.platform === "win32" && listenerPid() !== ownerPid)) {
          throw new Error("E2E server owner could not be verified");
        }
        return () => {
        stop(child, ownerPid);
        const blocked = existsSync(auditFile) ? readFileSync(auditFile, "utf8").trim().split(/\r?\n/).filter(Boolean) : [];
        if (existsSync(auditFile)) unlinkSync(auditFile);
        if (existsSync(ownerFile)) unlinkSync(ownerFile);
        if (blocked.length) throw new Error(`Next.js attempted ${blocked.length} unauthorized outbound connection(s): ${[...new Set(blocked)].join(", ")}`);
      };
      }
      await new Promise(resolveWait => setTimeout(resolveWait, 250));
    }
    throw new Error("Isolated Next.js did not become ready within 120 seconds");
  } catch (error) {
    stop(child, ownerPid);
    if (existsSync(auditFile)) unlinkSync(auditFile);
    if (existsSync(ownerFile)) unlinkSync(ownerFile);
    throw error;
  }
};
