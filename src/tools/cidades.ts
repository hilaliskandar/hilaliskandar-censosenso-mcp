import { z } from "zod";
import { IBGE_API, PesquisaResultado, PesquisaIndicador, PesquisaDetalhe } from "../types.js";
import { cacheKey, CACHE_TTL, cachedFetch } from "../cache.js";
import { RETRY_PRESETS } from "../retry.js";
import { fetchSidra } from "../sidra-agregados.js";
import { withMetrics } from "../metrics.js";
import { createMarkdownTable, formatNumber } from "../utils/index.js";
import { parseHttpError, ValidationErrors } from "../errors.js";
import { isValidIbgeCode, formatValidationError } from "../validation.js";
import { sidraRecords, type StructuredToolResult } from "../structured.js";
import { provenienciaIbge } from "../provenance.js";

// Schema for the tool input
export const cidadesSchema = z.object({
  tipo: z
    .enum(["panorama", "indicador", "pesquisas", "historico"])
    .optional()
    .default("panorama")
    .describe(
      "Tipo de consulta: panorama (resumo geral), indicador (específico), pesquisas (listar), historico"
    ),
  municipio: z.string().optional().describe("Código IBGE do município (7 dígitos)"),
  uf: z.string().optional().describe("Código ou sigla da UF para filtrar (ex: 35 ou SP)"),
  indicador: z.string().optional().describe("ID do indicador ou nome para busca"),
  pesquisa: z.string().optional().describe("ID da pesquisa para filtrar indicadores"),
});

export type CidadesInput = z.infer<typeof cidadesSchema>;

/** Structured output payload (validated against this schema by the MCP SDK). */
export const cidadesOutputSchema = z.object({
  tipo: z.string().describe("Tipo de consulta (panorama, indicador, pesquisas, historico)"),
  municipio: z.string().optional().describe("Código IBGE do município"),
  nome: z.string().optional().describe("Nome do município/indicador"),
  indicadores: z
    .array(
      z.object({
        nome: z.string(),
        valor: z.string(),
        ano: z.string().optional(),
      })
    )
    .describe("Indicadores retornados (vazio para respostas de catálogo)"),
  avisos: z
    .array(z.string())
    .optional()
    .describe("Avisos de indisponibilidade parcial ou limitações da resposta"),
});

/** Minimal valid payload for catalog/listing responses. */
function listingPayload(tipo: string): Record<string, unknown> {
  return { tipo, indicadores: [] };
}

// Indicadores principais do panorama (usados em cidades.ibge.gov.br)
const INDICADORES_PANORAMA: Record<string, { id: number; pesquisa: string; nome: string }> = {
  populacao: { id: 29171, pesquisa: "33", nome: "População estimada" },
  densidade: { id: 29168, pesquisa: "33", nome: "Densidade demográfica" },
  escolarizacao: { id: 60045, pesquisa: "40", nome: "Taxa de escolarização 6-14 anos" },
  idh: { id: 329756, pesquisa: "10111", nome: "IDH Municipal" },
  mortalidade: { id: 30279, pesquisa: "39", nome: "Mortalidade infantil" },
  pib_per_capita: { id: 47001, pesquisa: "38", nome: "PIB per capita" },
  salario_medio: { id: 10143, pesquisa: "SIDRA 9510", nome: "Salário médio mensal em reais" },
  populacao_ocupada: { id: 29763, pesquisa: "33", nome: "Pessoal ocupado" },
  receitas: { id: 28141, pesquisa: "33", nome: "Receitas realizadas" },
  despesas: { id: 29749, pesquisa: "33", nome: "Total de despesas brutas empenhadas" },
  area: { id: 29167, pesquisa: "33", nome: "Área territorial" },
};

const INDICADORES_NAO_SUPORTADOS: Record<string, { nome: string; ids: string[] }> = {
  idhm_renda: { nome: "IDHM Renda", ids: ["30257"] },
  idhm_longevidade: { nome: "IDHM Longevidade", ids: ["30259"] },
  idhm_educacao: { nome: "IDHM Educação", ids: ["30261"] },
};

function componenteIdhmNaoSuportado(indicador: string) {
  const normalizado = indicador.toLowerCase();
  const porAlias = INDICADORES_NAO_SUPORTADOS[normalizado];
  if (porAlias) return porAlias;
  return Object.values(INDICADORES_NAO_SUPORTADOS).find((info) => info.ids.includes(indicador));
}

function erroComponenteIdhm(indicador: string): StructuredToolResult | null {
  const info = componenteIdhmNaoSuportado(indicador);
  if (!info) return null;
  return {
    markdown:
      "## Indicador não disponível na fonte atual\n\n" +
      `**Indicador:** ${info.nome}\n\n` +
      "A API pública Cidades@ atualmente expõe o IDHM municipal total pela pesquisa 10111 / indicador 329756, " +
      "com série 1991, 2000 e 2010, mas não expõe nessa pesquisa os componentes Renda, Longevidade e Educação. " +
      "Os antigos IDs da pesquisa 37 permanecem no catálogo histórico, porém não devolvem série municipal utilizável.\n\n" +
      "Para evitar resultado vazio com aparência de sucesso, o CensoSenso não anuncia esses componentes como suportados. " +
      "Use o alias `idh` para o IDHM total.",
    isError: true,
  };
}

type SerieMunicipal = {
  entries: Array<[string, string | number | null]>;
  url: string;
  chaveCache: string;
  fonte: "PESQUISAS" | "SIDRA";
  aviso?: string;
};

function urlIndicadorCidades(indicadorId: number, municipio: string, pesquisa?: string): string {
  // A pesquisa histórica 37 permanece apenas para os componentes legados de
  // IDHM, cujos resultados municipais não estão mais sendo publicados por esse
  // endpoint. O IDHM principal usa a pesquisa vigente 10111 / indicador 329756.
  if (pesquisa === "37") {
    const codigoLegado = municipio.slice(0, 6);
    return `${IBGE_API.PESQUISAS}/37/periodos/2010/indicadores/${indicadorId}/resultados/${codigoLegado}`;
  }
  return `${IBGE_API.PESQUISAS}/indicadores/${indicadorId}/resultados/${municipio}`;
}

function extrairSeriePesquisa(data: PesquisaResultado[] | null | undefined) {
  if (!data || data.length === 0 || !data[0].res || data[0].res.length === 0) return [];
  return Object.entries(data[0].res[0].res)
    .filter(([, valor]) => valor !== null && valor !== "-" && valor !== "...")
    .sort(([a], [b]) => b.localeCompare(a));
}

/**
 * Resolve a série municipal pelo endpoint genérico de indicadores do Cidades@.
 *
 * O caminho genérico é mais estável que a variante aninhada por pesquisa para
 * indicadores transversais como escolarização e para o IDHM vigente (pesquisa
 * 10111, indicador 329756). Para salário médio, o
 * Cidades@ deixou de ser uma origem programática confiável; usa-se a Tabela
 * SIDRA 9510, variável 10143 (salário médio mensal em reais), cuja cobertura
 * municipal publicada é restrita a municípios com 50 mil habitantes ou mais.
 */
async function buscarSerieMunicipal(
  indKey: string,
  municipio: string,
  apenasUltimo = false,
  retryRapido = false
): Promise<SerieMunicipal> {
  if (indKey === "salario_medio") {
    const caminho = `/t/9510/n6/${municipio}/v/10143/p/${apenasUltimo ? "last" : "all"}`;
    const { url, chaveCache, data } = await fetchSidra<Record<string, string>[]>(
      caminho,
      CACHE_TTL.MEDIUM,
      retryRapido ? RETRY_PRESETS.QUICK : undefined
    );
    const parsed = sidraRecords(data);
    const entries = parsed.registros
      .map((row) => [row["Ano"] ?? row["Período"] ?? "", row["Valor"] ?? ""] as [string, string])
      .filter(
        ([ano, valor]) => Boolean(ano) && Boolean(valor) && !["-", "..", "...", "X"].includes(valor)
      )
      .sort(([a], [b]) => b.localeCompare(a));
    return {
      entries,
      url,
      chaveCache,
      fonte: "SIDRA",
      ...(entries.length === 0
        ? {
            aviso:
              "Salário médio mensal: a Tabela SIDRA 9510 publica resultados municipais apenas para municípios com 50.000 habitantes ou mais.",
          }
        : {}),
    };
  }

  const info = INDICADORES_PANORAMA[indKey];
  const url = urlIndicadorCidades(info.id, municipio);
  const chaveCache = cacheKey(url);
  const data = await cachedFetch<PesquisaResultado[]>(
    url,
    chaveCache,
    CACHE_TTL.MEDIUM,
    retryRapido ? RETRY_PRESETS.QUICK : undefined
  );
  return { entries: extrairSeriePesquisa(data), url, chaveCache, fonte: "PESQUISAS" };
}

// Pesquisas principais disponíveis
const PESQUISAS_PRINCIPAIS = [
  { id: "33", nome: "Cadastro Central de Empresas" },
  { id: "10111", nome: "Índice de Desenvolvimento Humano municipal" },
  { id: "38", nome: "Produto Interno Bruto dos Municípios" },
  { id: "39", nome: "Pesquisa Nacional de Saúde" },
  { id: "40", nome: "Censo Escolar" },
  { id: "36", nome: "Pesquisa de Informações Básicas Municipais" },
  { id: "21", nome: "Censo Demográfico" },
];

/**
 * Consulta indicadores municipais via API de Pesquisas do IBGE
 */
export async function ibgeCidades(input: CidadesInput): Promise<StructuredToolResult> {
  return withMetrics("ibge_cidades", "cidades", async () => {
    try {
      if (input.uf) {
        return {
          markdown:
            'O parâmetro "uf" não seleciona resultados em ibge_cidades. ' +
            "Esta ferramenta trabalha com um único município identificado pelo código IBGE de 7 dígitos. " +
            "Use ibge_municipios para listar/filtrar municípios por UF.",
          isError: true,
        };
      }

      switch (input.tipo) {
        case "panorama":
          if (!input.municipio) {
            return {
              markdown: ValidationErrors.invalidCode(
                "",
                "ibge_cidades",
                "Informe o código IBGE do município (7 dígitos)"
              ),
              isError: true,
            };
          }
          return await panoramaMunicipio(input.municipio);
        case "indicador":
          if (!input.indicador) {
            return listarIndicadoresDisponiveis();
          }
          return await consultarIndicador(input.indicador, input.municipio);
        case "pesquisas":
          return await listarPesquisas(input.pesquisa);
        case "historico":
          if (!input.municipio || !input.indicador) {
            return {
              markdown: formatValidationError(
                "municipio/indicador",
                "",
                "Informe o código do município e o ID do indicador para ver histórico"
              ),
              isError: true,
            };
          }
          return await historicoIndicador(input.municipio, input.indicador);
        default:
          return listarIndicadoresDisponiveis();
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          markdown: parseHttpError(
            error,
            "ibge_cidades",
            {
              tipo: input.tipo,
              municipio: input.municipio,
              indicador: input.indicador,
            },
            ["ibge_comparar", "ibge_censo"]
          ),
          isError: true,
        };
      }
      return { markdown: ValidationErrors.emptyResult("ibge_cidades"), isError: true };
    }
  });
}

async function panoramaMunicipio(codigoMunicipio: string): Promise<StructuredToolResult> {
  // Validar código do município
  if (!isValidIbgeCode(codigoMunicipio) || codigoMunicipio.length !== 7) {
    return {
      markdown: formatValidationError(
        "municipio",
        codigoMunicipio,
        "Código IBGE de 7 dígitos (ex: 3550308 para São Paulo)"
      ),
      isError: true,
    };
  }

  // Buscar nome do município
  let nomeMunicipio = codigoMunicipio;
  try {
    const localidadeUrl = `${IBGE_API.LOCALIDADES}/municipios/${codigoMunicipio}`;
    const localidadeKey = cacheKey(localidadeUrl);
    const localidade = await cachedFetch<{
      nome: string;
      microrregiao?: { mesorregiao?: { UF?: { nome: string; sigla: string } } };
    }>(localidadeUrl, localidadeKey, CACHE_TTL.STATIC);
    if (localidade?.nome) {
      const uf = localidade.microrregiao?.mesorregiao?.UF?.sigla || "";
      nomeMunicipio = `${localidade.nome}${uf ? ` (${uf})` : ""}`;
    }
  } catch {
    // Usar código como fallback
  }

  let output = `## Panorama: ${nomeMunicipio}\n\n`;
  output += `**Código IBGE:** ${codigoMunicipio}\n\n`;

  // Buscar indicadores do panorama
  const indicadoresParaBuscar = [
    "populacao",
    "area",
    "densidade",
    "pib_per_capita",
    "idh",
    "escolarizacao",
    "mortalidade",
    "salario_medio",
  ];

  const resultados: Array<{ nome: string; valor: string; ano: string }> = [];

  // Os indicadores do panorama são buscados EM PARALELO e com retry curto.
  // Em série e com o retry padrão (4 tentativas, backoff a partir de 2s), um
  // indicador que a origem devolve com 500 consome ~30s sozinho: dois deles
  // estouram o tempo do cliente e derrubam o painel INTEIRO, mesmo com os
  // demais respondendo em ~0,2s. Medido em 28/08/2026, quando `escolarizacao`
  // (pesquisa 40, indicador 60045) e `salario_medio` (33/29765) estavam nesse
  // estado — o panorama não respondia para município nenhum. Painel com 6 de 8
  // indicadores é muito melhor que painel nenhum. Desde 0.6.x, escolarização
  // e IDHM usam o endpoint genérico de indicadores do Cidades@; salário médio
  // usa SIDRA 9510 para evitar depender de um mapeamento Cidades@ instável.
  type BuscaPanorama = {
    indKey: string;
    indInfo: (typeof INDICADORES_PANORAMA)[string];
    serie: SerieMunicipal | null;
    erro?: string;
  };

  const respostas: BuscaPanorama[] = await Promise.all(
    indicadoresParaBuscar
      .filter((indKey) => INDICADORES_PANORAMA[indKey])
      .map(async (indKey) => {
        const indInfo = INDICADORES_PANORAMA[indKey];
        try {
          const serie = await buscarSerieMunicipal(indKey, codigoMunicipio, true, true);
          return { indKey, indInfo, serie };
        } catch (error) {
          // Indicador indisponível sai do painel; não leva os outros junto,
          // mas a resposta registra explicitamente a perda parcial.
          return {
            indKey,
            indInfo,
            serie: null,
            erro: error instanceof Error ? error.message : "falha upstream",
          };
        }
      })
  );

  const avisos = respostas.flatMap((r) => {
    if (r.serie === null) return [`${r.indInfo.nome}: indisponível na origem nesta execução`];
    if (r.serie.aviso) return [r.serie.aviso];
    if (r.serie.entries.length === 0) {
      return [`${r.indInfo.nome}: sem valor publicado pela origem para este município`];
    }
    return [];
  });

  for (const { indKey, indInfo, serie } of respostas) {
    try {
      if (serie && serie.entries.length > 0) {
        for (const [ano, valor] of serie.entries) {
          if (valor !== null && valor !== "-" && valor !== "...") {
            let valorFormatado = String(valor);

            // Formatar números
            if (!isNaN(Number(valor))) {
              const num = Number(valor);
              if (indKey === "populacao" || indKey === "populacao_ocupada") {
                valorFormatado = formatNumber(num) + " pessoas";
              } else if (indKey === "area") {
                valorFormatado = formatNumber(num, { maximumFractionDigits: 2 }) + " km²";
              } else if (indKey === "densidade") {
                valorFormatado = formatNumber(num, { maximumFractionDigits: 2 }) + " hab/km²";
              } else if (indKey === "pib_per_capita" || indKey === "salario_medio") {
                valorFormatado = "R$ " + formatNumber(num, { maximumFractionDigits: 2 });
              } else if (indKey === "idh" || indKey.startsWith("idhm")) {
                valorFormatado = formatNumber(num, { maximumFractionDigits: 3 });
              } else if (indKey === "escolarizacao") {
                valorFormatado = formatNumber(num, { maximumFractionDigits: 1 }) + "%";
              } else if (indKey === "mortalidade") {
                // A unidade do IBGE é óbitos por mil nascidos vivos, não
                // porcentagem: "14,5%" lia como 14,5% das crianças, ~15x o
                // valor real.
                valorFormatado =
                  formatNumber(num, { maximumFractionDigits: 1 }) +
                  " óbitos por mil nascidos vivos";
              } else {
                valorFormatado = formatNumber(num);
              }
            }

            resultados.push({
              nome: indInfo.nome,
              valor: valorFormatado,
              ano,
            });
            break;
          }
        }
      }
    } catch {
      // Ignorar erros individuais
    }
  }

  // Provenance: keyed to the first/principal indicator fetch of the panorama
  // (populacao) — the response merges several fetches of the same API.
  const principal = INDICADORES_PANORAMA["populacao"];
  const principalUrl = urlIndicadorCidades(principal.id, codigoMunicipio);
  const provenance = provenienciaIbge({
    fonte: "PESQUISAS",
    url: principalUrl,
    chaveCache: cacheKey(principalUrl),
    pesquisa: "Cidades@ — panorama municipal",
  });

  if (resultados.length === 0) {
    return {
      markdown: ValidationErrors.emptyResult(
        "ibge_cidades",
        `Nenhum indicador encontrado para o município ${codigoMunicipio}`
      ),
      structured: {
        tipo: "panorama",
        municipio: codigoMunicipio,
        nome: nomeMunicipio,
        indicadores: [],
      },
      provenance,
    };
  }

  output += "### Indicadores\n\n";
  output += createMarkdownTable(
    ["Indicador", "Valor", "Ano"],
    resultados.map((r) => [r.nome, r.valor, r.ano]),
    { alignment: ["left", "right", "center"] }
  );

  if (avisos.length > 0) {
    output += "\n### Avisos\n\n";
    for (const aviso of avisos) output += `- ${aviso}\n`;
  }

  output += "\n### Ferramentas Relacionadas\n\n";
  output += `- \`ibge_cidades tipo="historico" municipio="${codigoMunicipio}" indicador="29171"\` - Histórico de população\n`;
  output += `- \`ibge_cidades tipo="pesquisas"\` - Ver pesquisas disponíveis\n`;
  output += `- \`ibge_cidades tipo="indicador"\` - Ver indicadores disponíveis\n`;

  return {
    markdown: output,
    structured: {
      tipo: "panorama",
      municipio: codigoMunicipio,
      nome: nomeMunicipio,
      indicadores: resultados,
      ...(avisos.length > 0 ? { avisos } : {}),
    },
    provenance,
  };
}

type IndicadorPanorama = (typeof INDICADORES_PANORAMA)[string];

function resolverIndicadorPanorama(indicador: string): IndicadorPanorama | undefined {
  const porAlias = INDICADORES_PANORAMA[indicador.toLowerCase()];
  if (porAlias) return porAlias;
  // Compatibilidade com IDs anteriormente expostos pelo wrapper.
  if (indicador === "29765") return INDICADORES_PANORAMA.salario_medio;
  if (indicador === "30255") return INDICADORES_PANORAMA.idh;
  return Object.values(INDICADORES_PANORAMA).find((info) => String(info.id) === indicador);
}

async function consultarIndicador(
  indicador: string,
  municipio?: string
): Promise<StructuredToolResult> {
  const naoSuportado = erroComponenteIdhm(indicador);
  if (naoSuportado) return naoSuportado;

  const indicadorInfo = resolverIndicadorPanorama(indicador);

  if (indicadorInfo) {
    if (!municipio) {
      return {
        markdown: formatValidationError(
          "municipio",
          "",
          "Informe o código do município para consultar o indicador"
        ),
        isError: true,
      };
    }

    if (!isValidIbgeCode(municipio) || municipio.length !== 7) {
      return {
        markdown: formatValidationError(
          "municipio",
          municipio,
          "Código IBGE de 7 dígitos (ex: 3550308 para São Paulo)"
        ),
        isError: true,
      };
    }

    const indKey =
      Object.entries(INDICADORES_PANORAMA).find(([, info]) => info === indicadorInfo)?.[0] ??
      indicador.toLowerCase();
    const serie = await buscarSerieMunicipal(indKey, municipio, false, false);
    const provenance = provenienciaIbge({
      fonte: serie.fonte,
      url: serie.url,
      chaveCache: serie.chaveCache,
      pesquisa:
        serie.fonte === "SIDRA"
          ? "SIDRA, Tabela 9510 — salário médio mensal em reais"
          : `Cidades@ — indicador ${indicadorInfo.nome}`,
      dataset: serie.fonte === "SIDRA" ? "9510" : String(indicadorInfo.id),
      ...(serie.fonte === "SIDRA" ? { dataVintage: serie.entries[0]?.[0] ?? null } : {}),
    });

    const entries = serie.entries.slice(0, 20);
    if (entries.length === 0) {
      const detalhe =
        serie.aviso ??
        `Nenhum valor publicado para o indicador ${indicadorInfo.nome} neste município.`;
      return {
        markdown: ValidationErrors.emptyResult("ibge_cidades", detalhe),
        structured: {
          tipo: "indicador",
          municipio,
          nome: indicadorInfo.nome,
          indicadores: [],
          ...(serie.aviso ? { avisos: [serie.aviso] } : {}),
        },
        provenance,
      };
    }

    let output = `## ${indicadorInfo.nome}\n\n`;
    output += `**Município:** ${municipio}\n\n`;
    output += createMarkdownTable(
      ["Ano", "Valor"],
      entries.map(([ano, valor]) => [ano, String(valor)]),
      { alignment: ["center", "right"] }
    );
    if (serie.aviso) output += `\n### Avisos\n\n- ${serie.aviso}\n`;

    const indicadores = entries.map(([ano, valor]) => ({
      nome: indicadorInfo.nome,
      valor: String(valor),
      ano,
    }));

    return {
      markdown: output,
      structured: {
        tipo: "indicador",
        municipio,
        nome: indicadorInfo.nome,
        indicadores,
        ...(serie.aviso ? { avisos: [serie.aviso] } : {}),
      },
      provenance,
    };
  }

  return {
    markdown:
      `Indicador "${indicador}" não está no catálogo suportado por ibge_cidades.\n\n` +
      'Use tipo="indicador" sem o parâmetro indicador para listar aliases e IDs válidos.',
    isError: true,
  };
}

async function listarPesquisas(pesquisaId?: string): Promise<StructuredToolResult> {
  if (pesquisaId) {
    // Buscar detalhes de uma pesquisa específica
    try {
      const url = `${IBGE_API.PESQUISAS}/${pesquisaId}`;
      const key = cacheKey(url);
      const pesquisa = await cachedFetch<PesquisaDetalhe>(url, key, CACHE_TTL.STATIC);

      let output = `## Pesquisa: ${pesquisa.nome}\n\n`;
      output += `**ID:** ${pesquisa.id}\n`;
      if (pesquisa.periodicidade) {
        output += `**Periodicidade:** ${pesquisa.periodicidade}\n`;
      }

      // Buscar indicadores da pesquisa
      const indicadoresUrl = `${IBGE_API.PESQUISAS}/${pesquisaId}/indicadores`;
      const indicadoresKey = cacheKey(indicadoresUrl);
      const indicadores = await cachedFetch<PesquisaIndicador[]>(
        indicadoresUrl,
        indicadoresKey,
        CACHE_TTL.STATIC
      );

      if (indicadores && indicadores.length > 0) {
        output += `\n### Indicadores (${indicadores.length})\n\n`;

        const rows = indicadores
          .slice(0, 30)
          .map((ind) => [String(ind.id), ind.indicador, ind.unidade?.id || "-"]);

        output += createMarkdownTable(["ID", "Indicador", "Unidade"], rows, {
          alignment: ["center", "left", "center"],
        });

        if (indicadores.length > 30) {
          output += `\n_Mostrando 30 de ${indicadores.length} indicadores._\n`;
        }
      }

      return {
        markdown: output,
        structured: listingPayload("pesquisas"),
        provenance: provenienciaIbge({
          fonte: "PESQUISAS",
          url,
          chaveCache: key,
          pesquisa: `Cidades@ — pesquisa ${pesquisaId} (indicadores disponíveis)`,
          dataset: pesquisaId,
        }),
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          markdown: parseHttpError(error, "ibge_cidades", { pesquisa: pesquisaId }, [
            "ibge_comparar",
            "ibge_censo",
          ]),
          isError: true,
        };
      }
      return { markdown: ValidationErrors.emptyResult("ibge_cidades"), isError: true };
    }
  }

  // Listar pesquisas principais
  let output = "## Pesquisas Disponíveis\n\n";
  output += "As seguintes pesquisas fornecem indicadores municipais:\n\n";

  const rows = PESQUISAS_PRINCIPAIS.map((p) => [p.id, p.nome]);
  output += createMarkdownTable(["ID", "Pesquisa"], rows, {
    alignment: ["center", "left"],
  });

  output += "\n### Exemplo de Uso\n\n";
  output += "```\n";
  output += 'ibge_cidades tipo="pesquisas" pesquisa="33"\n';
  output += "```\n";

  // Static catalog maintained in code — no upstream fetch, no cache key.
  return {
    markdown: output,
    structured: listingPayload("pesquisas"),
    provenance: provenienciaIbge({
      fonte: "PESQUISAS",
      url: IBGE_API.PESQUISAS,
      pesquisa: "Cidades@ — catálogo de pesquisas principais",
    }),
  };
}

async function historicoIndicador(
  municipio: string,
  indicador: string
): Promise<StructuredToolResult> {
  const naoSuportado = erroComponenteIdhm(indicador);
  if (naoSuportado) return naoSuportado;

  const indicadorInfo = resolverIndicadorPanorama(indicador);
  if (!indicadorInfo) {
    return {
      markdown:
        `Indicador "${indicador}" não está no catálogo suportado por ibge_cidades.\n\n` +
        'Use tipo="indicador" sem o parâmetro indicador para listar aliases e IDs válidos.',
      isError: true,
    };
  }

  if (!isValidIbgeCode(municipio) || municipio.length !== 7) {
    return {
      markdown: formatValidationError(
        "municipio",
        municipio,
        "Código IBGE de 7 dígitos (ex: 3550308 para São Paulo)"
      ),
      isError: true,
    };
  }

  const indicadorId = indicadorInfo.id;
  const indicadorNome = indicadorInfo.nome;
  const indKey =
    Object.entries(INDICADORES_PANORAMA).find(([, info]) => info === indicadorInfo)?.[0] ??
    indicador.toLowerCase();
  const serie = await buscarSerieMunicipal(indKey, municipio, false, false);

  const provenance = provenienciaIbge({
    fonte: serie.fonte,
    url: serie.url,
    chaveCache: serie.chaveCache,
    pesquisa:
      serie.fonte === "SIDRA"
        ? "SIDRA, Tabela 9510 — histórico do salário médio mensal em reais"
        : `Cidades@ — histórico do indicador ${indicadorNome}`,
    dataset: serie.fonte === "SIDRA" ? "9510" : String(indicadorId),
    ...(serie.fonte === "SIDRA" ? { dataVintage: serie.entries[0]?.[0] ?? null } : {}),
  });

  let output = `## Histórico: ${indicadorNome}\n\n`;
  output += `**Município:** ${municipio}\n\n`;

  const entries = serie.entries;

  if (entries.length === 0) {
    return {
      markdown: ValidationErrors.emptyResult("ibge_cidades"),
      structured: {
        tipo: "historico",
        municipio,
        nome: indicadorNome,
        indicadores: [],
        ...(serie.aviso ? { avisos: [serie.aviso] } : {}),
      },
      provenance,
    };
  }

  output += createMarkdownTable(
    ["Ano", "Valor"],
    entries.map(([ano, valor]) => [ano, String(valor)]),
    { alignment: ["center", "right"] }
  );

  return {
    markdown: output,
    structured: {
      tipo: "historico",
      municipio,
      nome: indicadorNome,
      indicadores: entries.map(([ano, valor]) => ({
        nome: indicadorNome,
        valor: String(valor),
        ano,
      })),
    },
    provenance,
  };
}

function listarIndicadoresDisponiveis(): StructuredToolResult {
  let output = "## Indicadores Disponíveis\n\n";
  output += "Os seguintes indicadores podem ser consultados por município:\n\n";

  const rows = Object.entries(INDICADORES_PANORAMA).map(([alias, info]) => [
    String(info.id),
    info.nome,
    alias,
  ]);

  output += createMarkdownTable(["ID", "Indicador", "Alias"], rows, {
    alignment: ["center", "left", "left"],
  });

  output += "\n### Exemplo de Uso\n\n";
  output += "```\n";
  output += 'ibge_cidades tipo="panorama" municipio="3550308"\n';
  output += 'ibge_cidades tipo="indicador" indicador="populacao" municipio="3550308"\n';
  output += 'ibge_cidades tipo="historico" municipio="3550308" indicador="29171"\n';
  output += "```\n";

  // Static catalog maintained in code — no upstream fetch, no cache key.
  return {
    markdown: output,
    structured: listingPayload("indicador"),
    provenance: provenienciaIbge({
      fonte: "PESQUISAS",
      url: IBGE_API.PESQUISAS,
      pesquisa: "Cidades@ — catálogo de indicadores municipais suportados",
    }),
  };
}
