/**
 * Gate de consistência cruzada entre wrappers estatísticos.
 *
 * O teste não compara grandezas apenas parecidas: exige a MESMA tabela,
 * variável, nível, localidade e período quando os wrappers são equivalentes.
 */
import { describe, expect, it } from "vitest";
import { ibgeSidra } from "../src/tools/sidra.js";
import { ibgeIndicadores } from "../src/tools/indicadores.js";
import { ibgeCenso } from "../src/tools/censo.js";
import { ibgeCidades } from "../src/tools/cidades.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";
const GUARAREMA = "3518305";

describe.skipIf(!LIVE)("consistência cruzada real entre wrappers estatísticos", () => {
  it("estimativa populacional coincide entre ibge_indicadores e ibge_sidra", async () => {
    const indicador = await ibgeIndicadores({
      indicador: "populacao",
      nivel_territorial: "6",
      localidades: GUARAREMA,
      periodos: "2024",
    });
    const sidra = await ibgeSidra({
      tabela: "6579",
      variaveis: "9324",
      nivel_territorial: "6",
      localidades: GUARAREMA,
      periodos: "2024",
      formato: "json",
      pagina: 1,
    });

    expect(indicador.isError).toBeFalsy();
    expect(sidra.isError).toBeFalsy();
    expect(indicador.provenance?.source_url).toBe(sidra.provenance?.source_url);

    const a = indicador.structured as {
      tabela: string;
      registros: Array<Record<string, string>>;
    };
    const b = sidra.structured as {
      tabela: string;
      registros: Array<Record<string, string>>;
    };

    expect(a.tabela).toBe("6579");
    expect(b.tabela).toBe("6579");
    expect(a.registros).toEqual(b.registros);
    expect(a.registros.length).toBeGreaterThan(0);
    expect(a.registros.every((r) => r["Variável (Código)"] === "9324")).toBe(true);
  }, 30000);

  it("população censitária coincide entre ibge_censo e ibge_sidra na tabela 9514", async () => {
    const censo = await ibgeCenso({
      ano: "2022",
      tema: "populacao",
      nivel_territorial: "6",
      localidades: GUARAREMA,
      formato: "json",
    });
    const sidra = await ibgeSidra({
      tabela: "9514",
      variaveis: "allxp",
      nivel_territorial: "6",
      localidades: GUARAREMA,
      periodos: "2022",
      formato: "json",
      pagina: 1,
    });

    expect(censo.isError).toBeFalsy();
    expect(sidra.isError).toBeFalsy();
    expect(censo.provenance?.source_url).toBe(sidra.provenance?.source_url);

    const a = censo.structured as {
      tabela: string;
      totalRegistros: number;
      colunas: string[];
      registros: Array<Record<string, string>>;
    };
    const b = sidra.structured as {
      tabela: string;
      totalRegistros: number;
      colunas: string[];
      registros: Array<Record<string, string>>;
    };

    expect(a.tabela).toBe("9514");
    expect(b.tabela).toBe("9514");
    expect(a.totalRegistros).toBe(b.totalRegistros);
    expect(a.colunas).toEqual(b.colunas);
    expect(b.registros.length).toBeGreaterThan(0);
    expect(a.registros.slice(0, b.registros.length)).toEqual(b.registros);
  }, 30000);

  it("panorama de Guararema preserva vintage por indicador, sem impor ano único", async () => {
    const panorama = await ibgeCidades({ tipo: "panorama", municipio: GUARAREMA });

    expect(panorama.isError).toBeFalsy();
    expect(panorama.provenance?.source_url).toContain("/pesquisas/");

    const structured = panorama.structured as {
      tipo: string;
      municipio?: string;
      indicadores: Array<{ nome: string; valor: string; ano?: string }>;
    };

    expect(structured.tipo).toBe("panorama");
    expect(structured.municipio).toBe(GUARAREMA);
    expect(structured.indicadores.length).toBeGreaterThan(1);
    expect(structured.indicadores.every((i) => typeof i.ano === "string" && i.ano.length > 0)).toBe(
      true
    );
    expect(new Set(structured.indicadores.map((i) => i.ano)).size).toBeGreaterThan(1);
  }, 60000);
});
