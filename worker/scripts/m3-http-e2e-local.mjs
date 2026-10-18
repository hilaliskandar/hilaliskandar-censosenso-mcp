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
  const initPayload = JSON.parse(initText.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).at(-1) || initText);
  if (initPayload?.result?.protocolVersion !== "2025-11-25") {
    throw new Error(`initialize: versao de protocolo inesperada ${initPayload?.result?.protocolVersion}`);
  }
  if (!initPayload.result?.serverInfo?.name || !initPayload.result?.capabilities) {
    throw new Error("initialize: serverInfo/capabilities ausentes");
  }
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

  // Verificacao explicita da superficie de recursos, modelos e prompts MCP.
  // As respostas Streamable HTTP podem ser JSON simples ou eventos SSE.
  function readRpcPayload(text) {
    const chunks = text.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
    return JSON.parse(chunks.length ? chunks[chunks.length - 1] : text);
  }
  for (const [method, key, expected] of [
    ["tools/list", "tools", 24],
    ["resources/list", "resources", 5],
    ["prompts/list", "prompts", 2],
  ]) {
    const response = await postRpc({ jsonrpc: "2.0", id: 40 + expected, method, params: {} }, session);
    if (response.status !== 200) throw new Error(`${method} retornou HTTP ${response.status}`);
    const payload = readRpcPayload(await response.text());
    if (!Array.isArray(payload.result?.[key]) || payload.result[key].length !== expected) {
      throw new Error(`${method}: esperado ${expected} entradas, recebido ${payload.result?.[key]?.length}`);
    }
    if (payload.result.nextCursor !== undefined) throw new Error(`${method}: nextCursor inesperado`);
    console.log(`${method.toUpperCase()} OK (${expected})`);
  }

  // Nenhuma lista e paginada, portanto o cursor arbitrario deve ser recusado
  // com JSON-RPC -32602 pela borda HTTP antes de chegar ao SDK.
  for (const method of ["tools/list", "resources/list", "resources/templates/list", "prompts/list"]) {
    const response = await postRpc({
      jsonrpc: "2.0", id: 90, method, params: { cursor: "cursor-inexistente" },
    }, session);
    const payload = readRpcPayload(await response.text());
    if (payload.error?.code !== -32602) {
      throw new Error(`${method}: cursor invalido deveria retornar -32602`);
    }
  }
  console.log("CURSORES INVALIDOS OK (-32602)");

  // Conferir o conteudo real dos catalogos MCP, nao apenas sua listagem.
  for (const [name, count] of [["ufs", 27], ["regioes", 5], ["biomas", 6], ["niveis-territoriais", null], ["tabelas-sidra", null]]) {
    const uri = `ibge://catalogos/${name}`;
    const response = await postRpc({
      jsonrpc: "2.0", id: 110, method: "resources/read", params: { uri },
    }, session);
    if (response.status !== 200) throw new Error(`resources/read ${name}: HTTP ${response.status}`);
    const result = readRpcPayload(await response.text()).result;
    const content = result?.contents?.[0];
    if (content?.uri !== uri || content?.mimeType !== "application/json") {
      throw new Error(`resources/read ${name}: metadados invalidos`);
    }
    const catalog = JSON.parse(content.text);
    if (!Array.isArray(catalog) || catalog.length === 0 || (count !== null && catalog.length !== count)) {
      throw new Error(`resources/read ${name}: esperado ${count} itens`);
    }
  }
  console.log("RESOURCES/READ OK (cinco catalogos)");

  // Testar expansao de prompts: nomes e argumentos conferidos contra registro.
  for (const [name, args, needle] of [
    ["comparar-municipios", { localidades: "3509502,3550308", indicador: "populacao_censo" }, "ibge_comparar"],
    ["perfil-demografico", { localidade: "Campinas" }, "ibge_censo"],
  ]) {
    const response = await postRpc({
      jsonrpc: "2.0", id: 120, method: "prompts/get", params: { name, arguments: args },
    }, session);
    if (response.status !== 200) throw new Error(`prompts/get ${name}: HTTP ${response.status}`);
    const result = readRpcPayload(await response.text()).result;
    if (result?.messages?.[0]?.role !== "user" ||
        !result.messages[0].content?.text?.includes(needle)) {
      throw new Error(`prompts/get ${name}: mensagem ausente ou incorreta`);
    }
  }
  console.log("PROMPTS/GET OK (comparar e perfil)");

  // Consultas invalidas nao podem ser respondidas como recursos ou prompts validos.
  for (const [method, params] of [
    ["resources/read", { uri: "ibge://catalogos/inexistente" }],
    ["prompts/get", { name: "prompt-inexistente", arguments: {} }],
    ["tools/call", { name: "ferramenta-inexistente", arguments: {} }],
  ]) {
    const response = await postRpc({ jsonrpc: "2.0", id: 130, method, params }, session);
    const payload = readRpcPayload(await response.text());
    if (!payload.error && !payload.result?.isError) {
      throw new Error(`${method}: nome ou URI inexistente deveria produzir erro MCP`);
    }
  }
  console.log("ERROS MCP OK (recurso, prompt e tool inexistentes)");

  // Repor tokens apos leitura dos cinco catalogos e chamadas anteriores.
  await sleep(5000);

  // O SDK deve rejeitar argumentos de tipos incompatíveis e preservar o
  // contrato de resposta estruturada para uma chamada válida sem rede externa.
  const invalido = await postRpc({
    jsonrpc: "2.0", id: 140, method: "tools/call",
    params: { name: "ibge_estados", arguments: { regiao: 12345 } },
  }, session);
  const invalidPayload = readRpcPayload(await invalido.text());
  if (!invalidPayload.error && !invalidPayload.result?.isError) {
    throw new Error("tools/call: argumento com tipo incorreto nao foi recusado");
  }
  const valido = await postRpc({
    jsonrpc: "2.0", id: 141, method: "tools/call",
    params: { name: "ibge_estados", arguments: { regiao: "SE" } },
  }, session);
  if (valido.status !== 200) throw new Error(`tools/call estados: HTTP ${valido.status}`);
  const payloadValido = readRpcPayload(await valido.text()).result;
  if (payloadValido?.isError || !payloadValido?.structuredContent?.provenance?.source_url ||
      !Array.isArray(payloadValido?.structuredContent?.attribution) ||
      !payloadValido?.content?.some((item) => item.type === "text")) {
    throw new Error("tools/call estados: canais de resposta e proveniencia inconsistentes");
  }
  console.log("TOOLS/CALL OK (validacao de entrada e resposta estruturada)");

  // Métodos JSON-RPC desconhecidos devem produzir falha de método, não sucesso.
  // Um descanso anterior evita falsos positivos por HTTP 429.
  await sleep(5000);
  const desconhecido = await postRpc({
    jsonrpc: "2.0", id: 155, method: "censosenso/metodo-inexistente", params: {},
  }, session);
  const desconhecidoPayload = readRpcPayload(await desconhecido.text());
  if (desconhecidoPayload.error?.code !== -32601) {
    throw new Error("Metodo JSON-RPC desconhecido deveria retornar -32601");
  }
  console.log("METODO JSON-RPC INEXISTENTE OK (-32601)");

  // Isolar o transporte HTTP de corpos malformados: usar fetch com texto cru.
  // A fronteira deve recusar JSON sintaticamente inválido; nao pressupor que
  // a resposta seja necessariamente JSON quando o status HTTP e de erro.
  await sleep(3000);
  const malformed = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": session,
    },
    body: '{"jsonrpc":"2.0","id":160,"method":"tools/list",',
  });
  const malformedText = await malformed.text();
  if (malformed.status < 400) {
    let rejected = false;
    try {
      const payload = readRpcPayload(malformedText);
      rejected = Boolean(payload?.error && typeof payload.error.code === "number");
    } catch {}
    if (!rejected) throw new Error("JSON malformado aceito sem erro de protocolo");
  }
  console.log("JSON MALFORMADO REJEITADO");



  // A negociacao deve aceitar os tipos previstos no cliente MCP Streamable HTTP.
  // Verificar somente um cabeçalho de resposta compativel, sem exigir JSON
  // quando o servidor escolhe o transporte de eventos SSE.
  const negociacao = await postRpc({
    jsonrpc: "2.0", id: 156, method: "tools/list", params: {},
  }, session);
  const tipo = negociacao.headers.get("content-type") || "";
  if (negociacao.status !== 200 ||
      !(tipo.includes("application/json") || tipo.includes("text/event-stream"))) {
    throw new Error(`Resposta MCP com status/tipo incompativel: ${negociacao.status} ${tipo}`);
  }
  console.log("NEGOCIACAO CONTENT-TYPE OK");

  // Verificar comportamento de cabecalhos no transporte Streamable HTTP.
  // Delimitar a afirmacao ao que o servidor realmente retorna; sem tolerar 429.
  await sleep(4000);
  const requisicaoComVersao = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": session,
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 170, method: "tools/list", params: {} }),
  });
  const respostaVersao = await requisicaoComVersao.text();
  if (requisicaoComVersao.status !== 200 ||
      !Array.isArray(readRpcPayload(respostaVersao).result?.tools)) {
    throw new Error(`MCP-Protocol-Version valido recusado: HTTP ${requisicaoComVersao.status}`);
  }
  console.log("MCP-PROTOCOL-VERSION VALIDO OK");

  // Aceitar apenas JSON ou SSE no contrato; um Accept de midia nao suportada
  // nao deve produzir um falso sucesso contendo uma lista de ferramentas.
  const acceptInvalido = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "image/png",
      "mcp-session-id": session,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 171, method: "tools/list", params: {} }),
  });
  const acceptTexto = await acceptInvalido.text();
  if (acceptInvalido.status === 429) throw new Error("Teste Accept mascarado pelo rate limit");
  if (acceptInvalido.status < 400) {
    let erro = false;
    try { erro = Boolean(readRpcPayload(acceptTexto).error); } catch {}
    if (!erro) throw new Error("Accept incompatível retornou sucesso de tools/list");
  }
  console.log("ACCEPT INCOMPATIVEL REJEITADO");

  // Corpo JSON correto mas Content-Type incorreto nao pode ser tratado como
  // chamada MCP valida. 429 indica interferencia do rate limit e invalida a prova.
  await sleep(4000);
  const wrongType = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      Accept: "application/json, text/event-stream",
      "mcp-session-id": session,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 175, method: "tools/list", params: {} }),
  });
  const wrongText = await wrongType.text();
  if (wrongType.status === 429) throw new Error("Content-Type: teste mascarado por rate limit");
  if (wrongType.status < 400) {
    let errorResponse = false;
    try { errorResponse = Boolean(readRpcPayload(wrongText).error); } catch {}
    if (!errorResponse) throw new Error("Content-Type text/plain aceito como tools/list valido");
  }
  console.log("CONTENT-TYPE INCORRETO REJEITADO");

  // A bateria agora ultrapassa o burst por cliente (20 requisicoes, reposicao 5/s).
  // Repor tokens antes da prova de concorrencia evita 429 esperado por excesso
  // de chamadas no proprio teste, sem desativar a protecao do Worker.
  await sleep(5000);

  // SDK MCP >=2.3: um transporte stateless nao pode ser reutilizado entre
  // requisicoes. Exigir sucesso tanto em chamadas consecutivas quanto simultaneas.
  const sequencial = await postRpc(
    { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} },
    session,
  );
  if (sequencial.status !== 200 || !(await sequencial.text()).includes("ibge_estados")) {
    throw new Error("SDK HTTP falhou ao atender segunda chamada tools/list sequencial");
  }

  const simultaneas = await Promise.all(
    [4, 5, 6].map((id) =>
      postRpc({ jsonrpc: "2.0", id, method: "tools/list", params: {} }, session),
    ),
  );
  for (const [index, response] of simultaneas.entries()) {
    const body = await response.text();
    if (response.status !== 200 || !body.includes("ibge_estados")) {
      throw new Error(`SDK HTTP falhou na chamada concorrente ${index + 1}: ${response.status}`);
    }
  }
  console.log("HTTP SEQUENCIAL E CONCORRENTE OK");
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
