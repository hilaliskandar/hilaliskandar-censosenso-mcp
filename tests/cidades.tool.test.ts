import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ibgeCidades, cidadesOutputSchema } from "../src/tools/cidades.js";
import { cache } from "../src/cache.js";
import { mockResponse } from "./helpers.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function lastUrl(): string {
  return String(mockFetch.mock.calls.at(-1)?.[0]);
}

/** Builds a PesquisaResultado[] payload with a year->value map for one locality. */
function pesquisaResultado(res: Record<string, string | number | null>) {
  return [{ id: 1, res: [{ localidade: "3550308", res }] }];
}

function sidraFlat(valor: string, ano = "2024") {
  return [
    {
      NC: "Nível Territorial (Código)",
      NN: "Nível Territorial",
      MC: "Unidade de Medida (Código)",
      MN: "Unidade de Medida",
      V: "Valor",
      D1C: "Município (Código)",
      D1N: "Município",
      D2C: "Ano (Código)",
      D2N: "Ano",
      D3C: "Variável (Código)",
      D3N: "Variável",
    },
    {
      NC: "6",
      NN: "Município",
      MC: "1",
      MN: "Reais",
      V: valor,
      D1C: "3550308",
      D1N: "São Paulo (SP)",
      D2C: ano,
      D2N: ano,
      D3C: "10143",
      D3N: "Salário médio mensal em reais",
    },
  ];
}

const municipioLocalidade = {
  nome: "São Paulo",
  microrregiao: { mesorregiao: { UF: { nome: "São Paulo", sigla: "SP" } } },
};

describe("ibge_cidades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects uf because this tool is municipal-by-code and must not ignore parameters", async () => {
    const result = await ibgeCidades({ tipo: "indicador", indicador: "populacao", uf: "SP" });
    expect(result.isError).toBe(true);
    expect(result.markdown).toContain('parâmetro "uf"');
    expect(mockFetch).not.toHaveBeenCalled();
  });

    describe("panorama", () => {
    it("requires a municipio code", async () => {
      const result = await ibgeCidades({ tipo: "panorama" });
      expect(result.markdown).toContain("ibge_cidades");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects a malformed municipio code", async () => {
      const result = await ibgeCidades({ tipo: "panorama", municipio: "123" });
      expect(result.markdown).toContain("municipio");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches locality name then indicators and renders a table", async () => {
      // 1st fetch: locality lookup
      mockFetch.mockResolvedValueOnce(mockResponse(municipioLocalidade));
      // subsequent fetches: 8 panorama indicators (populacao..salario_medio)
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "2022": "11451999" })));
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "2021": "1521.11" })));
      mockFetch.mockResolvedValue(mockResponse(pesquisaResultado({})));

      const result = await ibgeCidades({ tipo: "panorama", municipio: "3550308" });

      expect(result.markdown).toContain("Panorama: São Paulo (SP)");
      expect(result.markdown).toContain("Código IBGE:** 3550308");
      expect(result.markdown).toContain("População estimada");
      // population formatted with thousands sep + " pessoas"
      expect(result.markdown).toContain("11.451.999 pessoas");
      expect(result.markdown).toContain("Ferramentas Relacionadas");
      // Structured output (1.2): typed indicators for the municipality.
      const s = result.structured as Record<string, unknown>;
      expect(s.tipo).toBe("panorama");
      expect(s.municipio).toBe("3550308");
      expect((s.indicadores as unknown[]).length).toBeGreaterThan(0);
      expect(cidadesOutputSchema.safeParse(result.structured).success).toBe(true);
    });

    // Regressão de 2026-08-28: o panorama não respondia para município NENHUM
    // porque dois dos oito indicadores estavam com 500 na origem e, buscados em
    // série com o retry padrão, consumiam sozinhos o tempo do cliente.
    it("ainda entrega o painel quando indicadores individuais falham na origem", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(municipioLocalidade));
      // populacao responde; os demais devolvem 500, como escolarizacao e
      // salario_medio faziam de fato.
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "2026": "11911337" })));
      mockFetch.mockResolvedValue(mockResponse({ erro: "erro interno" }, 500));

      const result = await ibgeCidades({ tipo: "panorama", municipio: "3550308" });

      expect(result.isError).toBeFalsy();
      expect(result.markdown).toContain("População estimada");
      expect(result.markdown).toContain("11.911.337 pessoas");
      const s = result.structured as Record<string, unknown>;
      expect((s.indicadores as unknown[]).length).toBe(1);
      expect((s.avisos as string[]).length).toBeGreaterThan(0);
      expect(result.markdown).toContain("### Avisos");
      expect(cidadesOutputSchema.safeParse(result.structured).success).toBe(true);
    });

    it("reports empty result when no indicators are returned", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(municipioLocalidade));
      mockFetch.mockResolvedValue(mockResponse(pesquisaResultado({})));

      const result = await ibgeCidades({ tipo: "panorama", municipio: "3550308" });

      expect(result.markdown).toContain("Nenhum indicador encontrado");
    });

    it("falls back to the code when locality lookup fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("HTTP 404: Not Found"));
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "2022": "11451999" })));
      mockFetch.mockResolvedValue(mockResponse(pesquisaResultado({})));

      const result = await ibgeCidades({ tipo: "panorama", municipio: "3550308" });

      expect(result.markdown).toContain("Panorama: 3550308");
    });
  });

  describe("indicador", () => {
    it("lists available indicators when no indicador given", async () => {
      const result = await ibgeCidades({ tipo: "indicador" });
      expect(result.markdown).toContain("Indicadores Disponíveis");
      expect(result.markdown).toContain("populacao");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("does not advertise unsupported IDHM components", async () => {
      const result = await ibgeCidades({ tipo: "indicador" });

      expect(result.markdown).not.toContain("idhm_renda");
      expect(result.markdown).not.toContain("idhm_longevidade");
      expect(result.markdown).not.toContain("idhm_educacao");
      expect(result.markdown).toContain("idh");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects legacy IDHM component aliases with an explicit source limitation", async () => {
      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "idhm_renda",
        municipio: "3509502",
      });

      expect(result.isError).toBe(true);
      expect(result.markdown).toContain("não disponível na fonte atual");
      expect(result.markdown).toContain("pesquisa 10111");
      expect(result.markdown).toContain("Use o alias `idh`");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects legacy numeric IDHM component ids without calling the upstream API", async () => {
      const result = await ibgeCidades({
        tipo: "historico",
        indicador: "30259",
        municipio: "3509502",
      });

      expect(result.isError).toBe(true);
      expect(result.markdown).toContain("IDHM Longevidade");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("requires a municipio for a known alias", async () => {
      const result = await ibgeCidades({ tipo: "indicador", indicador: "populacao" });
      expect(result.markdown).toContain("municipio");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects a malformed municipio code before calling the API", async () => {
      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "populacao",
        municipio: "123",
      });
      expect(result.isError).toBe(true);
      expect(result.markdown).toContain("7 dígitos");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("renders a year/value table for a known alias", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(pesquisaResultado({ "2022": "11451999", "2021": "11400000", "-": "-" }))
      );

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "populacao",
        municipio: "3550308",
      });

      expect(lastUrl()).toContain("/pesquisas/indicadores/29171/resultados/3550308");
      expect(result.markdown).toContain("População estimada");
      expect(result.markdown).toContain("2022");
      expect(result.markdown).toContain("11451999");
    });

    it("uses the generic Cidades indicator endpoint for escolarizacao", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "2022": "98.17" })));

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "escolarizacao",
        municipio: "3509502",
      });

      expect(lastUrl()).toContain("/pesquisas/indicadores/60045/resultados/3509502");
      expect(result.isError).toBeFalsy();
      expect(result.markdown).toContain("98.17");
    });

    it("uses the generic Cidades indicator endpoint for IDHM", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "1991": "0.618", "2000": "0.735", "2010": "0.805" })));

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "idh",
        municipio: "3509502",
      });

      expect(lastUrl()).toContain("/pesquisas/indicadores/329756/resultados/3509502");
      expect(result.isError).toBeFalsy();
      expect(result.markdown).toContain("0.805");
    });

    it("returns the historical IDHM series from indicator 329756", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(pesquisaResultado({ "1991": "0.618", "2000": "0.735", "2010": "0.805" }))
      );

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "idh",
        municipio: "3509502",
      });

      expect(lastUrl()).toContain("/pesquisas/indicadores/329756/resultados/3509502");
      expect(result.isError).toBeFalsy();
      expect(result.markdown).toContain("0.805");
      expect(result.markdown).toContain("0.735");
      expect(result.markdown).toContain("0.618");
    });

    it("keeps former IDHM id 30255 as a compatibility alias", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "2010": "0.805" })));

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "30255",
        municipio: "3509502",
      });

      expect(lastUrl()).toContain("/pesquisas/indicadores/329756/resultados/3509502");
      expect(result.isError).toBeFalsy();
      expect(result.markdown).toContain("0.805");
    });

    it("reports an explicit empty result when Cidades returns an empty inner series", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({})));

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "idh",
        municipio: "3509502",
      });

      expect(result.markdown).toContain("Nenhum");
      expect((result.structured as Record<string, unknown>).indicadores).toEqual([]);
    });

    it("uses SIDRA 9510 variable 10143 for salario_medio", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(sidraFlat("5234.56")));

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "salario_medio",
        municipio: "3550308",
      });

      expect(lastUrl()).toContain("/agregados/9510/");
      expect(lastUrl()).toContain("/variaveis/10143");
      expect(lastUrl()).toContain("localidades=N6[3550308]");
      expect(result.isError).toBeFalsy();
      expect(result.markdown).toContain("5234.56");
    });

    it("keeps legacy salario_medio id 29765 as a compatibility alias", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(sidraFlat("5000.00")));

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "29765",
        municipio: "3550308",
      });

      expect(lastUrl()).toContain("/agregados/9510/");
      expect(result.isError).toBeFalsy();
    });

    it("maps despesas to the total committed expenditure indicator 29749", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "2025": "10666515272.08" })));

      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "despesas",
        municipio: "3509502",
      });

      expect(lastUrl()).toContain("/pesquisas/indicadores/29749/resultados/3509502");
      expect(result.markdown).toContain("10666515272.08");
    });


    it("rejects an unknown alias instead of answering another question", async () => {
      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "nao_existe",
        municipio: "3550308",
      });
      expect(result.isError).toBe(true);
      expect(result.markdown).toContain("não está no catálogo");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("reports empty result when the API returns nothing", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      const result = await ibgeCidades({
        tipo: "indicador",
        indicador: "idh",
        municipio: "3550308",
      });
      expect(result.markdown).toContain("Nenhum");
    });
  });

  describe("pesquisas", () => {
    it("lists principal pesquisas when no pesquisa id given", async () => {
      const result = await ibgeCidades({ tipo: "pesquisas" });
      expect(result.markdown).toContain("Pesquisas Disponíveis");
      expect(result.markdown).toContain("Cadastro Central de Empresas");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches details and indicators for a specific pesquisa", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ id: "33", nome: "Cadastro Central de Empresas", periodicidade: "anual" })
      );
      mockFetch.mockResolvedValueOnce(
        mockResponse([
          { id: 29171, indicador: "População", unidade: { id: "pessoas" } },
          { id: 29168, indicador: "Densidade", unidade: { id: "hab/km2" } },
        ])
      );

      const result = await ibgeCidades({ tipo: "pesquisas", pesquisa: "33" });

      expect(result.markdown).toContain("Pesquisa: Cadastro Central de Empresas");
      expect(result.markdown).toContain("Periodicidade:** anual");
      expect(result.markdown).toContain("População");
    });

    it("surfaces an upstream error for a specific pesquisa", async () => {
      mockFetch.mockRejectedValueOnce(new Error("HTTP 500: Internal Server Error"));
      const result = await ibgeCidades({ tipo: "pesquisas", pesquisa: "33" });
      expect(result.markdown).toContain("Erro");
    });
  });

  describe("historico", () => {
    it("requires both municipio and indicador", async () => {
      const result = await ibgeCidades({ tipo: "historico", municipio: "3550308" });
      expect(result.markdown).toContain("municipio/indicador");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("renders a history table for a known alias", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(pesquisaResultado({ "2020": "100", "2021": "110", "2022": "120" }))
      );

      const result = await ibgeCidades({
        tipo: "historico",
        municipio: "3550308",
        indicador: "populacao",
      });

      expect(result.markdown).toContain("Histórico: População estimada");
      expect(result.markdown).toContain("2022");
      expect(result.markdown).toContain("120");
    });

    it("renders a history table for a raw numeric indicator id", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(pesquisaResultado({ "2022": "120" })));

      const result = await ibgeCidades({
        tipo: "historico",
        municipio: "3550308",
        indicador: "29171",
      });

      expect(lastUrl()).toContain("/pesquisas/indicadores/29171/resultados/3550308");
      expect(result.markdown).toContain("Histórico: População estimada");
    });

    it("rejects malformed municipio in historico before calling the API", async () => {
      const result = await ibgeCidades({
        tipo: "historico",
        municipio: "123",
        indicador: "29171",
      });
      expect(result.isError).toBe(true);
      expect(result.markdown).toContain("7 dígitos");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("reports empty result when no data rows are returned", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      const result = await ibgeCidades({
        tipo: "historico",
        municipio: "3550308",
        indicador: "populacao",
      });
      expect(result.markdown).toContain("Nenhum");
    });
  });
});
