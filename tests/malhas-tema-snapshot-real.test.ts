import { beforeEach, describe, expect, it, vi } from "vitest";
import { ibgeMalhasTema, malhasTemaOutputSchema } from "../src/tools/malhas-tema.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ibge_malhas_tema com snapshots reais versionados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Costeiro responde a partir do snapshot real sem rede", async () => {
    const result = await ibgeMalhasTema({ tema: "costeiro", codigo: "1500107", limite: 50 });
    expect(result.isError).toBeFalsy();
    expect(mockFetch).not.toHaveBeenCalled();

    const s = result.structured as {
      versao: string;
      fonte_dados: string;
      feicoes: number;
      feicoes_retornadas: number;
      registros: Array<Record<string, unknown>>;
    };
    expect(s.versao).toBe("2021");
    expect(s.fonte_dados).toContain("Municipios_Costeiros_2021.ods");
    expect(s.feicoes).toBe(1);
    expect(s.feicoes_retornadas).toBe(1);
    expect(s.registros[0]).toMatchObject({ cd_mun: "1500107", nm_mun: "Abaetetuba" });
    expect(String(result.provenance?.source_url)).toBe(s.fonte_dados);
    expect(malhasTemaOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("Fronteira responde a partir do snapshot real sem rede", async () => {
    const result = await ibgeMalhasTema({ tema: "fronteira", codigo: "1100015", limite: 50 });
    expect(result.isError).toBeFalsy();
    expect(mockFetch).not.toHaveBeenCalled();

    const s = result.structured as {
      versao: string;
      fonte_dados: string;
      feicoes: number;
      registros: Array<Record<string, unknown>>;
    };
    expect(s.versao).toBe("2024");
    expect(s.fonte_dados).toContain("Mun_Faixa_de_Fronteira_Cidades_Gemeas_2024.ods");
    expect(s.feicoes).toBe(1);
    expect(s.registros[0]).toMatchObject({
      cd_mun: "1100015",
      nm_mun: "Alta Floresta D\'Oeste",
      uf: "RO",
      toca_lim: "SIM",
      faixa_sede: "sim",
    });
    expect(String(result.provenance?.source_url)).toBe(s.fonte_dados);
  });

  it("Costeiro completo expõe 443 registros totais e limita apenas a resposta", async () => {
    const result = await ibgeMalhasTema({ tema: "costeiro", limite: 5 });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { feicoes: number; feicoes_retornadas: number };
    expect(s.feicoes).toBe(443);
    expect(s.feicoes_retornadas).toBe(5);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("Fronteira completa expõe 590 registros totais e limita apenas a resposta", async () => {
    const result = await ibgeMalhasTema({ tema: "fronteira", limite: 5 });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { feicoes: number; feicoes_retornadas: number };
    expect(s.feicoes).toBe(590);
    expect(s.feicoes_retornadas).toBe(5);
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it("Amazônia Legal e Semiárido aceitam filtro por código municipal", async () => {
    const amazonia = await ibgeMalhasTema({
      tema: "amazonia_legal",
      codigo: "1100015",
      limite: 50,
    });
    expect(amazonia.isError).toBeFalsy();
    expect(mockFetch).not.toHaveBeenCalled();
    const a = amazonia.structured as {
      feicoes: number;
      registros: Array<Record<string, unknown>>;
    };
    expect(a.feicoes).toBe(1);
    expect(a.registros[0]).toMatchObject({ cd_mun: "1100015", uf: "RO" });

    const semiarido = await ibgeMalhasTema({
      tema: "semiarido",
      codigo: "2100154",
      limite: 50,
    });
    expect(semiarido.isError).toBeFalsy();
    expect(mockFetch).not.toHaveBeenCalled();
    const s = semiarido.structured as {
      feicoes: number;
      registros: Array<Record<string, unknown>>;
    };
    expect(s.feicoes).toBe(1);
    expect(s.registros[0]).toMatchObject({
      cd_mun: "2100154",
      nm_mun: "ÁGUA DOCE DO MARANHÃO",
    });
  });

});
