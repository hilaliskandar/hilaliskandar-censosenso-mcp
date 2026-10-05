/**
 * Gate real dos indicadores sintéticos de estrutura etária do Censo 2022.
 */
import { describe, expect, it } from "vitest";
import { ibgeCenso } from "../src/tools/censo.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";
const CAMPINAS = "3509502";

describe.skipIf(!LIVE)("estrutura etária municipal real — Censo 2022", () => {
  it("Campinas retorna índice de envelhecimento, idade mediana e razão de sexo", async () => {
    const result = await ibgeCenso({
      ano: "2022",
      tema: "estrutura_etaria",
      nivel_territorial: "6",
      localidades: CAMPINAS,
      formato: "json",
    });

    expect(result.isError).toBeFalsy();

    const s = result.structured as {
      tabela: string;
      totalRegistros: number;
      registros: Array<Record<string, string>>;
    };

    expect(s.tabela).toBe("9515");
    expect(s.totalRegistros).toBe(3);

    const porVariavel = new Map(s.registros.map((r) => [r.Variável, r.Valor]));
    expect(porVariavel.has("Índice de envelhecimento")).toBe(true);
    expect(porVariavel.has("Idade mediana")).toBe(true);
    expect(porVariavel.has("Razão de sexo")).toBe(true);

    expect(result.provenance?.source_url).toContain("/agregados/9515/");
    expect(result.provenance?.source_url).toContain("/variaveis/10612,10613,8845");
  }, 30000);
});
