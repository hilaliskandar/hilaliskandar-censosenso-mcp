import { describe, expect, it } from "vitest";
import {
  DEEP_RESEARCH_ID_PREFIXES,
  entradasRecortes,
} from "../src/tools/deep-research.js";

describe("cobertura territorial do índice Deep Research", () => {
  it("indexa os sete recortes públicos como documentos próprios", () => {
    const itens = entradasRecortes();
    expect(itens).toHaveLength(7);
    expect(new Set(itens.map((x) => x.id)).size).toBe(7);
    expect(itens.every((x) => x.id.startsWith(DEEP_RESEARCH_ID_PREFIXES.recorte))).toBe(true);
    expect(itens.every((x) => /^https:\/\//.test(x.url))).toBe(true);

    expect(itens.map((x) => x.id).sort()).toEqual(
      [
        "recorte:amazonia_legal",
        "recorte:biomas",
        "recorte:costeiro",
        "recorte:fronteira",
        "recorte:metropolitana",
        "recorte:ride",
        "recorte:semiarido",
      ].sort()
    );
  });

  it("carrega nomes internos úteis para descoberta semântica", () => {
    const itens = entradasRecortes();
    const biomas = itens.find((x) => x.id === "recorte:biomas");
    const rm = itens.find((x) => x.id === "recorte:metropolitana");

    expect(JSON.stringify(biomas)).toMatch(/Mata Atlântica/i);
    expect(JSON.stringify(rm)).toMatch(/Campinas/i);
  });
});
