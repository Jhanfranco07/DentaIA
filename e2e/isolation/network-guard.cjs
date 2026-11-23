"use strict";

// Preloaded by every Next.js Node process in the public E2E run.
if (process.env.DENTAIA_E2E_NETWORK_GUARD !== "1") {
  throw new Error("E2E network guard was loaded without the isolated launcher");
}

const net = require("node:net");
const dgram = require("node:dgram");
const tls = require("node:tls");
const dns = require("node:dns");
const { appendFileSync } = require("node:fs");
globalThis[Symbol.for("dentaia.e2e.networkGuard")] = true;

// Record the PID of the process that actually binds the dedicated test port.
// Teardown may terminate only that process, never an arbitrary later listener.
const originalListen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const requestedPort = typeof args[0] === "object" ? args[0]?.port : args[0];
  const requestedHost = typeof args[0] === "object" ? args[0]?.host : args[1];
  if (Number(requestedPort) === Number(process.env.DENTAIA_E2E_PORT)
      && (requestedHost === "127.0.0.1" || requestedHost === "localhost")
      && process.env.DENTAIA_E2E_OWNER_FILE) {
    this.once("listening", () => {
      require("node:fs").writeFileSync(process.env.DENTAIA_E2E_OWNER_FILE, String(process.pid));
    });
  }
  return originalListen.apply(this, args);
};

function local(host) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}

function assertLocal(host) {
  if (!local(host)) {
    if (process.env.DENTAIA_E2E_AUDIT_FILE) appendFileSync(process.env.DENTAIA_E2E_AUDIT_FILE, `${String(host)}\n`);
    throw new Error(`E2E_NETWORK_BLOCKED: ${String(host)}`);
  }
}

const originalConnect = net.Socket.prototype.connect;
function checkConnect(args) {
  const first = args[0];
  const options = first && typeof first === "object" ? first :
    typeof first === "number" ? { port: first, host: typeof args[1] === "string" ? args[1] : args[1]?.host ?? args[1]?.hostname ?? "localhost" } : first;
  // Named pipes are local IPC; TCP must name an allowed loopback host.
  if (options && typeof options === "object" && !options.path) assertLocal(options.host ?? options.hostname ?? "localhost");
}
net.Socket.prototype.connect = function (...args) {
  checkConnect(args);
  return originalConnect.apply(this, args);
};
for (const name of ["connect", "createConnection"]) {
  const original = net[name];
  net[name] = function (...args) {
    checkConnect(args);
    return original.apply(this, args);
  };
}
const originalTlsConnect = tls.connect;
tls.connect = function (...args) {
  checkConnect(args);
  return originalTlsConnect.apply(this, args);
};

const originalSend = dgram.Socket.prototype.send;
dgram.Socket.prototype.send = function (...args) {
  const address = args.findLast(value => typeof value === "string");
  if (address) assertLocal(address);
  return originalSend.apply(this, args);
};
const originalDgramConnect = dgram.Socket.prototype.connect;
dgram.Socket.prototype.connect = function (...args) {
  const address = args.findLast(value => typeof value === "string") ?? "localhost";
  assertLocal(address);
  return originalDgramConnect.apply(this, args);
};

for (const name of ["lookup", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCname", "resolveMx", "resolveNs", "resolveTxt", "resolveSrv"]) {
  const original = dns[name];
  if (!original) continue;
  dns[name] = function (host, ...rest) {
    assertLocal(host);
    return original.call(this, host, ...rest);
  };
  if (dns.promises[name]) {
    const originalPromise = dns.promises[name];
    dns.promises[name] = function (host, ...rest) {
      assertLocal(host);
      return originalPromise.call(this, host, ...rest);
    };
  }
}

const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = new URL(input instanceof URL ? input.href : typeof input === "string" ? input : input.url);
  if (url.href === "https://registry.npmjs.org/-/package/next/dist-tags") {
    // Next dev checks its own version. Answer locally so it never contacts npm.
    const version = require("next/package.json").version;
    return Promise.resolve(new Response(JSON.stringify({ latest: version, canary: version }), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
  }
  assertLocal(url.hostname);
  return originalFetch(input, init);
};

module.exports = { assertLocal };
