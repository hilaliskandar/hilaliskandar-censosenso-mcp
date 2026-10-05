import { describe, expect, it } from "vitest";
import {
  DEEP_RESEARCH_ID_PREFIXES,
  entradasCenso,
  entradasSaude,
} from "../src/tools/deep-research.js";

describe("cobertura temática do índice Deep Research", () => {
  it("indexa todos os 17 temas censitários como documentos próprios", () => {
    const itens = entradasCenso();
    expect(itens).toHaveLength(17);
    expect(new Set(itens.map((x) => x.id)).size).toBe(17);
    expect(itens.every((x) => x.id.startsWith(DEEP_RESEARCH_ID_PREFIXES.censo))).toBe(true);
    expect(itens.every((x) => /^https:\/\//.test(x.url))).toBe(true);

    expect(itens.find((x) => x.id === "censo:saneamento")?.text).toMatch(/esgoto|abastecimento/i);
    expect(itens.find((x) => x.id === "censo:quilombolas")?.text).toMatch(/quilombol/i);
    expect(itens.find((x) => x.id === "censo:estrutura_etaria")?.text).toMatch(/envelhecimento|mediana|sexo/i);
  });

  it("indexa os nove indicadores auditados de saúde/condições de vida", () => {
    const itens = entradasSaude();
    expect(itens).toHaveLength(9);
    expect(new Set(itens.map((x) => x.id)).size).toBe(9);
    expect(itens.every((x) => x.id.startsWith(DEEP_RESEARCH_ID_PREFIXES.saude))).toBe(true);
    expect(itens.every((x) => /^https:\/\/sidra\.ibge\.gov\.br\/tabela\/\d+$/.test(x.url))).toBe(true);

    expect(itens.find((x) => x.id === "saude:mortalidade_infantil")?.text).toMatch(/mortalidade/i);
    expect(itens.find((x) => x.id === "saude:saneamento_esgoto")?.text).toMatch(/esgotamento/i);
  });

  it("mantém namespaces de IDs distintos para evitar colisões semânticas", () => {
    expect(DEEP_RESEARCH_ID_PREFIXES.censo).toBe("censo:");
    expect(DEEP_RESEARCH_ID_PREFIXES.saude).toBe("saude:");
    expect(DEEP_RESEARCH_ID_PREFIXES.sidra).toBe("sidra:");
    expect(DEEP_RESEARCH_ID_PREFIXES.indicador).toBe("ind:");
  });
});
