import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/data/recortes-gerados.js", () => ({
  RECORTES_GERADOS: {
    costeiro: {
      tema: "costeiro",
      versao: "2021",
      fonte_url: "https://geoftp.ibge.gov.br/costeiro.ods",
      produto_url: "https://www.ibge.gov.br/costeiro",
      planilha: "dados",
      sha256_fonte: "a".repeat(64),
      total_registros: 2,
      registros: [
        { codigo_municipio: "1500107", municipio: "Abaetetuba" },
        { codigo_municipio: "1500305", municipio: "Afuá" },
      ],
    },
    fronteira: {
      tema: "fronteira",
      versao: "2024",
      fonte_url: "https://geoftp.ibge.gov.br/fronteira.ods",
      produto_url: "https://www.ibge.gov.br/fronteira",
      planilha: "dados",
      sha256_fonte: "b".repeat(64),
      total_registros: 1,
      registros: [
        {
          codigo_municipio: "1100015",
          municipio: "Alta Floresta D\'Oeste",
          uf: "RO",
          toca_limite_internacional: "SIM",
          area_no_recorte_km2: "7067,127",
          percentual_no_recorte: "100,000",
          sede_na_faixa: "sim",
          cidade_gemea: "",
        },
      ],
    },
  },
}));

import { ibgeMalhasTema, malhasTemaOutputSchema } from "../src/tools/malhas-tema.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ibge_malhas_tema com snapshots embutidos", () => {
  it("backend snapshot não depende de fetch para atributos", async () => {
    const result = await ibgeMalhasTema({ tema: "fronteira", codigo: "1100015", limite: 50 });
    expect(result.isError).toBeFalsy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("costeiro usa GeoFTP sem chamar a rede para atributos", async () => {
    const result = await ibgeMalhasTema({ tema: "costeiro", limite: 1 });
    expect(result.isError).toBeFalsy();
    expect(mockFetch).not.toHaveBeenCalled();
    const s = result.structured as Record<string, unknown>;
    expect(s.versao).toBe("2021");
    expect(s.fonte_dados).toBe("https://geoftp.ibge.gov.br/costeiro.ods");
    expect(s.feicoes).toBe(2);
    expect(s.feicoes_retornadas).toBe(1);
    expect(String(result.provenance?.source_url)).toContain("geoftp.ibge.gov.br");
    expect(malhasTemaOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("costeiro filtra por código dentro do snapshot", async () => {
    const result = await ibgeMalhasTema({ tema: "costeiro", codigo: "1500305", limite: 50 });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { registros: Array<Record<string, unknown>>; feicoes: number };
    expect(s.feicoes).toBe(1);
    expect(s.registros).toHaveLength(1);
    expect(s.registros[0].nm_mun).toBe("Afuá");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fronteira preserva atributos temáticos adicionais", async () => {
    const result = await ibgeMalhasTema({ tema: "fronteira", limite: 50 });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { registros: Array<Record<string, unknown>> };
    expect(s.registros[0]).toMatchObject({
      cd_mun: "1100015",
      uf: "RO",
      toca_lim: "SIM",
      area_int: "7067,127",
      porc_int: "100,000",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("código ausente no snapshot retorna erro útil sem tocar na rede", async () => {
    const result = await ibgeMalhasTema({ tema: "costeiro", codigo: "9999999", limite: 50 });
    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("Nenhuma feição encontrada");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
