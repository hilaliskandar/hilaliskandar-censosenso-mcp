import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { RECORTES_GERADOS } from "../src/data/recortes-gerados.js";
import { validarSnapshot, type SnapshotRecorte } from "../src/data/recortes-snapshot.js";

const esperado: Record<string, { total: number; versao: string; sha: string }> = {
  amazonia_legal: { total: 773, versao: "2024", sha: "0282c8d5788dd78f083eb9886d3e99a675f5e745a318afa5bdfbe5d712bd7927" },
  costeiro: { total: 443, versao: "2021", sha: "ff3db77d7105569c041b60ff14a6c3a1202dd9b698f4097c69affa79d84596f5" },
  fronteira: { total: 590, versao: "2024", sha: "0867803fd2fd6dcdec300218d0774c4ef6079a07ed0c56af1c95810fc90dc807" },
  semiarido: { total: 1477, versao: "2022", sha: "17e5713da064e7f89031c7793e57fa6c29bf81e8241b1a5386cf6badfbb1790b" },
};

describe("snapshots reais versionados de recortes", () => {
  it("runtime obrigatório contém Costeiro e Fronteira", () => {
    expect((RECORTES_GERADOS as Record<string, SnapshotRecorte>).costeiro).toBeDefined();
    expect((RECORTES_GERADOS as Record<string, SnapshotRecorte>).fronteira).toBeDefined();
  });

  for (const [tema, exp] of Object.entries(esperado)) {
    it(`${tema}: JSON e módulo gerado são coerentes`, () => {
      const caminho = path.resolve("src", "data", "recortes", `${tema}.json`);
      const json = JSON.parse(fs.readFileSync(caminho, "utf8")) as SnapshotRecorte;
      validarSnapshot(json);
      expect(json.tema).toBe(tema);
      expect(json.versao).toBe(exp.versao);
      expect(json.total_registros).toBe(exp.total);
      expect(json.sha256_fonte).toBe(exp.sha);

      const gerado = (RECORTES_GERADOS as Record<string, SnapshotRecorte>)[tema];
      expect(gerado).toBeDefined();
      expect(gerado.tema).toBe(json.tema);
      expect(gerado.versao).toBe(json.versao);
      expect(gerado.total_registros).toBe(json.total_registros);
      expect(gerado.sha256_fonte).toBe(json.sha256_fonte);
      expect(gerado.registros).toEqual(json.registros);

      const codigos = json.registros
        .map((r) => String(r.codigo_municipio ?? ""))
        .filter(Boolean);
      expect(new Set(codigos).size).toBe(codigos.length);
      expect(codigos.every((c) => /^\d{7}$/.test(c))).toBe(true);
    });
  }
});
