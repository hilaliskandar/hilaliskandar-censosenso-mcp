/**
 * Gate real mínimo das ferramentas baseadas na API de Localidades.
 *
 * Objetivo: provar, com poucas chamadas determinísticas, que estados,
 * municípios, localidade e geocódigo continuam coerentes entre si e carregam
 * proveniência reproduzível. Roda apenas com INTEGRATION_TESTS=1.
 */
import { describe, expect, it } from "vitest";
import { ibgeEstados } from "../src/tools/estados.js";
import { ibgeMunicipios } from "../src/tools/municipios.js";
import { ibgeLocalidade } from "../src/tools/localidade.js";
import { ibgeGeocodigo } from "../src/tools/geocodigo.js";

const LIVE = process.env.INTEGRATION_TESTS === "1" || process.env.INTEGRATION_TESTS === "true";
const GUARAREMA = 3518305;

describe.skipIf(!LIVE)("contrato real da API de Localidades", () => {
  it("estados retorna as 27 UFs e identifica São Paulo", async () => {
    const resultado = await ibgeEstados({ ordenar: "nome" });

    expect(resultado.isError).toBeFalsy();
    expect(resultado.provenance?.source_url).toContain("/localidades/estados");

    const structured = resultado.structured as {
      estados: Array<{ id: number; sigla: string; nome: string; regiao: string }>;
      total: number;
    };

    expect(structured.total).toBe(27);
    expect(structured.estados).toContainEqual({
      id: 35,
      sigla: "SP",
      nome: "São Paulo",
      regiao: "Sudeste",
    });
  }, 30000);

  it("municípios de SP localiza Guararema pelo nome e código canônico", async () => {
    const resultado = await ibgeMunicipios({
      uf: "SP",
      busca: "Guararema",
      limite: 10,
    });

    expect(resultado.isError).toBeFalsy();
    expect(resultado.provenance?.source_url).toContain("/estados/35/municipios");

    const structured = resultado.structured as {
      municipios: Array<{ id: number; nome: string }>;
      total: number;
    };

    expect(structured.total).toBe(1);
    expect(structured.municipios).toContainEqual({ id: GUARAREMA, nome: "Guararema" });
  }, 30000);

  it("localidade resolve Guararema com hierarquia territorial de São Paulo", async () => {
    const resultado = await ibgeLocalidade({ codigo: GUARAREMA });

    expect(resultado.isError).toBeFalsy();
    expect(resultado.provenance?.source_url).toContain(`/localidades/municipios/${GUARAREMA}`);

    const structured = resultado.structured as {
      tipo: string;
      id: number;
      nome: string;
      estado?: { id: number; sigla: string; nome: string };
    };

    expect(structured.tipo).toBe("municipio");
    expect(structured.id).toBe(GUARAREMA);
    expect(structured.nome).toBe("Guararema");
    expect(structured.estado).toEqual({ id: 35, sigla: "SP", nome: "São Paulo" });
  }, 30000);

  it("geocódigo resolve nome e decodifica o mesmo código municipal", async () => {
    const porNome = await ibgeGeocodigo({ nome: "Guararema", uf: "SP" });
    const porCodigo = await ibgeGeocodigo({ codigo: String(GUARAREMA) });

    expect(porNome.isError).toBeFalsy();
    expect(porCodigo.isError).toBeFalsy();

    const busca = porNome.structured as {
      tipo: string;
      codigo?: number;
      nome?: string;
      hierarquia?: Array<{ nivel: string; codigo: number; nome: string }>;
    };
    const decode = porCodigo.structured as {
      tipo: string;
      codigo?: number;
      nome?: string;
      hierarquia?: Array<{ nivel: string; codigo: number; nome: string }>;
    };

    // Quando a busca por nome encontra exatamente um município, o contrato
    // deliberadamente resolve para o detalhe completo em vez de retornar
    // `tipo="lista"`. A lista é reservada a múltiplos matches.
    expect(busca.tipo).toBe("municipio");
    expect(busca.codigo).toBe(GUARAREMA);
    expect(busca.nome).toBe("Guararema");
    expect(busca.hierarquia?.some((n) => n.nivel === "UF" && n.codigo === 35)).toBe(true);

    expect(decode.tipo).toBe("municipio");
    expect(decode.codigo).toBe(GUARAREMA);
    expect(decode.nome).toBe("Guararema");
    expect(decode.hierarquia?.some((n) => n.nivel === "UF" && n.codigo === 35)).toBe(true);

    expect(busca.codigo).toBe(decode.codigo);
    expect(busca.nome).toBe(decode.nome);
    expect(porNome.provenance?.source_url).toContain(`/localidades/municipios/${GUARAREMA}`);
    expect(porCodigo.provenance?.source_url).toContain(`/localidades/municipios/${GUARAREMA}`);
  }, 30000);
});
