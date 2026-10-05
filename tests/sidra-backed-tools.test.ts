import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ibgeCenso, censoOutputSchema } from "../src/tools/censo.js";
import { ibgeIndicadores, indicadoresOutputSchema } from "../src/tools/indicadores.js";
import { ibgeDatasaude, datasaudeOutputSchema } from "../src/tools/datasaude.js";
import { cache } from "../src/cache.js";
import { mockResponse, sidraResponse } from "./helpers.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const sidraPop = sidraResponse(
  { D1N: "Unidade da Federação", D2N: "Ano", V: "Valor" },
  { D1N: "São Paulo", D2N: "2022", V: "44411238" }
);

describe("ibge_censo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats a census table for a known theme", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    const result = await ibgeCenso({ tema: "populacao", nivel_territorial: "3" });

    expect(result.markdown).toContain("Censo Demográfico");
    expect(result.markdown).toContain("Tabela SIDRA:");
    expect(result.markdown).toContain("São Paulo");
    expect(result.markdown).toContain("44.411.238");
    // Structured output (1.2): typed records validated against the outputSchema.
    const s = result.structured as Record<string, unknown>;
    expect(s.tema).toBe("populacao");
    expect(s.colunas).toContain("Unidade da Federação");
    expect((s.registros as Record<string, string>[])[0]["Unidade da Federação"]).toBe("São Paulo");
    expect(censoOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("expande sexo e idade para a pirâmide etária municipal de 2022", async () => {
    const piramide = sidraResponse(
      {
        V: "Valor",
        D1C: "Município (Código)",
        D1N: "Município",
        D2C: "Sexo (Código)",
        D2N: "Sexo",
        D3C: "Idade (Código)",
        D3N: "Idade",
      },
      {
        V: "6100",
        D1C: "3509502",
        D1N: "Campinas (SP)",
        D2C: "4",
        D2N: "Homens",
        D3C: "6561",
        D3N: "0 a 4 anos",
      },
      {
        V: "5900",
        D1C: "3509502",
        D1N: "Campinas (SP)",
        D2C: "5",
        D2N: "Mulheres",
        D3C: "6561",
        D3N: "0 a 4 anos",
      }
    );
    mockFetch.mockResolvedValueOnce(mockResponse(piramide));

    const result = await ibgeCenso({
      ano: "2022",
      tema: "idade_sexo",
      nivel_territorial: "6",
      localidades: "3509502",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/9514/periodos/2022/variaveis/93");
    expect(url).toContain("localidades=N6[3509502]");
    expect(url).toContain("classificacao=2[4,5]|287[all]");

    const s = result.structured as Record<string, unknown>;
    expect(s.tema).toBe("idade_sexo");
    expect(s.totalRegistros).toBe(2);
    expect(s.colunas).toContain("Sexo");
    expect(s.colunas).toContain("Idade");
    const registros = s.registros as Record<string, string>[];
    expect(registros.map((r) => r.Sexo)).toEqual(["Homens", "Mulheres"]);
    expect(registros.every((r) => r.Idade !== "Total")).toBe(true);
    expect(censoOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("consulta os três indicadores da estrutura etária municipal de 2022", async () => {
    const estrutura = sidraResponse(
      {
        V: "Valor",
        D1C: "Município (Código)",
        D1N: "Município",
        D2C: "Variável (Código)",
        D2N: "Variável",
      },
      {
        V: "76.93",
        D1C: "3509502",
        D1N: "Campinas (SP)",
        D2C: "10612",
        D2N: "Índice de envelhecimento",
      },
      {
        V: "37",
        D1C: "3509502",
        D1N: "Campinas (SP)",
        D2C: "10613",
        D2N: "Idade mediana",
      },
      {
        V: "91.10",
        D1C: "3509502",
        D1N: "Campinas (SP)",
        D2C: "8845",
        D2N: "Razão de sexo",
      }
    );
    mockFetch.mockResolvedValueOnce(mockResponse(estrutura));

    const result = await ibgeCenso({
      ano: "2022",
      tema: "estrutura_etaria",
      nivel_territorial: "6",
      localidades: "3509502",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/9515/periodos/2022/variaveis/10612,10613,8845");
    expect(url).toContain("localidades=N6[3509502]");

    const s = result.structured as Record<string, unknown>;
    expect(s.tema).toBe("estrutura_etaria");
    expect(s.tabela).toBe("9515");
    expect(s.totalRegistros).toBe(3);
    const registros = s.registros as Record<string, string>[];
    expect(registros.map((r) => r.Variável)).toEqual([
      "Índice de envelhecimento",
      "Idade mediana",
      "Razão de sexo",
    ]);
    expect(censoOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("expande o saneamento 2022 para as categorias de abastecimento de água", async () => {
    const agua = sidraResponse(
      {
        V: "Valor",
        D1C: "Município (Código)",
        D1N: "Município",
        D2C: "Existência de ligação à rede geral de distribuição de água e principal forma de abastecimento de água (Código)",
        D2N: "Existência de ligação à rede geral de distribuição de água e principal forma de abastecimento de água",
      },
      {
        V: "429543",
        D1C: "3509502",
        D1N: "Campinas (SP)",
        D2C: "72129",
        D2N: "Total",
      },
      {
        V: "424627",
        D1C: "3509502",
        D1N: "Campinas (SP)",
        D2C: "72144",
        D2N: "Possui ligação à rede geral e a utiliza como forma principal",
      }
    );
    mockFetch.mockResolvedValueOnce(mockResponse(agua));

    const result = await ibgeCenso({
      ano: "2022",
      tema: "saneamento",
      nivel_territorial: "6",
      localidades: "3509502",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/6803/periodos/2022/variaveis/381");
    expect(url).toContain("localidades=N6[3509502]");
    expect(url).toContain("classificacao=1821[all]");

    const s = result.structured as Record<string, unknown>;
    expect(s.tema).toBe("saneamento");
    expect(s.tabela).toBe("6803");
    expect(s.totalRegistros).toBe(2);
    expect(censoOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("expande nível de instrução na educação municipal de 2022", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeCenso({
      ano: "2022",
      tema: "educacao",
      nivel_territorial: "6",
      localidades: "3509502",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/10061/periodos/2022/variaveis/2667");
    expect(url).toContain("classificacao=1568[120704,9493,9494,9495,99713]");
    expect(url).toContain("localidades=N6[3509502]");
  });

  it("usa nível de ocupação municipal do Censo 2022 para trabalho", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeCenso({
      ano: "2022",
      tema: "trabalho",
      nivel_territorial: "6",
      localidades: "3509502",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/10268/periodos/2022/variaveis/140,696,675");
    expect(url).toContain("localidades=N6[3509502]");
  });

  it("usa rendimento domiciliar per capita médio e mediano municipal em 2022", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeCenso({
      ano: "2022",
      tema: "rendimento",
      nivel_territorial: "6",
      localidades: "3509502",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/10295/periodos/2022/variaveis/13431,13534");
    expect(url).toContain("localidades=N6[3509502]");
    expect(url).not.toContain("/10293/");
  });

  it("expande cor ou raça no Censo municipal de 2022", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeCenso({
      ano: "2022",
      tema: "cor_raca",
      nivel_territorial: "6",
      localidades: "3509502",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/9605/periodos/2022/variaveis/93");
    expect(url).toContain("classificacao=86[all]");
  });

  it("seleciona total, pessoas com deficiência e percentual municipal em 2022", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeCenso({
      ano: "2022",
      tema: "deficiencia",
      nivel_territorial: "6",
      localidades: "3509502",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/10125/periodos/2022/variaveis/11852,12785,13403");
    expect(url).toContain("localidades=N6[3509502]");
  });

  it("returns embedded JSON when formato='json'", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    const result = await ibgeCenso({ tema: "populacao", formato: "json" });

    expect(result.markdown).toContain("```json");
    expect(result.markdown).toContain('"São Paulo"');
  });

  it("lists available tables for tema='listar' without calling the API", async () => {
    const result = await ibgeCenso({ tema: "listar" });

    expect(result.markdown).toContain("Tabelas do Censo");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("distinguishes an empty result from an upstream failure", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    const result = await ibgeCenso({ tema: "populacao" });

    expect(result.markdown).toContain("Nenhum dado encontrado");
    expect(result.markdown).not.toContain("Código HTTP");
  });

  it("surfaces an upstream error gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("HTTP 500: Internal Server Error"));

    const result = await ibgeCenso({ tema: "populacao" });

    expect(result.markdown).toContain("Erro");
  });
});

describe("ibge_indicadores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists indicators when called with no indicator", async () => {
    const result = await ibgeIndicadores({});

    expect(result.markdown.length).toBeGreaterThan(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("formats a known indicator", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    const result = await ibgeIndicadores({ indicador: "desemprego", nivel_territorial: "3" });

    expect(result.markdown).toContain("Tabela SIDRA:");
    expect(result.markdown).toContain("São Paulo");
    const s = result.structured as Record<string, unknown>;
    expect(s.indicador).toBe("desemprego");
    expect(s.totalRegistros).toBe(1);
    expect(indicadoresOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("returns embedded JSON when formato='json'", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    const result = await ibgeIndicadores({
      indicador: "desemprego",
      nivel_territorial: "3",
      formato: "json",
    });

    expect(result.markdown).toContain("```json");
  });

  it("fixa a variável semântica do indicador em vez de usar allxp", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeIndicadores({ indicador: "pib", nivel_territorial: "3" });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/5938/");
    expect(url).toContain("/variaveis/37");
    expect(url).not.toContain("allxp");
  });

  it("rejeita nível que a tabela do indicador não publica antes de consultar a rede", async () => {
    const result = await ibgeIndicadores({ indicador: "servicos", nivel_territorial: "3" });

    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("Volume de Serviços");
    expect(result.markdown).toContain("1 (Brasil)");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("usa a tabela e variável corretas para rendimento habitual no trabalho principal", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeIndicadores({ indicador: "rendimento", nivel_territorial: "3" });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/5436/");
    expect(url).toContain("/variaveis/5932");
  });

  it("usa percentual para cobertura de plano de saúde", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeDatasaude({
      indicador: "plano_saude",
      nivel_territorial: "3",
      localidade: "35",
      periodo: "2019",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/4938/");
    expect(url).toContain("/variaveis/5264");
    expect(url).not.toContain("/variaveis/5260");
  });

  it("rejeita município não capital para indicadores municipais da PNS", async () => {
    const result = await ibgeDatasaude({
      indicador: "plano_saude",
      nivel_territorial: "6",
      localidade: "3518305",
      periodo: "2019",
    });

    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("capitais");
    expect(result.markdown).toContain("3518305");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("aceita capital para indicadores municipais da PNS", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    const result = await ibgeDatasaude({
      indicador: "plano_saude",
      nivel_territorial: "6",
      localidade: "3550308",
      periodo: "2019",
    });

    expect(result.isError).toBeFalsy();
    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("N6[3550308]");
    expect(url).toContain("/variaveis/5264");
  });

  it("expande abastecimento de água 2022 pela classificação 1821", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeDatasaude({
      indicador: "saneamento_agua",
      nivel_territorial: "3",
      localidade: "35",
      periodo: "2022",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/6803/");
    expect(url).toContain("/variaveis/381");
    expect(url).toContain("classificacao=1821[all]");
  });

  it("expande esgotamento sanitário pela classificação 11558", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeDatasaude({
      indicador: "saneamento_esgoto",
      nivel_territorial: "3",
      localidade: "35",
      periodo: "2022",
    });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/6805/");
    expect(url).toContain("/variaveis/381");
    expect(url).toContain("classificacao=11558[all]");
  });

  it("reports an unknown indicator without calling the API", async () => {
    const result = await ibgeIndicadores({ indicador: "inexistente-xyz" });

    expect(result.markdown).toContain("não encontrado");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("reports 'no data' distinctly for a valid indicator with an empty response", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    const result = await ibgeIndicadores({ indicador: "desemprego", nivel_territorial: "3" });

    expect(result.markdown).toContain("Nenhum dado encontrado");
  });
});

describe("ibge_datasaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists health indicators for indicador='listar' without calling the API", async () => {
    const result = await ibgeDatasaude({ indicador: "listar" });

    expect(result.markdown).toContain("Indicadores de Saúde");
    expect(result.markdown).toContain("Disponibilidade Territorial");
    expect(result.markdown).toContain("esperanca_vida");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("formats a known health indicator", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    const result = await ibgeDatasaude({ indicador: "esperanca_vida", nivel_territorial: "3" });

    expect(result.markdown).toContain("**Fonte:**");
    expect(result.markdown).toContain("São Paulo");
    const s = result.structured as Record<string, unknown>;
    expect(s.indicador).toBe("esperanca_vida");
    expect(datasaudeOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("consulta apenas a variável de esperança de vida na tabela 7362", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeDatasaude({ indicador: "esperanca_vida", nivel_territorial: "3" });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/7362/");
    expect(url).toContain("/variaveis/2503");
    expect(url).not.toContain("/variaveis/1940");
  });

  it("consulta apenas a variável de mortalidade infantil na tabela 7362", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    await ibgeDatasaude({ indicador: "mortalidade_infantil", nivel_territorial: "3" });

    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/7362/");
    expect(url).toContain("/variaveis/1940");
    expect(url).not.toContain("/variaveis/2503");
  });

  it("rejeita nível municipal para indicadores da tabela 7362 sem consultar a API", async () => {
    const result = await ibgeDatasaude({
      indicador: "esperanca_vida",
      nivel_territorial: "6",
      localidade: "3550308",
    });

    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("Esperança de Vida");
    expect(result.markdown).toContain("1");
    expect(result.markdown).toContain("2");
    expect(result.markdown).toContain("3");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("mantém nível municipal para indicadores cuja tabela publica N6", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidraPop));

    const result = await ibgeDatasaude({
      indicador: "nascidos_vivos",
      nivel_territorial: "6",
      localidade: "3550308",
    });

    expect(result.isError).toBeFalsy();
    const url = String(mockFetch.mock.calls[0]?.[0] ?? "");
    expect(url).toContain("/agregados/2612/");
    expect(url).toContain("/variaveis/218");
    expect(url).toContain("N6");
  });

  it("reports an unknown indicator without calling the API", async () => {
    const result = await ibgeDatasaude({ indicador: "inexistente-xyz" });

    expect(result.markdown).toContain("não encontrado");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("distinguishes an empty result from an upstream failure", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    const result = await ibgeDatasaude({ indicador: "esperanca_vida", nivel_territorial: "3" });

    expect(result.markdown).toContain("Nenhum dado encontrado");
    expect(result.markdown).not.toContain("Código HTTP");
  });

  it("surfaces an upstream error gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("HTTP 500: Internal Server Error"));

    const result = await ibgeDatasaude({ indicador: "esperanca_vida", nivel_territorial: "3" });

    expect(result.markdown).toContain("Erro");
  });
});
