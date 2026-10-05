/**
 * Contrato semântico real de ibge_datasaude contra a API de Agregados do IBGE.
 *
 * Roda apenas com INTEGRATION_TESTS=1. O objetivo é impedir regressões
 * silenciosas de tabela/variável/nível territorial: a API pode responder 200
 * com dados válidos, mas semanticamente diferentes do indicador pedido.
 */
import { describe, expect, it } from "vitest";
import { ibgeDatasaude, INDICADORES_SAUDE } from "../src/tools/datasaude.js";
import { fetchIntegracao } from "./integration-fetch.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";

describe.skipIf(!LIVE)("contrato semântico real de ibge_datasaude", () => {
  it("todo indicador declara variável e níveis existentes nos metadados oficiais", async () => {
    const porTabela = new Map<string, (typeof INDICADORES_SAUDE)[string][]>();
    for (const indicador of Object.values(INDICADORES_SAUDE)) {
      const lista = porTabela.get(indicador.tabela) ?? [];
      lista.push(indicador);
      porTabela.set(indicador.tabela, lista);
    }

    for (const [tabela, indicadores] of porTabela) {
      const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${tabela}/metadados`;
      const response = await fetchIntegracao(url);
      expect(response.status, `metadados da tabela ${tabela}`).toBe(200);

      const meta = (await response.json()) as {
        nivelTerritorial?: {
          Administrativo?: string[];
          Especial?: string[];
          IBGE?: string[];
        };
        variaveis?: Array<{ id?: string | number }>;
      };

      const variaveis = new Set((meta.variaveis ?? []).map((v) => String(v.id)));
      const niveis = new Set([
        ...(meta.nivelTerritorial?.Administrativo ?? []),
        ...(meta.nivelTerritorial?.Especial ?? []),
        ...(meta.nivelTerritorial?.IBGE ?? []),
      ]);

      for (const indicador of indicadores) {
        expect(
          variaveis.has(indicador.variaveis),
          `tabela ${tabela}: variável ${indicador.variaveis} de ${indicador.nome} não existe`
        ).toBe(true);

        for (const nivel of indicador.niveis) {
          expect(
            niveis.has(`N${nivel}`),
            `tabela ${tabela}: nível N${nivel} declarado para ${indicador.nome} não aparece nos metadados`
          ).toBe(true);
        }
      }
    }
  }, 90000);

  it("esperança de vida usa exclusivamente a variável 2503 da tabela 7362", async () => {
    const result = await ibgeDatasaude({
      indicador: "esperanca_vida",
      nivel_territorial: "3",
      localidade: "35",
      periodo: "2018",
    });

    expect(result.isError).toBeFalsy();
    expect(result.provenance?.source_url).toContain("/agregados/7362/");
    expect(result.provenance?.source_url).toContain("/variaveis/2503");

    const structured = result.structured as {
      registros: Array<Record<string, string>>;
    };
    expect(structured.registros.length).toBeGreaterThan(0);
    expect(structured.registros.every((r) => r["Variável (Código)"] === "2503")).toBe(true);
    expect(structured.registros.some((r) => r["Variável"] === "Esperança de vida ao nascer")).toBe(true);
  }, 30000);

  it("mortalidade infantil usa exclusivamente a variável 1940 da tabela 7362", async () => {
    const result = await ibgeDatasaude({
      indicador: "mortalidade_infantil",
      nivel_territorial: "3",
      localidade: "35",
      periodo: "2018",
    });

    expect(result.isError).toBeFalsy();
    expect(result.provenance?.source_url).toContain("/agregados/7362/");
    expect(result.provenance?.source_url).toContain("/variaveis/1940");

    const structured = result.structured as {
      registros: Array<Record<string, string>>;
    };
    expect(structured.registros.length).toBeGreaterThan(0);
    expect(structured.registros.every((r) => r["Variável (Código)"] === "1940")).toBe(true);
    expect(structured.registros.some((r) => r["Variável"] === "Taxa de mortalidade infantil")).toBe(true);
  }, 30000);

  it("esperança de vida recusa município porque a tabela 7362 não publica N6", async () => {
    const result = await ibgeDatasaude({
      indicador: "esperanca_vida",
      nivel_territorial: "6",
      localidade: "3550308",
    });

    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("Esperança de Vida");
    expect(result.markdown).not.toContain("6=Município");
  });
  it("abastecimento de água retorna a distribuição de 2022 da classificação 1821", async () => {
    const result = await ibgeDatasaude({
      indicador: "saneamento_agua",
      nivel_territorial: "6",
      localidade: "3509502",
      periodo: "2022",
    });

    expect(result.isError).toBeFalsy();
    expect(result.provenance?.source_url).toContain("/agregados/6803/");
    expect(result.provenance?.source_url).toContain("classificacao=1821[all]");

    const structured = result.structured as {
      registros: Array<Record<string, string>>;
    };
    expect(structured.registros.length).toBe(18);
    const formas = new Set(
      structured.registros.map(
        (r) =>
          r[
            "Existência de ligação à rede geral de distribuição de água e principal forma de abastecimento de água"
          ]
      )
    );
    expect(formas).toContain("Possui ligação à rede geral e a utiliza como forma principal");
    expect(formas).toContain("Não possui ligação com a rede geral");
  }, 30000);

  it("esgotamento sanitário retorna a distribuição da classificação 11558", async () => {
    const result = await ibgeDatasaude({
      indicador: "saneamento_esgoto",
      nivel_territorial: "3",
      localidade: "35",
      periodo: "2022",
    });

    expect(result.isError).toBeFalsy();
    expect(result.provenance?.source_url).toContain("classificacao=11558[all]");

    const structured = result.structured as {
      registros: Array<Record<string, string>>;
    };
    expect(structured.registros.length).toBe(10);
    const tipos = new Set(structured.registros.map((r) => r["Tipo de esgotamento sanitário"]));
    expect(tipos).toContain("Rede geral ou pluvial");
    expect(tipos).toContain("Fossa séptica ou fossa filtro não ligada à rede");
    expect(tipos).toContain("Não tinham banheiro nem sanitário");
  }, 30000);

  it("cobertura de plano usa a medida percentual oficial", async () => {
    const result = await ibgeDatasaude({
      indicador: "plano_saude",
      nivel_territorial: "3",
      localidade: "35",
      periodo: "2019",
    });

    expect(result.isError).toBeFalsy();
    expect(result.provenance?.source_url).toContain("/variaveis/5264");

    const structured = result.structured as {
      registros: Array<Record<string, string>>;
    };
    expect(structured.registros.length).toBeGreaterThan(0);
    expect(structured.registros.every((r) => r["Variável (Código)"] === "5264")).toBe(true);
    expect(structured.registros.some((r) => r["Unidade de Medida"] === "%")).toBe(true);
  }, 30000);

  it("fecundidade usa a variável 2493 e entrega valor numérico quando disponível", async () => {
    const result = await ibgeDatasaude({
      indicador: "fecundidade",
      nivel_territorial: "1",
      localidade: "all",
      periodo: "2016",
    });

    expect(result.isError).toBeFalsy();
    expect(result.provenance?.source_url).toContain("/agregados/3727/");
    expect(result.provenance?.source_url).toContain("/variaveis/2493");

    const structured = result.structured as {
      registros: Array<Record<string, string>>;
    };
    expect(structured.registros.length).toBeGreaterThan(0);
    expect(structured.registros.every((r) => r["Variável (Código)"] === "2493")).toBe(true);
    const valores = structured.registros
      .map((r) => Number(r["Valor"]))
      .filter((v) => Number.isFinite(v));
    expect(valores.length).toBeGreaterThan(0);
    expect(valores[0]).toBeGreaterThan(0);
  }, 30000);

  it("N6 da PNS publica apenas as 27 capitais e Brasília", async () => {
    const result = await ibgeDatasaude({
      indicador: "plano_saude",
      nivel_territorial: "6",
      localidade: "all",
      periodo: "2019",
    });

    expect(result.isError).toBeFalsy();
    const structured = result.structured as {
      registros: Array<Record<string, string>>;
    };
    expect(structured.registros).toHaveLength(27);
    const codigos = new Set(structured.registros.map((r) => r["Município (Código)"]));
    expect(codigos).toContain("3550308");
    expect(codigos).toContain("5300108");
    expect(codigos).not.toContain("3518305");
    expect(
      structured.registros.every((r) => !["-", "..", "...", "X", ""].includes(r["Valor"] ?? ""))
    ).toBe(true);
  }, 30000);

  it("município não capital é recusado antes da consulta PNS", async () => {
    const result = await ibgeDatasaude({
      indicador: "autoavaliacao_saude",
      nivel_territorial: "6",
      localidade: "3518305",
      periodo: "2019",
    });

    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("capitais");
    expect(result.markdown).toContain("3518305");
  });

});
