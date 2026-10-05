import { describe, expect, it } from "vitest";
import { consultarSnapshot, validarSnapshot, type SnapshotRecorte } from "../src/data/recortes-snapshot.js";

const base: SnapshotRecorte = {
  tema: "costeiro",
  versao: "2021",
  fonte_url: "https://geoftp.ibge.gov.br/exemplo.ods",
  produto_url: "https://www.ibge.gov.br/exemplo",
  planilha: "dados",
  sha256_fonte: "a".repeat(64),
  total_registros: 3,
  registros: [
    { codigo_municipio: "1500107", municipio: "Abaetetuba" },
    { codigo_municipio: "1500305", municipio: "Afuá" },
    { codigo_municipio: "1500701", municipio: "Anajás" },
  ],
};

describe("recortes-snapshot", () => {
  it("aceita snapshot consistente", () => {
    expect(() => validarSnapshot(base)).not.toThrow();
  });

  it("rejeita total divergente", () => {
    expect(() => validarSnapshot({ ...base, total_registros: 4 })).toThrow("difere");
  });

  it("rejeita SHA-256 inválido", () => {
    expect(() => validarSnapshot({ ...base, sha256_fonte: "abc" })).toThrow("SHA-256");
  });

  it("aplica limite sem alterar o total filtrado", () => {
    const r = consultarSnapshot(base, { limite: 2 });
    expect(r.total).toBe(3);
    expect(r.registros).toHaveLength(2);
    expect(r.registros[0].codigo_municipio).toBe("1500107");
  });

  it("filtra por código municipal", () => {
    const r = consultarSnapshot(base, {
      codigo: "1500305",
      campoCodigo: "codigo_municipio",
      limite: 50,
    });
    expect(r.total).toBe(1);
    expect(r.registros[0].municipio).toBe("Afuá");
  });

  it("retorna vazio para código ausente", () => {
    const r = consultarSnapshot(base, {
      codigo: "9999999",
      campoCodigo: "codigo_municipio",
    });
    expect(r.total).toBe(0);
    expect(r.registros).toEqual([]);
  });

  it("exige campoCodigo quando há filtro", () => {
    expect(() => consultarSnapshot(base, { codigo: "1500107" })).toThrow("campoCodigo");
  });
});
