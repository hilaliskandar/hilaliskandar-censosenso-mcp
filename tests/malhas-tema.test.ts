/**
 * Contrato público de `ibge_malhas_tema`.
 *
 * Todos os sete recortes públicos usam snapshots versionados para atributos e
 * listagens. A ferramenta não depende de rede no runtime e não publica
 * geometria temática.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/data/recortes-gerados.js", () => ({
  RECORTES_GERADOS: {
    biomas: {
      tema: "biomas",
      versao: "2025",
      fonte_url:
        "https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/vetores/2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil-1-250000_shp.zip",
      produto_url: "https://www.ibge.gov.br/geociencias/informacoes-ambientais/vegetacao/15842-biomas.html",
      crs: "SIRGAS 2000",
      prj: "GEOGCS[\"GCS_SIRGAS_2000\"]",
      sha256_fonte: "a".repeat(64),
      total_registros: 6,
      registros: [
        { codigo_bioma: "1", bioma: "Amazônia" },
        { codigo_bioma: "2", bioma: "Caatinga" },
        { codigo_bioma: "3", bioma: "Cerrado" },
        { codigo_bioma: "4", bioma: "Mata Atlântica" },
        { codigo_bioma: "5", bioma: "Pampa" },
        { codigo_bioma: "6", bioma: "Pantanal" },
      ],
    },
    semiarido: {
      tema: "semiarido",
      versao: "2022",
      fonte_url: "https://geoftp.ibge.gov.br/semiarido.ods",
      produto_url: "https://www.ibge.gov.br/semiarido",
      sha256_fonte: "b".repeat(64),
      total_registros: 1,
      registros: [{ codigo_municipio: "2100105", municipio: "Afonso Cunha" }],
    },
  },
}));

import { ibgeMalhasTema, malhasTemaOutputSchema } from "../src/tools/malhas-tema.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ibge_malhas_tema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("catálogo", () => {
    it('tema="listar" não toca na rede', async () => {
      const { markdown, structured } = await ibgeMalhasTema({ tema: "listar", limite: 50 });
      expect(mockFetch).not.toHaveBeenCalled();
      expect(markdown).toContain("Recortes temáticos disponíveis");
      expect((structured as { temas: unknown[] }).temas).toHaveLength(7);
    });

    it("lista os sete recortes públicos", async () => {
      const { structured } = await ibgeMalhasTema({ tema: "listar", limite: 50 });
      const temas = (structured as { temas: Array<{ tema: string }> }).temas.map((t) => t.tema);
      expect(temas).toEqual([
        "biomas",
        "amazonia_legal",
        "semiarido",
        "costeiro",
        "fronteira",
        "metropolitana",
        "ride",
      ]);
    });
  });

  describe("backend snapshot de Biomas", () => {
    it("não consulta a rede para atributos/listagem", async () => {
      const result = await ibgeMalhasTema({ tema: "biomas", limite: 6 });
      expect(result.isError).toBeFalsy();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("preserva os seis registros e o contrato público", async () => {
      const { markdown, structured } = await ibgeMalhasTema({ tema: "biomas", limite: 3 });
      const s = structured as {
        versao: string;
        fonte_dados: string;
        tipo_registro: string;
        feicoes: number;
        feicoes_retornadas: number;
        registros: Array<Record<string, unknown>>;
      };

      expect(s.versao).toBe("2025");
      expect(s.feicoes).toBe(6);
      expect(s.feicoes_retornadas).toBe(3);
      expect(s.tipo_registro).toBe("feicao_geografica");
      expect(s.registros[0]).toEqual({ cd_bioma: "1", nm_bioma: "Amazônia" });
      expect(markdown).toContain("Amazônia");
      expect(markdown).toContain("mostrando 3");
      expect(s.fonte_dados).toContain("2025_Biomas-e-Sistema-Costeiro-Marinho-do-Brasil");
      expect(structured).not.toHaveProperty("url_geometria");
      expect(structured).not.toHaveProperty("unidade_geometria");
      expect(structured).not.toHaveProperty("camada");
      expect(malhasTemaOutputSchema.safeParse(structured).success).toBe(true);
    });


    it("o código numérico filtra o snapshot", async () => {
      const { structured } = await ibgeMalhasTema({ tema: "biomas", codigo: "4", limite: 50 });
      const s = structured as {
        feicoes: number;
        registros: Array<Record<string, unknown>>;
      };

      expect(s.feicoes).toBe(1);
      expect(s.registros).toEqual([{ cd_bioma: "4", nm_bioma: "Mata Atlântica" }]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("não publica contrato WFS nem geometria no payload", async () => {
      const { markdown, structured } = await ibgeMalhasTema({ tema: "biomas", limite: 50 });
      const serializado = JSON.stringify(structured);
      expect(serializado).not.toContain("coordinates");
      expect(serializado).not.toContain("url_geometria");
      expect(serializado).not.toContain("unidade_geometria");
      expect(serializado).not.toContain("geoservicos");
      expect(markdown).not.toContain("coordinates");
      expect(markdown).not.toContain("WFS");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("erros que ensinam", () => {
    it("código municipal filtra o Semiárido no snapshot", async () => {
      const { structured, isError } = await ibgeMalhasTema({
        tema: "semiarido",
        codigo: "2100105",
        limite: 50,
      });
      expect(isError).toBeFalsy();
      expect(structured?.feicoes).toBe(1);
      expect((structured?.registros as Array<Record<string, unknown>>)[0]).toMatchObject({
        cd_mun: "2100105",
        nm_mun: "Afonso Cunha",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("código não numérico de bioma é recusado antes de qualquer consulta", async () => {
      const { markdown, isError } = await ibgeMalhasTema({
        tema: "biomas",
        codigo: "amazonia",
        limite: 50,
      });
      expect(isError).toBe(true);
      expect(markdown).toContain("código do bioma");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("código de bioma inexistente vira mensagem útil", async () => {
      const { markdown, isError } = await ibgeMalhasTema({
        tema: "biomas",
        codigo: "99",
        limite: 50,
      });
      expect(isError).toBe(true);
      expect(markdown).toContain("Nenhuma feição encontrada");
      expect(markdown).toContain("99");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
