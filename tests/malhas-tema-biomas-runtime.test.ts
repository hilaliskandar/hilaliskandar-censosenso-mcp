import { beforeEach, describe, expect, it, vi } from "vitest";
import { ibgeMalhasTema, malhasTemaOutputSchema, type Tema } from "../src/tools/malhas-tema.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("runtime snapshot real de Biomas 2025", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista os seis biomas sem acessar a rede", async () => {
    const result = await ibgeMalhasTema({ tema: "biomas", limite: 10 });
    expect(result.isError).toBeFalsy();
    expect(mockFetch).not.toHaveBeenCalled();

    const s = result.structured as {
      versao: string;
      fonte_dados: string;
      tipo_registro: string;
      feicoes: number;
      feicoes_retornadas: number;
      registros: Array<Record<string, unknown>>;
    };

    expect(s.versao).toBe("2025");
    expect(s.feicoes).toBe(6);
    expect(s.feicoes_retornadas).toBe(6);
    expect(s.tipo_registro).toBe("feicao_geografica");
    expect(s.fonte_dados).toContain("2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip");
    expect(s.registros).toEqual([
      { cd_bioma: "1", nm_bioma: "Amazônia" },
      { cd_bioma: "2", nm_bioma: "Caatinga" },
      { cd_bioma: "3", nm_bioma: "Cerrado" },
      { cd_bioma: "4", nm_bioma: "Mata Atlântica" },
      { cd_bioma: "5", nm_bioma: "Pampa" },
      { cd_bioma: "6", nm_bioma: "Pantanal" },
    ]);
    expect(malhasTemaOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("classifica corretamente o tipo de registro dos sete recortes", async () => {
    const esperado: Record<Tema, string> = {
      biomas: "feicao_geografica",
      amazonia_legal: "municipio_componente",
      semiarido: "municipio_componente",
      costeiro: "municipio_componente",
      fronteira: "municipio_componente",
      metropolitana: "municipio_componente",
      ride: "municipio_componente",
    };

    for (const tema of Object.keys(esperado) as Tema[]) {
      const result = await ibgeMalhasTema({ tema, limite: 1 });
      expect(result.isError, tema).toBeFalsy();
      const s = result.structured as { tipo_registro: string };
      expect(s.tipo_registro, tema).toBe(esperado[tema]);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("filtra um bioma por código no snapshot", async () => {
    const result = await ibgeMalhasTema({ tema: "biomas", codigo: "4", limite: 10 });
    expect(result.isError).toBeFalsy();
    expect(mockFetch).not.toHaveBeenCalled();

    const s = result.structured as {
      codigo: string;
      feicoes: number;
      registros: Array<Record<string, unknown>>;
    };
    expect(s.codigo).toBe("4");
    expect(s.feicoes).toBe(1);
    expect(s.registros).toEqual([{ cd_bioma: "4", nm_bioma: "Mata Atlântica" }]);
  });

  it("código de bioma inexistente falha sem acessar a rede", async () => {
    const result = await ibgeMalhasTema({ tema: "biomas", codigo: "9", limite: 10 });
    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("Nenhuma feição encontrada");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
