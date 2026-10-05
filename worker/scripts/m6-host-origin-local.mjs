import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(here, "..");
const HOST = "127.0.0.1";
const PORT = 8787;
const BASE = `http://${HOST}:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startWrangler() {
  if (process.platform === "win32") {
    return spawn(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", `npm run dev -- --port ${PORT}`],
      {
        cwd: WORKER_DIR,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  }
  return spawn("npm", ["run", "dev", "--", "--port", String(PORT)], {
    cwd: WORKER_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

function request({ method = "GET", hostHeader, origin, body }) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (hostHeader) headers.Host = hostHeader;
    if (origin) headers.Origin = origin;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers.Accept = "application/json, text/event-stream";
      headers["Content-Length"] = Buffer.byteLength(body);
    }
    if (method === "OPTIONS") {
      headers["Access-Control-Request-Method"] = "POST";
      headers["Access-Control-Request-Headers"] = "content-type,mcp-session-id";
    }

    const req = http.request(
      { hostname: HOST, port: PORT, path: "/mcp", method, headers },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { text += chunk; });
        res.on("end", () => resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          text,
        }));
      },
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function waitForHealth() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.status === 200) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("Wrangler nao ficou pronto em 60 s");
}

async function stopTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", `taskkill /PID ${child.pid} /T /F >NUL 2>&1`],
        { windowsHide: true, stdio: "ignore" },
      );
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
    return;
  }

  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  await sleep(300);
  try {
    process.kill(-child.pid, 0);
    process.kill(-child.pid, "SIGKILL");
  } catch {}
}

const initialize = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "deploy-security-client", version: "0.0.0" },
  },
});

const child = startWrangler();
let stdout = "";
let stderr = "";
child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });

try {
  await waitForHealth();
  console.log("HEALTH OK");

  const local = await request({
    method: "POST",
    hostHeader: "127.0.0.1:8787",
    body: initialize,
  });
  if (local.status !== 200) {
    throw new Error(`Host local esperado 200; recebido ${local.status}: ${local.text}`);
  }
  console.log("LOCAL HOST OK");

  // O createMcpHandler aplica proteção adicional contra DNS rebinding:
  // um Origin arbitrário é recusado mesmo quando o cabeçalho CORS está em "*".
  const evilOrigin = await request({
    method: "POST",
    hostHeader: "127.0.0.1:8787",
    origin: "https://attacker.example",
    body: initialize,
  });
  if (evilOrigin.status < 400) {
    throw new Error(`Origin arbitraria deveria ser rejeitada; recebido ${evilOrigin.status}`);
  }
  console.log(`EVIL ORIGIN REJECTED ${evilOrigin.status}`);

  // wrangler dev normaliza o Host para o endereço local antes de entregar o
  // Request ao Worker. A allowlist de hostname é portanto coberta por teste
  // unitário sobre request.url; este E2E mantém apenas os casos que atravessam
  // o runtime local sem normalização (Origin e preflight).
  const preflight = await request({
    method: "OPTIONS",
    hostHeader: "127.0.0.1:8787",
    origin: "https://attacker.example",
  });
  if (preflight.status < 400) {
    throw new Error(`Preflight de Origin arbitraria deveria ser rejeitado; recebido ${preflight.status}`);
  }
  console.log(`EVIL ORIGIN PREFLIGHT REJECTED ${preflight.status}`);

  console.log("WORKER HOST/CORS SECURITY GATE OK");
} finally {
  await stopTree(child);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}
