import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

type Registro = {
  codigo_recorte: string;
  recorte: string;
  codigo_categoria: string;
  categoria: string;
  codigo_municipio: string;
  municipio: string;
  uf: string;
};

type Snapshot = {
  tema: string;
  versao: string;
  sha256_fonte: string;
  total_registros: number;
  registros: Registro[];
};

function ler(nome: string): Snapshot {
  return JSON.parse(
    fs.readFileSync(path.resolve("src/data/recortes", nome), "utf8")
  ) as Snapshot;
}

describe("snapshots metropolitanos versionados", () => {
  const rm = ler("metropolitana.json");
  const ride = ler("ride.json");

  it("fecha as contagens e preserva a mesma fonte oficial", () => {
    expect(rm.tema).toBe("metropolitana");
    expect(ride.tema).toBe("ride");
    expect(rm.versao).toBe("2025");
    expect(ride.versao).toBe("2025");
    expect(rm.total_registros).toBe(1355);
    expect(ride.total_registros).toBe(56);
    expect(rm.registros).toHaveLength(1355);
    expect(ride.registros).toHaveLength(56);
    expect(rm.sha256_fonte).toMatch(/^[0-9a-f]{64}$/);
    expect(ride.sha256_fonte).toBe(rm.sha256_fonte);
  });

  it("RIDE contém somente os três códigos oficiais auditados", () => {
    const codigos = [...new Set(ride.registros.map((r) => r.codigo_categoria))].sort();
    expect(codigos).toEqual(["01301", "03101", "07801"]);
    expect(new Set(ride.registros.map((r) => r.codigo_municipio)).size).toBe(56);
  });

  it("RM exclui RIDE e categorias auxiliares metropolitanas", () => {
    const proibidos = new Set([
      "01301", "03101", "07801",
      "04402", "04502", "04602", "07602",
    ]);
    expect(rm.registros.some((r) => proibidos.has(r.codigo_categoria))).toBe(false);
    expect(new Set(rm.registros.map((r) => r.codigo_categoria)).size).toBe(83);
  });

  it("códigos municipais e UFs têm forma válida", () => {
    for (const registro of [...rm.registros, ...ride.registros]) {
      expect(registro.codigo_municipio).toMatch(/^\d{7}$/);
      expect(registro.uf).toMatch(/^[A-Z]{2}$/);
      expect(registro.codigo_recorte).toMatch(/^\d{3}$/);
      expect(registro.codigo_categoria).toMatch(/^\d{5}$/);
    }
  });

  it("preserva exemplos reais com acentuação correta", () => {
    expect(rm.registros.some((r) => r.categoria.includes("São Paulo"))).toBe(true);
    expect(rm.registros.some((r) => r.categoria.includes("João Pessoa"))).toBe(true);
    expect(ride.registros.some((r) => r.categoria.includes("Grande Teresina"))).toBe(true);
    expect(
      ride.registros.some((r) =>
        r.categoria.includes("Polo Petrolina/PE e Juazeiro/BA")
      )
    ).toBe(true);
  });
});
