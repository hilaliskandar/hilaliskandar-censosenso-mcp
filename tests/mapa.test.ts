import { beforeEach, describe, expect, it, vi } from "vitest";
import { ibgeMapa, mapaOutputSchema } from "../src/tools/mapa.js";
import { cache } from "../src/cache.js";
import { mockResponse, sidraResponse } from "./helpers.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const sidra = sidraResponse(
  {
    D1C: "Município (Código)",
    D1N: "Município",
    V: "Valor",
    D2N: "Ano",
  },
  { D1C: "3509502", D1N: "Campinas", V: "1200000", D2N: "2026" },
  { D1C: "3525904", D1N: "Jundiaí", V: "450000", D2N: "2026" },
  { D1C: "3536505", D1N: "Paulínia", V: "120000", D2N: "2026" }
);

const malha = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { codarea: "3509502" },
      geometry: {
        type: "Polygon",
        coordinates: [[[-47.2, -23.1], [-46.9, -23.1], [-46.9, -22.8], [-47.2, -22.8], [-47.2, -23.1]]],
      },
    },
    {
      type: "Feature",
      properties: { codarea: "3525904" },
      geometry: {
        type: "Polygon",
        coordinates: [[[-46.9, -23.0], [-46.7, -23.0], [-46.7, -22.8], [-46.9, -22.8], [-46.9, -23.0]]],
      },
    },
    {
      type: "Feature",
      properties: { codarea: "3536505" },
      geometry: {
        type: "Polygon",
        coordinates: [[[-47.2, -22.9], [-47.0, -22.9], [-47.0, -22.7], [-47.2, -22.7], [-47.2, -22.9]]],
      },
    },
  ],
};

describe("ibge_mapa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  it("gera SVG coroplético para municípios de uma mesma UF", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidra)).mockResolvedValueOnce(mockResponse(malha));

    const result = await ibgeMapa({
      municipios: "3509502,3525904,3536505",
      indicador: "populacao",
      classificacao: "quantis",
      classes: 3,
      largura: 720,
    });

    expect(result.isError).toBeFalsy();
    expect(mockFetch.mock.calls[0][0]).toContain("/api/v3/agregados/6579/");
    expect(mockFetch.mock.calls[1][0]).toContain("/api/v3/malhas/estados/35");
    const structured = result.structured as Record<string, unknown>;
    expect(mapaOutputSchema.safeParse(structured).success).toBe(true);
    expect(structured.svg).toContain("<svg");
    expect(structured.svg).toContain("Campinas");
    expect(structured.svg).toContain("Jundiaí");
    expect(structured.bbox).toEqual([-47.2, -23.1, -46.7, -22.7]);
    const localidades = structured.localidades as Array<{ codigo: string; valor: number | null }>;
    expect(localidades).toHaveLength(3);
    expect(localidades.find((x) => x.codigo === "3509502")?.valor).toBe(1200000);
  });

  it("suporta intervalos iguais", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(sidra)).mockResolvedValueOnce(mockResponse(malha));

    const result = await ibgeMapa({
      municipios: "3509502,3525904,3536505",
      indicador: "populacao",
      classificacao: "intervalos_iguais",
      classes: 3,
      largura: 720,
    });

    expect(result.isError).toBeFalsy();
    const classes = (result.structured as { classes: Array<{ minimo: number; maximo: number }> }).classes;
    expect(classes).toHaveLength(3);
    expect(classes[0].minimo).toBe(120000);
    expect(classes.at(-1)?.maximo).toBe(1200000);
  });

  it("recusa municípios de UFs diferentes sem consultar a rede", async () => {
    const result = await ibgeMapa({
      municipios: "3509502,3304557",
      indicador: "populacao",
      classificacao: "quantis",
      classes: 5,
      largura: 720,
    });

    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("mesma UF");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("recusa mais de 50 municípios", async () => {
    const codigos = Array.from({ length: 51 }, (_, i) => "35" + String(10000 + i).padStart(5, "0"));
    const result = await ibgeMapa({
      municipios: codigos.join(","),
      indicador: "populacao",
      classificacao: "quantis",
      classes: 5,
      largura: 720,
    });

    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("Máximo de 50");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
