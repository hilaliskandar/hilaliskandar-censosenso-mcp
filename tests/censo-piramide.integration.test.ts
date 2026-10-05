/**
 * Gate real da pirâmide etária municipal do Censo 2022.
 *
 * O teste existe para impedir a regressão observada em 03/10/2026, quando
 * ibge_censo(tema="idade_sexo") consultava a tabela correta (9514), mas sem
 * expandir as classificações Sexo e Idade, devolvendo apenas o total municipal.
 */
import { describe, expect, it } from "vitest";
import { ibgeCenso } from "../src/tools/censo.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";
const CAMPINAS = "3509502";

describe.skipIf(!LIVE)("pirâmide etária municipal real — Censo 2022", () => {
  it("Campinas retorna ambos os sexos e múltiplas categorias de idade", async () => {
    const result = await ibgeCenso({
      ano: "2022",
      tema: "idade_sexo",
      nivel_territorial: "6",
      localidades: CAMPINAS,
      formato: "json",
    });

    expect(result.isError).toBeFalsy();

    const s = result.structured as {
      tabela: string;
      totalRegistros: number;
      colunas: string[];
      registros: Array<Record<string, string>>;
    };

    expect(s.tabela).toBe("9514");
    expect(s.colunas).toContain("Sexo");
    expect(s.colunas).toContain("Idade");
    expect(s.totalRegistros).toBeGreaterThan(20);

    const sexos = new Set(s.registros.map((r) => r.Sexo));
    expect(sexos.has("Homens")).toBe(true);
    expect(sexos.has("Mulheres")).toBe(true);

    const idades = new Set(s.registros.map((r) => r.Idade));
    expect(idades.size).toBeGreaterThan(10);
    expect([...idades].some((idade) => idade !== "Total")).toBe(true);

    expect(result.provenance?.source_url).toContain("/agregados/9514/");
    expect(result.provenance?.source_url).toContain("classificacao=2[4,5]|287[all]");
  }, 30000);
});
