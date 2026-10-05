/**
 * Gate real mínimo das ferramentas auxiliares do bloco 3C.
 *
 * Não fixa conteúdo editorial volátil. Valida somente que cada upstream real
 * continua respondendo com shape estruturado e proveniência oficial.
 */
import { describe, expect, it } from "vitest";
import { ibgeCnae } from "../src/tools/cnae.js";
import { ibgeNomes } from "../src/tools/nomes.js";
import { ibgeNoticias } from "../src/tools/noticias.js";
import { ibgeCalendario } from "../src/tools/calendario.js";
import { ibgePaises } from "../src/tools/paises.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";

function expectProveniencia(result: {
  isError?: boolean;
  provenance?: { source_url?: string; source?: { name?: string } };
}): void {
  expect(result.isError).toBeFalsy();
  expect(result.provenance?.source_url).toMatch(/^https:\/\//);
  expect(result.provenance?.source?.name).toContain("IBGE");
}

describe.skipIf(!LIVE)("contrato real das ferramentas auxiliares", () => {
  it("CNAE resolve uma seção estável", async () => {
    const resultado = await ibgeCnae({ codigo: "A", limite: 20 });
    expectProveniencia(resultado);

    const structured = resultado.structured as {
      modo: string;
      codigo?: { id: string; descricao: string; nivel: string };
    };
    expect(structured.modo).toBe("codigo");
    expect(structured.codigo?.id).toBe("A");
    expect(structured.codigo?.nivel).toBe("secao");
  }, 30000);

  it("Nomes retorna frequência real para Maria", async () => {
    const resultado = await ibgeNomes({ tipo: "frequencia", nomes: "Maria", limite: 20 });
    expectProveniencia(resultado);

    const structured = resultado.structured as {
      tipo: string;
      frequencia?: Array<{ nome: string; periodos: unknown[] }>;
    };
    expect(structured.tipo).toBe("frequencia");
    expect(structured.frequencia?.length).toBeGreaterThan(0);
    expect(structured.frequencia?.[0]?.nome.toUpperCase()).toBe("MARIA");
  }, 30000);

  it("Notícias retorna shape estrutural sem fixar manchete", async () => {
    const resultado = await ibgeNoticias({ quantidade: 1, pagina: 1 });
    expectProveniencia(resultado);

    const structured = resultado.structured as {
      noticias?: Array<{ titulo: string; dataPublicacao: string; link: string }>;
      total?: number;
    };
    expect((structured.noticias?.length ?? 0)).toBeGreaterThan(0);
    expect(structured.noticias?.[0]?.titulo).toEqual(expect.any(String));
    expect(structured.noticias?.[0]?.dataPublicacao).toEqual(expect.any(String));
    expect(structured.noticias?.[0]?.link).toMatch(/^https?:\/\//);
  }, 30000);

  it("Calendário retorna evento real sem fixar conteúdo editorial", async () => {
    const resultado = await ibgeCalendario({ tipo: "todos", quantidade: 1, pagina: 1 });
    expectProveniencia(resultado);

    const structured = resultado.structured as {
      eventos?: Array<{ id: number; titulo: string; dataDivulgacao: string }>;
      total?: number;
    };
    expect((structured.eventos?.length ?? 0)).toBeGreaterThan(0);
    expect(structured.eventos?.[0]?.id).toEqual(expect.any(Number));
    expect(structured.eventos?.[0]?.dataDivulgacao).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
  }, 30000);

  it("Países resolve Brasil com estrutura e proveniência", async () => {
    const resultado = await ibgePaises({ tipo: "detalhes", pais: "BR" });
    expectProveniencia(resultado);

    const structured = resultado.structured as {
      tipo: string;
      pais?: { nome: string; isoAlpha2: string; m49: number };
    };
    expect(structured.tipo).toBe("detalhes");
    expect(structured.pais?.isoAlpha2).toBe("BR");
    expect(structured.pais?.nome).toBeTruthy();
    expect(structured.pais?.m49).toBe(76);
  }, 30000);
});
