import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const manifestPath = path.resolve("scripts/fontes_recortes_ibge.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
  fontes: Record<
    string,
    {
      versao?: string;
      tipo?: string;
      url?: string;
      url_diretorio?: string;
      snapshot_pronto?: boolean;
      runtime_pronto?: boolean;
      contagem_esperada_bruta?: number;
      crs?: string;
      cpg?: string;
      bloqueio_semantico?: string;
      bloqueio_runtime?: string;
      contrato_runtime?: string;
      contagem_esperada_snapshot?: number;
      codigos_categoria_incluir?: string[];
    }
  >;
};

describe("manifesto de fontes dos recortes", () => {
  it("declara os sete temas públicos", () => {
    expect(Object.keys(manifest.fontes).sort()).toEqual(
      ["amazonia_legal", "biomas", "costeiro", "fronteira", "metropolitana", "ride", "semiarido"].sort()
    );
  });

  it("fontes prontas têm URL HTTPS, versão e contagem auditada", () => {
    for (const [tema, fonte] of Object.entries(manifest.fontes)) {
      if (!fonte.snapshot_pronto) continue;
      expect(fonte.url, tema).toMatch(/^https:\/\//);
      expect(fonte.versao, tema).toBeTruthy();
      expect(fonte.contagem_esperada_bruta, tema).toBeGreaterThan(0);
    }
  });

  it("os sete recortes públicos estão prontos para gerar snapshot", () => {
    const prontos = Object.entries(manifest.fontes)
      .filter(([, fonte]) => fonte.snapshot_pronto)
      .map(([tema]) => tema)
      .sort();
    expect(prontos).toEqual(
      ["amazonia_legal", "biomas", "costeiro", "fronteira", "metropolitana", "ride", "semiarido"].sort()
    );
  });

  it("Biomas 2025 está pronto e ativo no runtime snapshot", () => {
    expect(manifest.fontes.biomas.snapshot_pronto).toBe(true);
    expect(manifest.fontes.biomas.runtime_pronto).toBe(true);
    expect(manifest.fontes.biomas.versao).toBe("2025");
    expect(manifest.fontes.biomas.tipo).toBe("zip_shapefile");
    expect(manifest.fontes.biomas.contagem_esperada_bruta).toBe(6);
    expect(manifest.fontes.biomas.crs).toBe("SIRGAS 2000");
    expect(manifest.fontes.biomas.cpg).toBe("UTF-8");
  });

  it("RM e RIDE usam códigos oficiais auditados e contagens fechadas", () => {
    expect(manifest.fontes.metropolitana.codigos_categoria_incluir).toHaveLength(83);
    expect(manifest.fontes.metropolitana.contagem_esperada_snapshot).toBe(1355);
    expect(manifest.fontes.ride.codigos_categoria_incluir).toEqual(["01301", "03101", "07801"]);
    expect(manifest.fontes.ride.contagem_esperada_snapshot).toBe(56);
    expect(manifest.fontes.metropolitana.runtime_pronto).toBe(true);
    expect(manifest.fontes.ride.runtime_pronto).toBe(true);
  });

  it("os sete recortes públicos estão prontos no runtime snapshot", () => {
    const prontos = Object.entries(manifest.fontes)
      .filter(([, fonte]) => fonte.runtime_pronto)
      .map(([tema]) => tema)
      .sort();
    expect(prontos).toEqual(
      ["amazonia_legal", "biomas", "costeiro", "fronteira", "metropolitana", "ride", "semiarido"].sort()
    );
  });

  it("Amazônia Legal e Semiárido explicitam composição municipal com geometria agregada", () => {
    for (const tema of ["amazonia_legal", "semiarido"]) {
      expect(manifest.fontes[tema].snapshot_pronto).toBe(true);
      expect(manifest.fontes[tema].runtime_pronto).toBe(true);
      expect(manifest.fontes[tema].contrato_runtime).toBe(
        "composicao_municipal_com_geometria_agregada"
      );
    }
  });
  it("RM e RIDE usam a mesma fonte bruta, mas snapshots semanticamente separados", () => {
    expect(manifest.fontes.metropolitana.url).toBe(manifest.fontes.ride.url);
    expect(manifest.fontes.metropolitana.versao).toBe(manifest.fontes.ride.versao);
  });
});
