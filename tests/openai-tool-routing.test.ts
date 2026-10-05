import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createServer } from "../src/server.js";

describe("roteamento semântico para seleção de ferramentas no ChatGPT", () => {
  let client: Client;

  beforeAll(async () => {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "routing-test", version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client.close();
  });

  it("clusters sobrepostos citam explicitamente as alternativas relevantes", async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((t) => [t.name, t.description ?? ""]));

    const esperado: Record<string, string[]> = {
      ibge_municipios: ["ibge_geocodigo", "ibge_localidade"],
      ibge_localidade: ["ibge_geocodigo"],
      ibge_geocodigo: ["ibge_municipios", "ibge_localidade"],
      ibge_sidra: ["ibge_sidra_tabelas", "ibge_sidra_metadados"],
      ibge_sidra_tabelas: ["ibge_sidra_metadados", "ibge_sidra"],
      ibge_sidra_metadados: ["ibge_sidra"],
      ibge_censo: ["ibge_cidades", "ibge_indicadores", "ibge_sidra"],
      ibge_indicadores: ["ibge_censo", "ibge_comparar", "ibge_sidra"],
      ibge_comparar: ["ibge_indicadores", "ibge_censo", "ibge_sidra"],
      ibge_cidades: ["ibge_censo", "ibge_indicadores"],
      ibge_malhas: ["ibge_malhas_tema"],
      ibge_malhas_tema: ["ibge_malhas"],
      ibge_datasaude: ["ibge_indicadores"],
    };

    for (const [tool, alternativas] of Object.entries(esperado)) {
      const descricao = byName.get(tool) ?? "";
      for (const alternativa of alternativas) {
        expect(descricao, `${tool} não diferencia ${alternativa}`).toContain(alternativa);
      }
    }
  });
});
