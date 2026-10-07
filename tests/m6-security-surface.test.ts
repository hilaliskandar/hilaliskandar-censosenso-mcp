import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/server.js";

const EXTERNAL_CONTRACT_TOOLS = new Set(["search", "fetch"]);

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "m6-security-audit", version: "0.1.0" });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

describe("M6 — schema/runtime trust boundary", () => {
  it("declara a superfície CensoSenso como leitura, idempotente e open-world", async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools();
      const own = tools.filter((tool) => !EXTERNAL_CONTRACT_TOOLS.has(tool.name));

      expect(own).toHaveLength(22);
      for (const tool of own) {
        expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
        expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
        expect(tool.annotations?.idempotentHint, tool.name).toBe(true);
        expect(tool.annotations?.openWorldHint, tool.name).toBe(true);
      }
    });
  });

  it("anuncia additionalProperties=false em todas as 22 tools de domínio", async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools();
      const own = tools.filter((tool) => !EXTERNAL_CONTRACT_TOOLS.has(tool.name));

      for (const tool of own) {
        expect(tool.inputSchema?.additionalProperties, tool.name).toBe(false);
      }
    });
  });

  it("rejeita parâmetro sentinela não anunciado antes de executar a tool", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "ibge_estados",
        arguments: { __m6_hidden: "exfiltrate" },
      });

      expect(result.isError).toBe(true);
      const text = (result.content ?? [])
        .map((item) => (item.type === "text" ? item.text : ""))
        .join("\n");
      expect(text).toContain("__m6_hidden");
      expect(text).toMatch(/Unrecognized key|Invalid arguments/i);
    });
  });

  it("caracteriza search/fetch como contrato externo menos estrito", async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools();
      for (const name of ["search", "fetch"]) {
        const tool = tools.find((item) => item.name === name);
        expect(tool, name).toBeDefined();
        expect(tool?.inputSchema?.additionalProperties, name).toBeUndefined();
        expect(tool?.annotations?.readOnlyHint, name).toBe(true);
        expect(tool?.annotations?.destructiveHint, name).toBe(false);
      }
    });
  });

  it("não anuncia sampling capability no baseline do servidor", async () => {
    await withClient(async (client) => {
      const caps = client.getServerCapabilities();
      expect(caps?.sampling).toBeUndefined();
    });
  });
});
