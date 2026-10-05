import { describe, expect, it, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/server.js";
import { cache } from "../src/cache.js";
import { limparIndice } from "../src/tools/deep-research.js";
import { mockResponse, sidraResponse } from "./helpers.js";

const mockFetch = vi.fn();

const agregados = [
  {
    id: "33",
    nome: "Estimativas de população",
    agregados: [{ id: "6579", nome: "População residente estimada" }],
  },
];

const municipios = [
  { "municipio-id": 3550308, "municipio-nome": "São Paulo", "UF-sigla": "SP" },
];

const metadados = {
  id: "6579",
  nome: "Estimativas de população residente",
  URL: "https://sidra.ibge.gov.br/tabela/6579",
  pesquisa: "Estimativas de população",
  assunto: "População residente estimada",
  periodicidade: { frequencia: "anual", inicio: 2001, fim: 2025 },
  nivelTerritorial: { Administrativo: ["N1", "N3", "N6"], Especial: [], IBGE: [] },
  variaveis: [{ id: 9324, nome: "População residente estimada", unidade: "Pessoas" }],
};
const periodos = [{ id: "2025", literals: ["2025"], modificacao: "2026-01-01" }];

function responderPorUrl() {
  mockFetch.mockImplementation(async (url: string | URL) => {
    const alvo = String(url);
    if (/\/api\/v3\/agregados$/.test(alvo)) return mockResponse(agregados);
    if (/\/localidades\/municipios\?orderBy=nome&view=nivelado$/.test(alvo)) return mockResponse(municipios);
    if (/\/metadados$/.test(alvo)) return mockResponse(metadados);
    if (/\/periodos$/.test(alvo)) return mockResponse(periodos);
    return mockResponse({ erro: `sem mock para ${alvo}` }, 404);
  });
}

function primeiroTexto(result: { content?: unknown }): string {
  const blocos = result.content as Array<{ type?: string; text?: string }> | undefined;
  return blocos?.find((b) => b.type === "text")?.text ?? "";
}

describe("contrato OpenAI exato de search/fetch", () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "openai-search-fetch-contract", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(() => {
    cache.clear();
    limparIndice();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    responderPorUrl();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("search repete o mesmo objeto em structuredContent e content JSON", async () => {
    const r = await client.callTool({ name: "search", arguments: { query: "população" } });
    expect(r.isError).not.toBe(true);
    const structured = r.structuredContent as Record<string, unknown>;
    const contentJson = JSON.parse(primeiroTexto(r)) as Record<string, unknown>;

    expect(contentJson).toEqual(structured);
    expect(structured).not.toHaveProperty("provenance");
    expect(structured).not.toHaveProperty("attribution");
    expect(Array.isArray(contentJson.results)).toBe(true);
    for (const item of contentJson.results as Array<Record<string, unknown>>) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.url).toBe("string");
      expect(String(item.url)).toMatch(/^https:\/\//);
    }
  });

  it("fetch repete o mesmo objeto em structuredContent e content JSON", async () => {
    const r = await client.callTool({ name: "fetch", arguments: { id: "sidra:6579" } });
    expect(r.isError).not.toBe(true);
    const structured = r.structuredContent as Record<string, unknown>;
    const contentJson = JSON.parse(primeiroTexto(r)) as Record<string, unknown>;

    expect(contentJson).toEqual(structured);
    expect(structured).not.toHaveProperty("provenance");
    expect(structured).not.toHaveProperty("attribution");
    expect(contentJson.id).toBe("sidra:6579");
    expect(typeof contentJson.title).toBe("string");
    expect(typeof contentJson.text).toBe("string");
    expect(String(contentJson.text).length).toBeGreaterThan(0);
    expect(contentJson.url).toBe("https://sidra.ibge.gov.br/tabela/6579");
  });

  it("IDs de search podem ser entregues diretamente a fetch", async () => {
    const s = await client.callTool({ name: "search", arguments: { query: "população residente estimada" } });
    const resultado = s.structuredContent as { results: Array<{ id: string; url: string }> };
    const item = resultado.results.find((x) => x.id === "sidra:6579");
    expect(item).toBeDefined();

    const f = await client.callTool({ name: "fetch", arguments: { id: item!.id } });
    expect(f.isError).not.toBe(true);
    expect((f.structuredContent as { id: string }).id).toBe(item!.id);
  });


  it("fetch resolve tema censitário descoberto como documento próprio", async () => {
    const r = await client.callTool({ name: "fetch", arguments: { id: "censo:saneamento" } });
    expect(r.isError).not.toBe(true);
    const doc = r.structuredContent as {
      id: string;
      text: string;
      metadata?: Record<string, unknown>;
    };
    expect(doc.id).toBe("censo:saneamento");
    expect(doc.text).toMatch(/Censo Demográfico/i);
    expect(doc.text).toMatch(/ibge_censo/);
    expect(doc.text).toContain('tema="saneamento"');
    expect(doc.text).not.toContain("${tema}");
    expect(doc.metadata?.consultar_com).toBe("ibge_censo");
  });

  it("fetch resolve indicador de saúde descoberto como documento próprio", async () => {
    const r = await client.callTool({ name: "fetch", arguments: { id: "saude:mortalidade_infantil" } });
    expect(r.isError).not.toBe(true);
    const doc = r.structuredContent as {
      id: string;
      text: string;
      metadata?: Record<string, unknown>;
    };
    expect(doc.id).toBe("saude:mortalidade_infantil");
    expect(doc.text).toMatch(/mortalidade infantil/i);
    expect(doc.text).toMatch(/ibge_datasaude/);
    expect(doc.text).toContain('indicador="mortalidade_infantil"');
    expect(doc.text).not.toContain("${chave}");
    expect(doc.metadata?.consultar_com).toBe("ibge_datasaude");
  });

  it("fetch resolve recorte territorial como documento próprio", async () => {
    const r = await client.callTool({ name: "fetch", arguments: { id: "recorte:biomas" } });
    expect(r.isError).not.toBe(true);
    const doc = r.structuredContent as {
      id: string;
      text: string;
      metadata?: Record<string, unknown>;
    };
    expect(doc.id).toBe("recorte:biomas");
    expect(doc.text).toMatch(/Biomas do Brasil/i);
    expect(doc.text).toMatch(/Mata Atlântica/i);
    expect(doc.text).toMatch(/ibge_malhas_tema/);
    expect(doc.text).toContain('tema="biomas"');
    expect(doc.text).not.toContain("${tema}");
    expect(doc.metadata?.consultar_com).toBe("ibge_malhas_tema");
  });

  it("URLs retornadas são canônicas e citáveis", async () => {
    const s = await client.callTool({ name: "search", arguments: { query: "São Paulo" } });
    const resultado = s.structuredContent as { results: Array<{ url: string }> };
    for (const item of resultado.results) {
      const url = new URL(item.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname.length).toBeGreaterThan(0);
    }
  });
});
