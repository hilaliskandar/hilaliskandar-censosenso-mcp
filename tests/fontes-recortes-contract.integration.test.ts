import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fetchIntegracao } from "./integration-fetch.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";

const manifest = JSON.parse(
  fs.readFileSync(path.resolve("scripts/fontes_recortes_ibge.json"), "utf8")
) as {
  fontes: Record<
    string,
    {
      url?: string;
      snapshot_pronto?: boolean;
      contagem_esperada_bruta?: number;
    }
  >;
};

describe.skipIf(!LIVE)("contrato real das fontes estáticas de recortes", () => {
  const prontas = Object.entries(manifest.fontes).filter(([, fonte]) => fonte.snapshot_pronto);

  it("os sete recortes com snapshot pronto permanecem declarados", () => {
    expect(prontas.map(([tema]) => tema).sort()).toEqual(
      [
        "amazonia_legal",
        "biomas",
        "costeiro",
        "fronteira",
        "metropolitana",
        "ride",
        "semiarido",
      ].sort()
    );
  });

  for (const [tema, fonte] of prontas) {
    it(`${tema}: fonte oficial compactada responde e tem assinatura ZIP válida`, async () => {
      expect(fonte.url).toMatch(/^https:\/\/geoftp\.ibge\.gov\.br\//);
      const response = await fetchIntegracao(fonte.url!);
      expect(response.status, fonte.url).toBe(200);

      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(bytes.length, `${tema}: arquivo pequeno demais`).toBeGreaterThan(5_000);
      expect(bytes[0]).toBe(0x50);
      expect(bytes[1]).toBe(0x4b);
      expect(fonte.contagem_esperada_bruta).toBeGreaterThan(0);
    }, 60000);
  }
});
