import { describe, expect, it } from "vitest";
import { ibgeMalhasTema, malhasTemaOutputSchema } from "../src/tools/malhas-tema.js";

describe("runtime snapshot de Amazônia Legal e Semiárido", () => {
  it("Amazônia Legal retorna composição municipal", async () => {
    const r = await ibgeMalhasTema({ tema: "amazonia_legal", limite: 3 });
    expect(r.isError).not.toBe(true);

    const s = r.structured as {
      tema: string;
      versao: string;
      fonte_dados: string;
      tipo_registro: string;
      feicoes: number;
      feicoes_retornadas: number;
      registros: Array<Record<string, unknown>>;
    };

    expect(s.tema).toBe("amazonia_legal");
    expect(s.versao).toBe("2024");
    expect(s.tipo_registro).toBe("municipio_componente");
    expect(s.feicoes).toBe(773);
    expect(s.feicoes_retornadas).toBe(3);
    expect(s.fonte_dados).toContain("Municipios_da_Amazonia_Legal_2024.ods");
    expect(s.registros[0]).toHaveProperty("cd_mun");
    expect(s.registros[0]).toHaveProperty("area_total_km2");
    expect(s.registros[0]).toHaveProperty("area_no_recorte_km2");
    expect(s.registros[0]).toHaveProperty("percentual_no_recorte");
    expect(malhasTemaOutputSchema.safeParse(r.structured).success).toBe(true);
  });

  it("Semiárido retorna composição municipal", async () => {
    const r = await ibgeMalhasTema({ tema: "semiarido", limite: 4 });
    expect(r.isError).not.toBe(true);

    const s = r.structured as {
      versao: string;
      tipo_registro: string;
      feicoes: number;
      feicoes_retornadas: number;
      registros: Array<Record<string, unknown>>;
    };

    expect(s.versao).toBe("2022");
    expect(s.tipo_registro).toBe("municipio_componente");
    expect(s.feicoes).toBe(1477);
    expect(s.feicoes_retornadas).toBe(4);
    expect(s.registros[0]).toHaveProperty("cd_mun");
    expect(s.registros[0]).toHaveProperty("nm_mun");
    expect(malhasTemaOutputSchema.safeParse(r.structured).success).toBe(true);
  });

  it("filtra Amazônia Legal e Semiárido por código municipal", async () => {
    const a = await ibgeMalhasTema({ tema: "amazonia_legal", codigo: "1100015", limite: 5 });
    const s = await ibgeMalhasTema({ tema: "semiarido", codigo: "2100154", limite: 5 });

    expect(a.isError).not.toBe(true);
    expect(s.isError).not.toBe(true);

    expect(a.structured?.feicoes).toBe(1);
    expect((a.structured?.registros as Array<Record<string, unknown>>)[0]).toMatchObject({
      cd_mun: "1100015",
      uf: "RO",
    });

    expect(s.structured?.feicoes).toBe(1);
    expect((s.structured?.registros as Array<Record<string, unknown>>)[0]).toMatchObject({
      cd_mun: "2100154",
      nm_mun: "ÁGUA DOCE DO MARANHÃO",
    });
  });
});
