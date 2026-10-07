import { z } from "zod";
import booleanTouches from "@turf/boolean-touches";
import centroid from "@turf/centroid";
import distance from "@turf/distance";
import { IBGE_API, Municipio } from "../types.js";
import { cacheKey, CACHE_TTL, cachedFetch } from "../cache.js";
import { withMetrics } from "../metrics.js";
import { formatNumber } from "../utils/index.js";
import { parseHttpError, ValidationErrors } from "../errors.js";
import { isValidIbgeCode, formatValidationError } from "../validation.js";
import { resolveUf } from "../config.js";
import { RETRY_PRESETS } from "../retry.js";
import { fetchSidra } from "../sidra-agregados.js";
import { sidraRecords, type StructuredToolResult } from "../structured.js";
import { extrairPeriodoSidra, provenienciaIbge } from "../provenance.js";

// Schema for the tool input
export const vizinhosSchema = z.object({
  municipio: z.string().describe("Código IBGE do município (7 dígitos) ou nome do município"),
  uf: z
    .string()
    .optional()
    .describe(
      "Estado por sigla (SP), nome (São Paulo) ou código IBGE (35) — obrigatório se usar nome do município"
    ),
  raio: z
    .number()
    .positive()
    .optional()
    .describe(
      "Raio em km para buscar municípios próximos, calculado pela distância entre centróides municipais"
    ),
  incluir_dados: z
    .boolean()
    .optional()
    .default(false)
    .describe("Incluir dados populacionais dos vizinhos"),
});

export type VizinhosInput = z.infer<typeof vizinhosSchema>;

/** Structured output payload (validated against this schema by the MCP SDK). */
export const vizinhosOutputSchema = z.object({
  municipio: z
    .object({
      codigo: z.string().describe("Código IBGE do município consultado"),
      nome: z.string().describe("Nome do município consultado"),
    })
    .describe("Município de referência da consulta"),
  vizinhos: z
    .array(
      z.object({
        codigo: z.string().describe("Código IBGE do município vizinho"),
        nome: z.string().describe("Nome do município vizinho"),
        uf: z.string().optional().describe("Sigla da UF do município vizinho"),
        populacao: z
          .number()
          .optional()
          .describe("População do município vizinho (apenas quando incluir_dados=true)"),
        populacao_ano: z
          .string()
          .optional()
          .describe("Período de referência da população enriquecida via SIDRA"),
        populacao_tabela: z
          .string()
          .optional()
          .describe("Tabela SIDRA usada no enriquecimento populacional"),
        distancia_km: z
          .number()
          .optional()
          .describe("Distância entre centróides municipais em km, quando raio é informado"),
      })
    )
    .describe("Lista de municípios contíguos ou próximos, conforme o critério espacial solicitado"),
  total: z.number().describe("Quantidade de municípios encontrados"),
});

/**
 * Gets neighboring municipalities using IBGE municipal meshes.
 * Without raio, uses polygon contiguity; with raio, uses centroid distance.
 */
export async function ibgeVizinhos(input: VizinhosInput): Promise<StructuredToolResult> {
  return withMetrics("ibge_vizinhos", "localidades", async () => {
    try {
      // Get municipality code
      let municipioId: string;
      let municipioNome: string;

      if (/^\d{7}$/.test(input.municipio)) {
        // Validate IBGE code format
        if (!isValidIbgeCode(input.municipio)) {
          return {
            markdown: formatValidationError(
              "municipio",
              input.municipio,
              "Código IBGE de município com 7 dígitos"
            ),
            isError: true,
          };
        }
        municipioId = input.municipio;
        // Get municipality name
        const munInfo = await getMunicipioInfo(municipioId);
        if (!munInfo) {
          return {
            markdown: ValidationErrors.notFound(
              `Município com código ${municipioId}`,
              "ibge_vizinhos",
              "ibge_municipios"
            ),
            isError: true,
          };
        }
        municipioNome = munInfo.nome;
      } else {
        // Search by name
        if (!input.uf) {
          return {
            markdown: formatValidationError(
              "uf",
              "(não informado)",
              "Estado (sigla, nome ou código) é obrigatório ao buscar por nome de município"
            ),
            isError: true,
          };
        }
        const ufResolved = resolveUf(input.uf);
        if (!ufResolved) {
          return {
            markdown: formatValidationError(
              "uf",
              input.uf,
              "Estado por sigla (SP), nome (São Paulo) ou código IBGE (35)"
            ),
            isError: true,
          };
        }
        const munInfo = await findMunicipioByName(input.municipio, ufResolved.code);
        if (!munInfo) {
          return {
            markdown: ValidationErrors.notFound(
              `Município "${input.municipio}" em ${ufResolved.sigla}`,
              "ibge_vizinhos",
              "ibge_municipios"
            ),
            isError: true,
          };
        }
        municipioId = String(munInfo.id);
        municipioNome = munInfo.nome;
      }

      // Get neighboring/proximate municipalities from official municipal meshes.
      const vizinhos = await getVizinhosFromMalha(municipioId, input.raio);

      if (vizinhos.length === 0) {
        return {
          markdown: formatNoNeighborsFound(municipioNome, municipioId),
          isError: true,
        };
      }

      // Get additional data if requested
      let vizinhosData: VizinhoInfo[] = vizinhos.map((v) => ({
        codigo: v.codigo,
        nome: v.nome,
        uf: v.uf,
        distancia_km: v.distancia_km,
      }));

      if (input.incluir_dados) {
        vizinhosData = await enrichVizinhosData(vizinhosData);
      }

      const malhaUrl = buildMalhaMunicipalUfUrl(municipioId.substring(0, 2));
      const provenance = provenienciaIbge({
        fonte: "MALHAS",
        url: malhaUrl,
        chaveCache: cacheKey(malhaUrl),
        pesquisa:
          input.raio !== undefined
            ? "API de Malhas Geográficas (proximidade municipal por centróides)"
            : "API de Malhas Geográficas (contiguidade municipal)",
      });

      const markdown = formatResponse(municipioNome, municipioId, vizinhosData, input);
      return {
        markdown,
        provenance,
        structured: {
          municipio: { codigo: municipioId, nome: municipioNome },
          vizinhos: vizinhosData.map((v) => ({
            codigo: v.codigo,
            nome: v.nome,
            ...(v.uf !== undefined ? { uf: v.uf } : {}),
            ...(v.populacao !== undefined ? { populacao: v.populacao } : {}),
            ...(v.populacao_ano !== undefined ? { populacao_ano: v.populacao_ano } : {}),
            ...(v.populacao_tabela !== undefined ? { populacao_tabela: v.populacao_tabela } : {}),
            ...(v.distancia_km !== undefined ? { distancia_km: v.distancia_km } : {}),
          })),
          total: vizinhosData.length,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          markdown: parseHttpError(
            error,
            "ibge_vizinhos",
            {
              municipio: input.municipio,
              uf: input.uf,
            },
            ["ibge_municipios", "ibge_geocodigo"]
          ),
          isError: true,
        };
      }
      return { markdown: ValidationErrors.emptyResult("ibge_vizinhos"), isError: true };
    }
  });
}

interface VizinhoInfo {
  codigo: string;
  nome: string;
  uf?: string;
  populacao?: number;
  populacao_ano?: string;
  populacao_tabela?: string;
  area?: number;
  distancia_km?: number;
}

async function getMunicipioInfo(codigo: string): Promise<Municipio | null> {
  try {
    const url = `${IBGE_API.LOCALIDADES}/municipios/${codigo}`;
    const key = cacheKey(url);

    const data = await cachedFetch<Municipio>(url, key, CACHE_TTL.STATIC);
    return data;
  } catch {
    return null;
  }
}

async function findMunicipioByName(nome: string, uf: string | number): Promise<Municipio | null> {
  try {
    const url = `${IBGE_API.LOCALIDADES}/estados/${uf}/municipios`;
    const key = cacheKey(url);

    const municipios = await cachedFetch<Municipio[]>(url, key, CACHE_TTL.STATIC);

    const normalized = nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const found = municipios.find((m) => {
      const mNorm = m.nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return mNorm === normalized || mNorm.includes(normalized);
    });

    return found || null;
  } catch {
    return null;
  }
}

async function getMunicipiosByUf(ufCode: string): Promise<Municipio[]> {
  try {
    const url = `${IBGE_API.LOCALIDADES}/estados/${ufCode}/municipios`;
    const key = cacheKey(url);
    return await cachedFetch<Municipio[]>(url, key, CACHE_TTL.STATIC);
  } catch {
    return [];
  }
}

function buildMalhaMunicipalUfUrl(ufCode: string): string {
  return (
    `${IBGE_API.MALHAS}/estados/${ufCode}` +
    "?formato=application/vnd.geo+json" +
    "&qualidade=minima" +
    "&intrarregiao=municipio"
  );
}

const UFS_LIMÍTROFES: Record<string, string[]> = {
  "11": ["13", "51", "12"],
  "12": ["11", "13"],
  "13": ["11", "12", "14", "15", "51"],
  "14": ["13", "15"],
  "15": ["13", "14", "16", "21", "17", "51"],
  "16": ["15"],
  "17": ["15", "21", "22", "29", "52", "51"],
  "21": ["15", "17", "22"],
  "22": ["21", "23", "26", "29", "17"],
  "23": ["22", "26", "25", "24"],
  "24": ["23", "25"],
  "25": ["23", "24", "26"],
  "26": ["22", "23", "25", "27", "29"],
  "27": ["26", "28", "29"],
  "28": ["27", "29"],
  "29": ["17", "22", "26", "27", "28", "31", "32", "52"],
  "31": ["29", "32", "33", "35", "52", "53"],
  "32": ["29", "31", "33"],
  "33": ["31", "32", "35"],
  "35": ["31", "33", "41", "50"],
  "41": ["35", "42", "50"],
  "42": ["41", "43"],
  "43": ["42"],
  "50": ["35", "41", "51", "52", "53"],
  "51": ["11", "13", "15", "17", "50", "52"],
  "52": ["17", "29", "31", "50", "51", "53"],
  "53": ["31", "50", "52"],
};

interface MalhaMunicipalFeature {
  type: "Feature";
  properties?: { codarea?: string; [key: string]: unknown };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } | null;
}

interface MalhaMunicipalCollection {
  type: "FeatureCollection";
  features: MalhaMunicipalFeature[];
}

async function getVizinhosFromMalha(municipioId: string, raio?: number): Promise<VizinhoInfo[]> {
  try {
    const ufCode = municipioId.substring(0, 2);
    const ufCodes = [ufCode, ...(UFS_LIMÍTROFES[ufCode] ?? [])];
    const conjuntos = await Promise.all(
      ufCodes.map(async (codigoUf) => {
        const malhaUrl = buildMalhaMunicipalUfUrl(codigoUf);
        const [malha, municipios] = await Promise.all([
          cachedFetch<MalhaMunicipalCollection>(malhaUrl, cacheKey(malhaUrl), CACHE_TTL.STATIC),
          getMunicipiosByUf(codigoUf),
        ]);
        return { codigoUf, malha, municipios };
      })
    );

    const conjuntoReferencia = conjuntos.find((c) => c.codigoUf === ufCode);
    if (
      !conjuntoReferencia ||
      conjuntoReferencia.malha.type !== "FeatureCollection" ||
      !Array.isArray(conjuntoReferencia.malha.features)
    ) {
      return [];
    }

    const referencia = conjuntoReferencia.malha.features.find(
      (f) => String(f.properties?.codarea ?? "") === municipioId
    );
    if (!referencia?.geometry) return [];

    const resultados: VizinhoInfo[] = [];
    const centroRef =
      raio !== undefined
        ? centroid(referencia as unknown as Parameters<typeof centroid>[0])
        : undefined;

    for (const { malha, municipios } of conjuntos) {
      if (malha.type !== "FeatureCollection" || !Array.isArray(malha.features)) continue;
      const porCodigo = new Map(municipios.map((m) => [String(m.id), m]));

      for (const feature of malha.features) {
        const codigo = String(feature.properties?.codarea ?? "");
        if (!codigo || codigo === municipioId || !feature.geometry) continue;
        const municipio = porCodigo.get(codigo);
        if (!municipio) continue;

        try {
          if (raio !== undefined && centroRef) {
            const centro = centroid(feature as unknown as Parameters<typeof centroid>[0]);
            const km = distance(centroRef, centro, { units: "kilometers" });
            if (km <= raio) {
              resultados.push({
                codigo,
                nome: municipio.nome,
                uf: municipio.microrregiao?.mesorregiao?.UF?.sigla,
                distancia_km: Number(km.toFixed(2)),
              });
            }
          } else if (
            booleanTouches(
              referencia as unknown as Parameters<typeof booleanTouches>[0],
              feature as unknown as Parameters<typeof booleanTouches>[1]
            )
          ) {
            resultados.push({
              codigo,
              nome: municipio.nome,
              uf: municipio.microrregiao?.mesorregiao?.UF?.sigla,
            });
          }
        } catch {
          continue;
        }
      }
    }

    const unicos = [...new Map(resultados.map((v) => [v.codigo, v])).values()];
    unicos.sort(
      raio !== undefined
        ? (a, b) => (a.distancia_km ?? Infinity) - (b.distancia_km ?? Infinity)
        : (a, b) => a.nome.localeCompare(b.nome, "pt-BR")
    );
    return unicos;
  } catch {
    return [];
  }
}

async function enrichVizinhosData(vizinhos: VizinhoInfo[]): Promise<VizinhoInfo[]> {
  // Get population data for neighbors
  const enriched: VizinhoInfo[] = [];

  for (const v of vizinhos) {
    try {
      // Try to get population from SIDRA
      // Pela API de Agregados v3 (ver src/sidra-agregados.ts); o `/f/n` do
      // apisidra é ignorado na tradução — a v3 já devolve o valor em `V`.
      const { data } = await fetchSidra(
        `/t/4709/n6/${v.codigo}/v/93/p/last/f/n`,
        CACHE_TTL.SHORT,
        RETRY_PRESETS.QUICK
      );
      if (data && data.length > 1 && data[1].V) {
        v.populacao = parseInt(data[1].V);
        v.populacao_tabela = "4709";
        const registros = sidraRecords(data as Record<string, string>[]);
        const periodo = extrairPeriodoSidra(registros.colunas, registros.registros);
        if (periodo) v.populacao_ano = periodo;
      }
    } catch {
      // Ignore errors, just don't add population
    }

    enriched.push(v);
  }

  return enriched;
}

function formatResponse(
  municipioNome: string,
  municipioId: string,
  vizinhos: VizinhoInfo[],
  input: VizinhosInput
): string {
  const porRaio = input.raio !== undefined;
  let output = `## Municípios Próximos: ${municipioNome}\n\n`;
  output += `**Código IBGE:** ${municipioId}\n`;
  output += `**Quantidade encontrada:** ${vizinhos.length}\n`;
  output += porRaio
    ? `**Critério espacial:** distância entre centróides municipais de até ${input.raio} km.\n\n`
    : "**Critério espacial:** contiguidade entre as geometrias municipais da malha oficial do IBGE.\n\n";

  if (input.incluir_dados && porRaio) {
    output += "| Código | Município | UF | Distância | População | Ano |\n";
    output += "|:------:|:----------|:--:|----------:|----------:|:---:|\n";
    for (const v of vizinhos) {
      const pop = v.populacao ? formatNumber(v.populacao) : "-";
      const km = v.distancia_km !== undefined ? `${v.distancia_km.toFixed(2)} km` : "-";
      output += `| ${v.codigo} | ${v.nome} | ${v.uf || "-"} | ${km} | ${pop} | ${v.populacao_ano || "-"} |\n`;
    }
  } else if (input.incluir_dados) {
    output +=
      "| Código | Município | UF | População | Ano |\n|:------:|:----------|:--:|----------:|:---:|\n";
    for (const v of vizinhos) {
      output += `| ${v.codigo} | ${v.nome} | ${v.uf || "-"} | ${v.populacao ? formatNumber(v.populacao) : "-"} | ${v.populacao_ano || "-"} |\n`;
    }
  } else if (porRaio) {
    output += "| Código | Município | UF | Distância |\n|:------:|:----------|:--:|----------:|\n";
    for (const v of vizinhos) {
      output += `| ${v.codigo} | ${v.nome} | ${v.uf || "-"} | ${v.distancia_km?.toFixed(2) ?? "-"} km |\n`;
    }
  } else {
    output += "| Código | Município | UF |\n|:------:|:----------|:--:|\n";
    for (const v of vizinhos) output += `| ${v.codigo} | ${v.nome} | ${v.uf || "-"} |\n`;
  }
  if (input.incluir_dados) {
    output +=
      "\n**População:** SIDRA, Tabela 4709; o período de referência é informado " +
      "por município na coluna Ano.\n";
  }
  output += porRaio
    ? "\n---\n\n**Nota metodológica:** a distância é calculada entre os centróides das geometrias municipais, não entre seus limites.\n"
    : "\n---\n\n**Nota metodológica:** a vizinhança é definida por contato entre as geometrias municipais da malha oficial do IBGE.\n";
  return output;
}

function formatNoNeighborsFound(municipioNome: string, municipioId: string): string {
  let output = `## Municípios Vizinhos: ${municipioNome}\n\n`;
  output += `**Código IBGE:** ${municipioId}\n\n`;
  output += "Não foi possível determinar os municípios vizinhos automaticamente.\n\n";
  output += "### Sugestões\n\n";
  output +=
    '1. Use `ibge_malhas(localidade="' +
    municipioId +
    '", resolucao="5")` para visualizar a região\n';
  output += "2. Consulte o mapa do estado para identificar vizinhos\n";
  output += '3. Use `ibge_municipios(uf="XX")` para listar todos os municípios do estado\n';

  return output;
}
