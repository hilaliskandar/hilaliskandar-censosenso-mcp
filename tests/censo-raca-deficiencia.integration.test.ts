/**
 * Gate real de cor/raça e deficiência no nível municipal — Censo 2022.
 */
import { describe, expect, it } from "vitest";
import { ibgeCenso } from "../src/tools/censo.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";
const CAMPINAS = "3509502";

describe.skipIf(!LIVE)("cor/raça e deficiência municipais — Censo 2022", () => {
  it("cor_raca retorna as cinco categorias publicadas além do total", async () => {
    const result = await ibgeCenso({
      ano: "2022",
      tema: "cor_raca",
      nivel_territorial: "6",
      localidades: CAMPINAS,
      formato: "json",
    });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { tabela: string; registros: Array<Record<string, string>> };
    expect(s.tabela).toBe("9605");
    const categorias = new Set(s.registros.map((r) => r["Cor ou raça"]));
    expect(categorias).toContain("Branca");
    expect(categorias).toContain("Preta");
    expect(categorias).toContain("Parda");
    expect(categorias).toContain("Amarela");
    expect(categorias).toContain("Indígena");
  }, 30000);

  it("deficiencia retorna o percentual municipal de pessoas 2+ com deficiência", async () => {
    const result = await ibgeCenso({
      ano: "2022",
      tema: "deficiencia",
      nivel_territorial: "6",
      localidades: CAMPINAS,
      formato: "json",
    });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { tabela: string; registros: Array<Record<string, string>> };
    expect(s.tabela).toBe("10125");
    const percentual = s.registros.find((r) => r["Variável (Código)"] === "13403");
    expect(percentual).toBeDefined();
    expect(percentual?.["Unidade de Medida"]).toBe("%");
  }, 30000);
});
