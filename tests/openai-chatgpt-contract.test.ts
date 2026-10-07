import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/server.js";

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
};

describe("compatibilidade OpenAI/ChatGPT do MCP", () => {
  let client: Client;
  let instructions: string | undefined;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "openai-contract-test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    instructions = client.getInstructions();
  });

  afterAll(async () => {
    await client.close();
  });

  it("handshake publica instructions úteis logo no início", () => {
    expect(instructions).toBeTruthy();
    const inicio = (instructions ?? "").slice(0, 512);
    expect(inicio).toContain("dados oficiais do IBGE");
    expect(inicio).toContain("ibge_cidades");
    expect(inicio).toContain("ibge_censo");
  });

  it("todas as ferramentas têm título, descrição, esquema de entrada e saída", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(24);

    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema, tool.name).toBeTruthy();
      expect(tool.outputSchema, `${tool.name} sem outputSchema`).toBeTruthy();
    }
  });

  it("todas as ferramentas anunciam corretamente leitura e ausência de destruição", async () => {
    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
      expect(tool.annotations?.idempotentHint, tool.name).toBe(true);
    }
  });

  it("search e fetch existem e publicam o contrato estrutural esperado pela OpenAI", async () => {
    const { tools } = await client.listTools();
    const search = tools.find((t) => t.name === "search");
    const fetch = tools.find((t) => t.name === "fetch");

    expect(search).toBeDefined();
    expect(fetch).toBeDefined();

    const s = search?.outputSchema as JsonSchema;
    expect(s?.type).toBe("object");
    expect(s?.properties?.results).toBeDefined();

    const f = fetch?.outputSchema as JsonSchema;
    expect(f?.type).toBe("object");
    for (const key of ["id", "title", "text", "url"]) {
      expect(f?.properties?.[key], `fetch sem ${key}`).toBeDefined();
    }
  });

  it("ferramentas próprias mantêm inputSchema fechado contra argumentos inventados", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools.filter((t) => !["search", "fetch"].includes(t.name))) {
      expect(
        (tool.inputSchema as { additionalProperties?: unknown }).additionalProperties,
        tool.name
      ).toBe(false);
    }
  });
});
