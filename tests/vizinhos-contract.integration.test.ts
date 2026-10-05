/**
 * Contrato espacial de ibge_vizinhos contra APIs reais do IBGE.
 *
 * Roda apenas com INTEGRATION_TESTS=1. Não depende do WFS temático:
 * usa Localidades + Malhas v3, as mesmas fontes da implementação corrigida.
 */
import { describe, expect, it } from "vitest";
import { ibgeVizinhos } from "../src/tools/vizinhos.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";

describe.skipIf(!LIVE)("contrato espacial real de ibge_vizinhos", () => {
  it("Campinas retorna municípios limítrofes plausíveis e não a antiga seleção por prefixo", async () => {
    const resultado = await ibgeVizinhos({
      municipio: "3509502",
      incluir_dados: false,
    });

    expect(resultado.isError).toBeFalsy();
    expect(resultado.provenance).toBeDefined();

    const structured = resultado.structured as {
      municipio: { codigo: string; nome: string };
      vizinhos: Array<{ codigo: string; nome: string; uf?: string }>;
      total: number;
    };

    expect(structured.municipio.codigo).toBe("3509502");
    expect(structured.municipio.nome).toBe("Campinas");
    expect(structured.total).toBeGreaterThan(0);

    const nomes = new Set(structured.vizinhos.map((v) => v.nome));

    // Vizinhos conhecidos de Campinas: subconjunto suficiente para detectar
    // regressão sem fossilizar toda a lista da malha em um teste.
    for (const nome of ["Valinhos", "Hortolândia", "Paulínia", "Sumaré", "Indaiatuba"]) {
      expect(nomes, `esperava ${nome} entre os limítrofes de Campinas`).toContain(nome);
    }

    // Municípios que apareciam pela antiga heurística de prefixo, mas não são
    // vizinhos de Campinas.
    for (const nome of ["Caieiras", "Cajamar", "Caiuá", "Cajobi"]) {
      expect(nomes, `${nome} não deve aparecer como limítrofe de Campinas`).not.toContain(nome);
    }

    expect(structured.vizinhos.every((v) => v.uf === "SP")).toBe(true);
    expect(new Set(structured.vizinhos.map((v) => v.codigo)).size).toBe(structured.total);
  }, 60000);

  it("raio maior contém ao menos todos os municípios do raio menor e ordena por distância", async () => {
    const menor = await ibgeVizinhos({ municipio: "3509502", raio: 30 });
    const maior = await ibgeVizinhos({ municipio: "3509502", raio: 100 });

    expect(menor.isError).toBeFalsy();
    expect(maior.isError).toBeFalsy();

    const a = (menor.structured as {
      vizinhos: Array<{ codigo: string; distancia_km?: number }>;
    }).vizinhos;
    const b = (maior.structured as {
      vizinhos: Array<{ codigo: string; distancia_km?: number }>;
    }).vizinhos;

    const codigosMaior = new Set(b.map((v) => v.codigo));
    expect(a.every((v) => codigosMaior.has(v.codigo))).toBe(true);
    expect(b.length).toBeGreaterThanOrEqual(a.length);

    for (const lista of [a, b]) {
      expect(lista.every((v) => typeof v.distancia_km === "number")).toBe(true);
      for (let i = 1; i < lista.length; i += 1) {
        expect(lista[i - 1].distancia_km ?? Infinity).toBeLessThanOrEqual(
          lista[i].distancia_km ?? Infinity
        );
      }
    }
  }, 60000);
  it("Extrema/MG reconhece limítrofes de São Paulo na borda interestadual", async () => {
    const resultado = await ibgeVizinhos({
      municipio: "3125101",
      incluir_dados: false,
    });

    expect(resultado.isError).toBeFalsy();
    expect(resultado.provenance).toBeDefined();

    const structured = resultado.structured as {
      municipio: { codigo: string; nome: string };
      vizinhos: Array<{ codigo: string; nome: string; uf?: string }>;
      total: number;
    };

    expect(structured.municipio.codigo).toBe("3125101");
    expect(structured.municipio.nome).toBe("Extrema");

    const paulistas = structured.vizinhos.filter((v) => v.uf === "SP");
    const nomesPaulistas = new Set(paulistas.map((v) => v.nome));

    expect(paulistas.length).toBeGreaterThan(0);
    expect(nomesPaulistas).toContain("Vargem");
    expect(nomesPaulistas).toContain("Joanópolis");
  }, 60000);

});
