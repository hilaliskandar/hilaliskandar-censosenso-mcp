import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ibgeVizinhos, vizinhosOutputSchema } from "../src/tools/vizinhos.js";
import { cache } from "../src/cache.js";
import { mockResponse } from "./helpers.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mun(id: number, nome: string, sigla = "SP") {
  return { id, nome, microrregiao: { mesorregiao: { UF: { sigla } } } };
}

const campinas = mun(3509502, "Campinas");
const americana = mun(3501608, "Americana");
const jaguariuna = mun(3524709, "Jaguariúna");
const saoPaulo = mun(3550308, "São Paulo");
const municipiosSP = [campinas, americana, jaguariuna, saoPaulo];

function feature(codarea: string, coords: number[][][]) {
  return {
    type: "Feature",
    properties: { codarea },
    geometry: { type: "Polygon", coordinates: coords },
  };
}

const malhaSP = {
  type: "FeatureCollection",
  features: [
    feature("3509502", [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]),
    feature("3501608", [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]]),
    feature("3524709", [[[0, 1], [1, 1], [1, 2], [0, 2], [0, 1]]]),
    feature("3550308", [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]]),
  ],
};

const malhaVazia = { type: "FeatureCollection", features: [] };

function mockVizinhosPorUrl() {
  mockFetch.mockImplementation(async (url: string | URL) => {
    const alvo = String(url);

    if (/\/localidades\/municipios\/3509502$/.test(alvo)) {
      return mockResponse(campinas);
    }
    if (/\/localidades\/estados\/35\/municipios/.test(alvo)) {
      return mockResponse(municipiosSP);
    }
    if (/\/malhas\/estados\/35\?/.test(alvo)) {
      return mockResponse(malhaSP);
    }
    if (/\/localidades\/estados\/(31|33|41|50)\/municipios/.test(alvo)) {
      return mockResponse([]);
    }
    if (/\/malhas\/estados\/(31|33|41|50)\?/.test(alvo)) {
      return mockResponse(malhaVazia);
    }

    return mockResponse({ erro: `sem mock para ${alvo}` }, 404);
  });
}

describe("ibge_vizinhos — lógica espacial", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    cache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna municípios contíguos pela geometria quando raio não é informado", async () => {
    mockVizinhosPorUrl();

    const result = await ibgeVizinhos({ municipio: "3509502", incluir_dados: false });
    expect(result.isError).toBeFalsy();
    expect(result.markdown).toContain("contiguidade");
    expect(result.markdown).toContain("Americana");
    expect(result.markdown).toContain("Jaguariúna");
    expect(result.markdown).not.toContain("São Paulo");

    const structured = result.structured as {
      vizinhos: Array<{ codigo: string }>;
      total: number;
    };
    expect(structured.total).toBe(2);
    expect(structured.vizinhos.map((v) => v.codigo).sort()).toEqual([
      "3501608",
      "3524709",
    ]);
    expect(vizinhosOutputSchema.safeParse(result.structured).success).toBe(true);
  });

  it("usa distância entre centróides e ordena por distância quando raio é informado", async () => {
    mockVizinhosPorUrl();

    const result = await ibgeVizinhos({ municipio: "3509502", raio: 130 });
    expect(result.isError).toBeFalsy();
    expect(result.markdown).toContain("distância entre centróides");
    expect(result.markdown).not.toContain("São Paulo");

    const structured = result.structured as {
      vizinhos: Array<{ codigo: string; distancia_km?: number }>;
    };
    expect(structured.vizinhos).toHaveLength(2);
    expect(structured.vizinhos.every((v) => typeof v.distancia_km === "number")).toBe(true);
    expect(structured.vizinhos[0].distancia_km).toBeLessThanOrEqual(
      structured.vizinhos[1].distancia_km ?? Infinity
    );
  });

  it("resolve município por nome e UF antes da análise espacial", async () => {
    mockVizinhosPorUrl();

    const result = await ibgeVizinhos({ municipio: "Campinas", uf: "SP" });
    expect(result.isError).toBeFalsy();
    expect(result.markdown).toContain("Americana");
  });

  it("exige UF quando o município é informado por nome", async () => {
    const result = await ibgeVizinhos({ municipio: "Campinas" });
    expect(result.isError).toBe(true);
    expect(result.markdown).toContain("uf");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("não devolve a antiga seleção por prefixo de código", async () => {
    mockVizinhosPorUrl();

    const result = await ibgeVizinhos({ municipio: "3509502" });
    expect(result.markdown).not.toContain("São Paulo");
    expect(result.markdown).not.toContain("Caieiras");
    expect(result.markdown).not.toContain("Cajamar");
  });
});
