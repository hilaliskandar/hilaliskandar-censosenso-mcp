/**
 * Gate real do bloco socioeconômico municipal do Censo 2022.
 */
import { describe, expect, it } from "vitest";
import { ibgeCenso } from "../src/tools/censo.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";
const CAMPINAS = "3509502";

describe.skipIf(!LIVE)("socioeconomia municipal real — Censo 2022", () => {
  it("educação expõe os quatro grandes níveis de instrução", async () => {
    const result = await ibgeCenso({
      ano: "2022",
      tema: "educacao",
      nivel_territorial: "6",
      localidades: CAMPINAS,
      formato: "json",
    });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { tabela: string; registros: Array<Record<string, string>> };
    expect(s.tabela).toBe("10061");
    const niveis = new Set(s.registros.map((r) => r["Nível de instrução"]));
    expect(niveis).toContain("Sem instrução e fundamental incompleto");
    expect(niveis).toContain("Fundamental completo e médio incompleto");
    expect(niveis).toContain("Médio completo e superior incompleto");
    expect(niveis).toContain("Superior completo");
  }, 30000);

  it("trabalho expõe o nível de ocupação municipal", async () => {
    const result = await ibgeCenso({
      ano: "2022",
      tema: "trabalho",
      nivel_territorial: "6",
      localidades: CAMPINAS,
      formato: "json",
    });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { tabela: string; registros: Array<Record<string, string>> };
    expect(s.tabela).toBe("10268");
    expect(
      s.registros.some((r) => r["Variável"] === "Nível de ocupação, na semana de referência, das pessoas de 10 anos ou mais de idade")
    ).toBe(true);
  }, 30000);

  it("rendimento expõe renda domiciliar per capita média e mediana", async () => {
    const result = await ibgeCenso({
      ano: "2022",
      tema: "rendimento",
      nivel_territorial: "6",
      localidades: CAMPINAS,
      formato: "json",
    });
    expect(result.isError).toBeFalsy();
    const s = result.structured as { tabela: string; registros: Array<Record<string, string>> };
    expect(s.tabela).toBe("10295");
    const codigos = new Set(s.registros.map((r) => r["Variável (Código)"]));
    expect(codigos).toContain("13431");
    expect(codigos).toContain("13534");
  }, 30000);
});
