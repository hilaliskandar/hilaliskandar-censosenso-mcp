import { spawn } from "node:child_process";
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
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `npm run dev -- --port ${PORT}`], {
      cwd: WORKER_DIR,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  return spawn("npm", ["run", "dev", "--", "--port", String(PORT)], {
    cwd: WORKER_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
}

async function waitForHealth() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.status === 200) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("Wrangler nao ficou pronto em 60 s");
}

async function postRpc(body, session) {
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  if (session) headers["mcp-session-id"] = session;
  return fetch(`${BASE}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const child = startWrangler();
let stdout = "";
let stderr = "";
child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });

try {
  await waitForHealth();
  console.log("HEALTH OK");

  const initResponse = await postRpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "deploy-gate-client", version: "0.0.0" },
    },
  });

  if (initResponse.status !== 200) {
    throw new Error(`initialize retornou HTTP ${initResponse.status}: ${await initResponse.text()}`);
  }
  const initText = await initResponse.text();
  if (!initText.includes("censosenso-mcp")) throw new Error("initialize nao anunciou censosenso-mcp");
  const session = initResponse.headers.get("mcp-session-id");
  if (!session) throw new Error("initialize nao retornou mcp-session-id");
  console.log("INITIALIZE OK");

  const initialized = await postRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, session);
  if (![200, 202].includes(initialized.status)) {
    throw new Error(`notifications/initialized retornou HTTP ${initialized.status}`);
  }
  console.log("INITIALIZED NOTIFICATION OK");

  const listResponse = await postRpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, session);
  if (listResponse.status !== 200) throw new Error(`tools/list retornou HTTP ${listResponse.status}`);
  const listText = await listResponse.text();
  for (const tool of ["ibge_cidades", "ibge_sidra", "ibge_geocodigo"]) {
    if (!listText.includes(tool)) throw new Error(`tools/list nao contem ${tool}`);
  }

  console.log("TOOLS/LIST OK");
  console.log("HTTP E2E DEPLOY GATE OK");
} finally {
  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `taskkill /PID ${child.pid} /T /F >NUL 2>&1`], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
  } else if (child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
    await sleep(300);
    try {
      process.kill(-child.pid, 0);
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}
