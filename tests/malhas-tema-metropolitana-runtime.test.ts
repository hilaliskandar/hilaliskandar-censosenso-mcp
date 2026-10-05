import { describe, expect, it } from "vitest";
import { ibgeMalhasTema } from "../src/tools/malhas-tema.js";

describe("runtime snapshot de RM e RIDE", () => {
  it("metropolitana usa snapshot oficial para atributos e composição", async () => {
    const r = await ibgeMalhasTema({ tema: "metropolitana", limite: 3 });
    expect(r.isError).not.toBe(true);
    expect(r.structured?.tema).toBe("metropolitana");
    expect(r.structured?.versao).toBe("2025");
    expect(r.structured?.feicoes).toBe(1355);
    expect(r.structured?.feicoes_retornadas).toBe(3);
    expect(r.structured?.fonte_dados).toContain("Composicao_RM_2025_v2.ods");
    const regs = r.structured?.registros as Array<Record<string, unknown>>;
    expect(regs).toHaveLength(3);
    expect(regs[0]).toMatchObject({
      cd_recorte: "001",
      cd_categoria: "00101",
      cd_mun: "1100205",
      uf: "RO",
    });
  });

  it("ride usa snapshot oficial e fecha os 56 municípios", async () => {
    const r = await ibgeMalhasTema({ tema: "ride", limite: 60 });
    expect(r.isError).not.toBe(true);
    expect(r.structured?.tema).toBe("ride");
    expect(r.structured?.versao).toBe("2025");
    expect(r.structured?.feicoes).toBe(56);
    expect(r.structured?.feicoes_retornadas).toBe(56);
    const regs = r.structured?.registros as Array<Record<string, unknown>>;
    const cats = [...new Set(regs.map((x) => String(x.cd_categoria)))].sort();
    expect(cats).toEqual(["01301", "03101", "07801"]);
  });

  it("RM/RIDE filtram por código IBGE do município", async () => {
    const rm = await ibgeMalhasTema({
      tema: "metropolitana",
      codigo: "1100205",
      limite: 50,
    });
    expect(rm.isError).not.toBe(true);
    const regsRm = rm.structured?.registros as Array<Record<string, unknown>>;
    expect(rm.structured?.feicoes).toBe(1);
    expect(regsRm[0]).toMatchObject({ cd_mun: "1100205", uf: "RO" });

    const ride = await ibgeMalhasTema({
      tema: "ride",
      codigo: "2205508",
      limite: 50,
    });
    expect(ride.isError).not.toBe(true);
    const regsRide = ride.structured?.registros as Array<Record<string, unknown>>;
    expect(ride.structured?.feicoes).toBe(1);
    expect(regsRide[0]).toMatchObject({
      cd_mun: "2205508",
      cd_categoria: "01301",
      uf: "PI",
    });
  });
});
