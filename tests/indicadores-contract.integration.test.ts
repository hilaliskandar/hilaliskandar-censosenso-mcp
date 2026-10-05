/**
 * Contrato semântico real de ibge_indicadores contra os metadados oficiais.
 *
 * Roda apenas com INTEGRATION_TESTS=1. Cada entrada do catálogo precisa fixar
 * uma variável e declarar somente níveis realmente publicados pela tabela.
 * Isso impede o retorno silencioso de múltiplas medidas por /v/allxp e evita
 * anunciar níveis territoriais inexistentes para um indicador específico.
 */
import { describe, expect, it } from "vitest";
import { INDICADORES_CONHECIDOS } from "../src/tools/indicadores.js";
import { fetchIntegracao } from "./integration-fetch.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";

describe.skipIf(!LIVE)("contrato semântico real de ibge_indicadores", () => {
  it("toda tabela sustenta a variável e os níveis declarados por cada indicador", async () => {
    const cache = new Map<string, { niveis: Set<string>; variaveis: Set<string> }>();

    for (const [chave, indicador] of Object.entries(INDICADORES_CONHECIDOS)) {
      let meta = cache.get(indicador.tabela);
      if (!meta) {
        const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${indicador.tabela}/metadados`;
        const response = await fetchIntegracao(url);
        expect(response.status, `${chave}: metadados da tabela ${indicador.tabela}`).toBe(200);

        const body = (await response.json()) as {
          nivelTerritorial?: {
            Administrativo?: string[];
            Especial?: string[];
            IBGE?: string[];
          };
          variaveis?: Array<{ id?: string | number }>;
        };

        meta = {
          niveis: new Set([
            ...(body.nivelTerritorial?.Administrativo ?? []),
            ...(body.nivelTerritorial?.Especial ?? []),
            ...(body.nivelTerritorial?.IBGE ?? []),
          ]),
          variaveis: new Set((body.variaveis ?? []).map((v) => String(v.id))),
        };
        cache.set(indicador.tabela, meta);
      }

      expect(
        meta.variaveis.has(indicador.variavel),
        `${chave}: variável ${indicador.variavel} não existe na tabela ${indicador.tabela}`
      ).toBe(true);

      expect(indicador.niveis.length, `${chave}: nenhum nível territorial declarado`).toBeGreaterThan(0);
      for (const nivel of indicador.niveis) {
        expect(
          meta.niveis.has(`N${nivel}`),
          `${chave}: tabela ${indicador.tabela} não publica N${nivel}`
        ).toBe(true);
      }
    }
  }, 120000);
});
