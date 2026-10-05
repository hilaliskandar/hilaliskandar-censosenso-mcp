import { describe, expect, it } from "vitest";
import {
  deterministicSample,
  normalizeMunicipio,
  validateMunicipios,
} from "../scripts/gate-sp-645.mjs";

function municipio(codigo: string, nome: string, intermediaria = 1) {
  return {
    codigo,
    nome,
    uf_codigo: 35,
    uf_sigla: "SP",
    uf_nome: "São Paulo",
    regiao_codigo: 3,
    regiao_sigla: "SE",
    regiao_nome: "Sudeste",
    regiao_imediata_codigo: intermediaria * 10 + 1,
    regiao_imediata_nome: `Imediata ${intermediaria}`,
    regiao_intermediaria_codigo: intermediaria,
    regiao_intermediaria_nome: `Intermediária ${intermediaria}`,
    microrregiao_codigo: null,
    microrregiao_nome: null,
    mesorregiao_codigo: null,
    mesorregiao_nome: null,
  };
}

function universo645() {
  const regs = [];
  for (let i = 1; i <= 643; i++) {
    const codigo = String(3500000 + i);
    const nome = i === 1 ? "Águas de Teste" : `Município Teste ${String(i).padStart(3, "0")}`;
    regs.push(municipio(codigo, nome, (i % 7) + 1));
  }
  regs.push(municipio("3518305", "Guararema", 4));
  regs.push(municipio("3550308", "São Paulo", 2));
  return regs.sort((a, b) => a.codigo.localeCompare(b.codigo));
}

describe("gate SP 645", () => {
  it("normaliza a hierarquia moderna da API de Localidades", () => {
    const raw = {
      id: 3518305,
      nome: "Guararema",
      "regiao-imediata": {
        id: 35053,
        nome: "São José dos Campos",
        "regiao-intermediaria": {
          id: 3511,
          nome: "São José dos Campos",
          UF: {
            id: 35,
            sigla: "SP",
            nome: "São Paulo",
            regiao: { id: 3, sigla: "SE", nome: "Sudeste" },
          },
        },
      },
    };

    expect(normalizeMunicipio(raw)).toMatchObject({
      codigo: "3518305",
      nome: "Guararema",
      uf_codigo: 35,
      uf_sigla: "SP",
      regiao_codigo: 3,
      regiao_imediata_codigo: 35053,
      regiao_intermediaria_codigo: 3511,
    });
  });

  it("aceita exatamente 645 códigos paulistas únicos e coerentes", () => {
    const result = validateMunicipios(universo645());
    expect(result.ok).toBe(true);
    expect(result.globais).toEqual([]);
    expect(result.divergencias).toEqual([]);
    expect(result.linhas).toHaveLength(645);
    expect(result.linhas.every((x: { status: string }) => x.status === "OK")).toBe(true);
  });

  it("detecta total incorreto, duplicidade e UF divergente", () => {
    const regs = universo645().slice(0, 644);
    regs[1] = { ...regs[1], codigo: regs[0].codigo, uf_sigla: "RJ" };

    const result = validateMunicipios(regs);
    expect(result.ok).toBe(false);
    expect(result.globais.some((x: string) => x.startsWith("TOTAL_ESPERADO_645"))).toBe(true);
    expect(result.globais).toContain("CODIGOS_NAO_UNICOS");
    expect(result.divergencias.length).toBeGreaterThan(0);
  });

  it("gera amostra determinística com Guararema, capital e regiões intermediárias", () => {
    const regs = universo645();
    const a = deterministicSample(regs);
    const b = deterministicSample(regs);

    expect(a).toEqual(b);
    expect(a.map((x: { codigo: string }) => x.codigo)).toContain("3518305");
    expect(a.map((x: { codigo: string }) => x.codigo)).toContain("3550308");

    const intermediarias = new Set(regs.map((x) => x.regiao_intermediaria_codigo));
    const amostraIntermediarias = new Set(
      a.map((x: { regiao_intermediaria_codigo: number }) => x.regiao_intermediaria_codigo)
    );
    for (const id of intermediarias) expect(amostraIntermediarias).toContain(id);

    expect(a.some((x: { nome: string }) => /[ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]/u.test(x.nome))).toBe(true);
    expect(a.some((x: { nome: string }) => /\s/.test(x.nome))).toBe(true);
  });
});
