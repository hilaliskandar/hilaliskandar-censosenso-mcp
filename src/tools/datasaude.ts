import { z } from "zod";
import { IBGE_API } from "../types.js";
import { CACHE_TTL } from "../cache.js";
import { fetchSidra } from "../sidra-agregados.js";
import { withMetrics } from "../metrics.js";
import { createMarkdownTable } from "../utils/index.js";
import { parseHttpError, ValidationErrors } from "../errors.js";
import { territorialLevelHint, territorialLevelList } from "../config.js";
import {
  type StructuredToolResult,
  sidraRecords,
  selectSidraColumns,
  formatarCelulaSidra,
} from "../structured.js";
import {
  extrairPeriodoSidra,
  NOTA_DERIVACAO_ESTATISTICAS,
  provenienciaIbge,
  type Provenance,
} from "../provenance.js";
import {
  agruparPorParam,
  estatisticasBlocoSchema,
  estatisticasParam,
  estatisticasSidra,
  topNParam,
  TOP_N_DEFAULT,
} from "../stats.js";

// Territorial availability varies by SIDRA table/indicator.
// This union is used only for the input hint; validation is indicator-specific.
const DATASAUDE_NIVEIS = ["1", "2", "3", "6"];

// Health indicators available via IBGE SIDRA
export const INDICADORES_SAUDE: Record<
  string,
  {
    tabela: string;
    variaveis: string;
    niveis: string[];
    classificacoes?: string;
    restricaoMunicipal?: "capitais";
    nome: string;
    descricao: string;
    fonte: string;
  }
> = {
  mortalidade_infantil: {
    tabela: "7362",
    variaveis: "1940",
    niveis: ["1", "2", "3"],
    nome: "Mortalidade Infantil",
    descricao: "Taxa de mortalidade infantil (por mil nascidos vivos)",
    fonte: "IBGE - Projeções da População",
  },
  esperanca_vida: {
    tabela: "7362",
    variaveis: "2503",
    niveis: ["1", "2", "3"],
    nome: "Esperança de Vida",
    descricao: "Esperança de vida ao nascer",
    fonte: "IBGE - Projeções da População",
  },
  nascidos_vivos: {
    tabela: "2612",
    variaveis: "218",
    niveis: ["1", "2", "3", "6"],
    nome: "Nascidos Vivos",
    descricao: "Nascidos vivos por local de residência da mãe",
    fonte: "IBGE - Estatísticas do Registro Civil",
  },
  obitos: {
    tabela: "2681",
    variaveis: "343",
    niveis: ["1", "2", "3", "6"],
    nome: "Óbitos",
    descricao: "Óbitos por local de residência",
    fonte: "IBGE - Estatísticas do Registro Civil",
  },
  fecundidade: {
    tabela: "3727",
    variaveis: "2493",
    niveis: ["1", "2", "3"],
    nome: "Taxa de Fecundidade",
    descricao: "Taxa de fecundidade total",
    fonte: "IBGE - Indicadores de Desenvolvimento Sustentável",
  },
  saneamento_agua: {
    tabela: "6803",
    variaveis: "381",
    niveis: ["1", "2", "3", "6"],
    classificacoes: "1821[all]",
    nome: "Abastecimento de Água",
    descricao:
      "Domicílios particulares permanentes ocupados por existência de ligação à rede geral e principal forma de abastecimento de água",
    fonte: "IBGE - Censo Demográfico 2022",
  },
  saneamento_esgoto: {
    tabela: "6805",
    variaveis: "381",
    niveis: ["1", "2", "3", "6"],
    classificacoes: "11558[all]",
    nome: "Esgotamento Sanitário",
    descricao: "Domicílios por tipo de esgotamento sanitário",
    fonte: "IBGE - Censo Demográfico 2022",
  },
  plano_saude: {
    tabela: "4938",
    variaveis: "5264",
    niveis: ["1", "2", "3", "6"],
    restricaoMunicipal: "capitais",
    nome: "Cobertura de Plano de Saúde",
    descricao: "Percentual de pessoas que tinham algum plano de saúde (médico ou odontológico)",
    fonte: "IBGE - PNS",
  },
  autoavaliacao_saude: {
    tabela: "4751",
    variaveis: "4735",
    niveis: ["1", "2", "3", "6"],
    restricaoMunicipal: "capitais",
    nome: "Autoavaliação de Saúde",
    descricao: "Pessoas de 18 anos ou mais com autoavaliação de saúde boa ou muito boa",
    fonte: "IBGE - PNS",
  },
};

const CAPITAIS_PNS_2019 = new Set([
  "1100205",
  "1200401",
  "1302603",
  "1400100",
  "1501402",
  "1600303",
  "1721000",
  "2111300",
  "2211001",
  "2304400",
  "2408102",
  "2507507",
  "2611606",
  "2704302",
  "2800308",
  "2927408",
  "3106200",
  "3205309",
  "3304557",
  "3550308",
  "4106902",
  "4205407",
  "4314902",
  "5002704",
  "5103403",
  "5208707",
  "5300108",
]);

// Schema for the tool input
export const datasaudeSchema = z.object({
  indicador: z.string().describe(`Indicador de saúde. Disponíveis:
- mortalidade_infantil: Taxa de mortalidade infantil
- esperanca_vida: Esperança de vida ao nascer
- nascidos_vivos: Nascidos vivos
- obitos: Óbitos por local de residência
- fecundidade: Taxa de fecundidade
- saneamento_agua: Abastecimento de água
- saneamento_esgoto: Esgotamento sanitário
- plano_saude: Cobertura de plano de saúde
- autoavaliacao_saude: Autoavaliação de saúde boa ou muito boa
- listar: Lista indicadores disponíveis e os níveis territoriais válidos por indicador

A disponibilidade territorial varia por indicador. Antes de usar nivel_territorial=6, consulte indicador="listar".`),
  nivel_territorial: z
    .string()
    .optional()
    .default("1")
    .describe(
      territorialLevelHint(DATASAUDE_NIVEIS) +
        ". A disponibilidade é específica por indicador; use indicador='listar' para consultar os níveis válidos."
    ),
  localidade: z.string().optional().default("all").describe("Código da localidade ou 'all'"),
  periodo: z
    .string()
    .optional()
    .default("last")
    .describe("Período: 'last', 'all', ou ano específico"),
  formato: z.enum(["tabela", "json"]).optional().default("tabela").describe("Formato de saída"),
  campos: z
    .string()
    .optional()
    .describe(
      "Selecionar apenas algumas colunas por rótulo, separadas por vírgula (ex: 'Valor,Ano'). Reduz o volume da resposta."
    ),
  estatisticas: estatisticasParam,
  agruparPor: agruparPorParam,
  topN: topNParam,
});

export type DatasaudeInput = z.infer<typeof datasaudeSchema>;

/** Structured output payload (validated against this schema by the MCP SDK). */
export const datasaudeOutputSchema = z.object({
  indicador: z.string().optional().describe("Chave do indicador de saúde consultado"),
  nome: z.string().optional().describe("Nome do indicador"),
  fonte: z.string().optional().describe("Fonte do dado"),
  totalRegistros: z.number().describe("Total de registros de dados"),
  colunas: z.array(z.string()).describe("Rótulos das colunas, na ordem"),
  registros: z
    .array(z.record(z.string(), z.string()))
    .describe("Registros: cada um mapeia rótulo da coluna -> valor"),
  estatisticas: estatisticasBlocoSchema.optional(),
});

/** Minimal valid payload for non-data success responses (e.g. the indicator catalog). */
function emptyMeta(): Record<string, unknown> {
  return { totalRegistros: 0, colunas: [], registros: [] };
}

/**
 * Fetches Brazilian health indicators from IBGE's SIDRA (some are originally
 * produced by DataSUS, e.g. mortality/births, but are read here via SIDRA).
 */
export async function ibgeDatasaude(input: DatasaudeInput): Promise<StructuredToolResult> {
  return withMetrics("ibge_datasaude", "sidra", async () => {
    // List indicators (catalog in the text channel)
    if (input.indicador === "listar") {
      return {
        markdown: listHealthIndicators(),
        structured: emptyMeta(),
        // Static catalog maintained in code — no upstream fetch (no cache key/dataset).
        provenance: provenienciaIbge({
          fonte: "SIDRA",
          url: IBGE_API.AGREGADOS,
          pesquisa: "catálogo de indicadores de saúde mantido pelo servidor",
        }),
      };
    }

    const indicadorInfo = INDICADORES_SAUDE[input.indicador.toLowerCase()];

    if (!indicadorInfo) {
      return {
        markdown:
          `Indicador "${input.indicador}" não encontrado.\n\n` +
          `Use indicador="listar" para ver indicadores disponíveis.`,
        isError: true,
      };
    }

    const nivel = input.nivel_territorial ?? "1";
    if (!indicadorInfo.niveis.includes(nivel)) {
      return {
        markdown:
          ValidationErrors.invalidTerritory(
            nivel,
            "ibge_datasaude",
            territorialLevelList(indicadorInfo.niveis)
          ) +
          "\n\nO indicador **" +
          indicadorInfo.nome +
          "** está disponível nesta ferramenta apenas nos níveis: " +
          territorialLevelList(indicadorInfo.niveis) +
          ".",
        isError: true,
      };
    }

    if (
      nivel === "6" &&
      indicadorInfo.restricaoMunicipal === "capitais" &&
      (input.localidade ?? "all") !== "all"
    ) {
      const localidades = (input.localidade ?? "")
        .split(",")
        .map((codigo) => codigo.trim())
        .filter(Boolean);
      const invalidas = localidades.filter((codigo) => !CAPITAIS_PNS_2019.has(codigo));
      if (invalidas.length > 0) {
        return {
          markdown:
            `O indicador **${indicadorInfo.nome}** possui nível N6 na PNS 2019, ` +
            "mas a publicação municipal cobre apenas as 26 capitais estaduais e Brasília. " +
            `Código(s) fora desse recorte: ${invalidas.join(", ")}. ` +
            'Use nivel_territorial="3" para UF, ou nivel_territorial="6", localidade="all" para listar as capitais.',
          isError: true,
        };
      }
    }

    const meta = {
      indicador: input.indicador.toLowerCase(),
      nome: indicadorInfo.nome,
      fonte: indicadorInfo.fonte,
    };

    try {
      // Build SIDRA query
      const caminho = buildSidraPath(
        indicadorInfo.tabela,
        indicadorInfo.variaveis,
        nivel,
        input.localidade ?? "all",
        input.periodo ?? "last",
        indicadorInfo.classificacoes
      );

      // Pela API de Agregados v3 (ver src/sidra-agregados.ts), cache curto.
      // Até 5.0.0 a falha era refeita sem cache, na mesma URL: repetia o mesmo
      // erro e jogava fora a frase da fonte. Agora o erro sobe inteiro para
      // parseHttpError, que é quem sabe dizer qual parâmetro ela recusou.
      const {
        url,
        chaveCache: key,
        data,
      } = await fetchSidra<SidraData[]>(caminho, CACHE_TTL.SHORT);

      const pesquisa = `SIDRA, Tabela ${indicadorInfo.tabela} (${indicadorInfo.nome})`;
      const proveniencia = (opts?: {
        dataVintage?: string | null;
        derivado?: { nota: string };
      }): Provenance =>
        provenienciaIbge({
          fonte: "SIDRA",
          url,
          chaveCache: key,
          pesquisa,
          dataset: indicadorInfo.tabela,
          ...opts,
        });

      if (!data || data.length === 0) {
        return {
          markdown: `Nenhum dado encontrado para ${indicadorInfo.nome}.`,
          structured: { ...meta, ...sidraRecords(data) },
          provenance: proveniencia(),
        };
      }

      // Reference period from the FULL result, before field selection/truncation.
      const completo = sidraRecords(data);
      const dataVintage = extrairPeriodoSidra(completo.colunas, completo.registros);

      // Statistics mode (D2): full distribution over ALL data rows, before any
      // truncation or field selection — `campos`/`formato` are ignored.
      if (input.estatisticas) {
        let cabecalho = `## ${indicadorInfo.nome}\n\n`;
        cabecalho += `**Descrição:** ${indicadorInfo.descricao}\n`;
        cabecalho += `**Fonte:** ${indicadorInfo.fonte}\n\n`;

        const dados = sidraRecords(data);
        const resultado = estatisticasSidra(dados, {
          agruparPor: input.agruparPor,
          topN: input.topN ?? TOP_N_DEFAULT,
        });
        if (!resultado.ok) {
          return { markdown: cabecalho + resultado.erro, isError: true };
        }
        return {
          markdown: cabecalho + resultado.markdown,
          structured: {
            ...meta,
            totalRegistros: dados.totalRegistros,
            colunas: dados.colunas,
            registros: [],
            estatisticas: resultado.bloco,
          },
          provenance: proveniencia({
            dataVintage,
            derivado: { nota: NOTA_DERIVACAO_ESTATISTICAS },
          }),
        };
      }

      // Apply optional field selection (1.2) to both channels.
      const filtered = selectSidraColumns(data, input.campos);
      return {
        markdown: formatResponse(filtered, indicadorInfo, input),
        structured: { ...meta, ...sidraRecords(filtered) },
        provenance: proveniencia({ dataVintage }),
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          markdown: parseHttpError(error, "ibge_datasaude", { indicador: input.indicador }, [
            "ibge_sidra",
            "ibge_sidra_metadados",
          ]),
          isError: true,
        };
      }
      return { markdown: ValidationErrors.emptyResult("ibge_datasaude"), isError: true };
    }
  });
}

interface SidraData {
  [key: string]: string;
}

function buildSidraPath(
  tabela: string,
  variaveis: string,
  nivel: string,
  localidade: string,
  periodo: string,
  classificacoes?: string
): string {
  let path = `/t/${tabela}`;
  path += `/n${nivel}/${localidade}`;
  path += `/v/${variaveis}`;
  path += `/p/${periodo}`;

  if (classificacoes) {
    for (const termo of classificacoes.split("|")) {
      const match = /^(\d+)\[(.+)\]$/.exec(termo.trim());
      if (!match) throw new Error(`Classificação SIDRA inválida no catálogo: ${termo}`);
      path += `/c${match[1]}/${match[2]}`;
    }
  }

  return path;
}

function listHealthIndicators(): string {
  let output = "## Indicadores de Saúde Disponíveis\n\n";

  output += "### Mortalidade e Natalidade\n\n";
  output += createMarkdownTable(
    ["Indicador", "Nome", "Descrição"],
    [
      [
        "`mortalidade_infantil`",
        INDICADORES_SAUDE.mortalidade_infantil.nome,
        INDICADORES_SAUDE.mortalidade_infantil.descricao,
      ],
      [
        "`nascidos_vivos`",
        INDICADORES_SAUDE.nascidos_vivos.nome,
        INDICADORES_SAUDE.nascidos_vivos.descricao,
      ],
      ["`obitos`", INDICADORES_SAUDE.obitos.nome, INDICADORES_SAUDE.obitos.descricao],
    ],
    { alignment: ["left", "left", "left"] }
  );

  output += "\n### Indicadores Demográficos\n\n";
  output += createMarkdownTable(
    ["Indicador", "Nome", "Descrição"],
    [
      [
        "`esperanca_vida`",
        INDICADORES_SAUDE.esperanca_vida.nome,
        INDICADORES_SAUDE.esperanca_vida.descricao,
      ],
      [
        "`fecundidade`",
        INDICADORES_SAUDE.fecundidade.nome,
        INDICADORES_SAUDE.fecundidade.descricao,
      ],
    ],
    { alignment: ["left", "left", "left"] }
  );

  output += "\n### Saneamento\n\n";
  output += createMarkdownTable(
    ["Indicador", "Nome", "Descrição"],
    [
      [
        "`saneamento_agua`",
        INDICADORES_SAUDE.saneamento_agua.nome,
        INDICADORES_SAUDE.saneamento_agua.descricao,
      ],
      [
        "`saneamento_esgoto`",
        INDICADORES_SAUDE.saneamento_esgoto.nome,
        INDICADORES_SAUDE.saneamento_esgoto.descricao,
      ],
    ],
    { alignment: ["left", "left", "left"] }
  );

  output += "\n### Cobertura de Saúde\n\n";
  output += createMarkdownTable(
    ["Indicador", "Nome", "Descrição"],
    [
      [
        "`plano_saude`",
        INDICADORES_SAUDE.plano_saude.nome,
        INDICADORES_SAUDE.plano_saude.descricao,
      ],
      [
        "`autoavaliacao_saude`",
        INDICADORES_SAUDE.autoavaliacao_saude.nome,
        INDICADORES_SAUDE.autoavaliacao_saude.descricao,
      ],
    ],
    { alignment: ["left", "left", "left"] }
  );

  output += "\n### Disponibilidade Territorial\n\n";
  output += createMarkdownTable(
    ["Indicador", "Níveis"],
    Object.entries(INDICADORES_SAUDE).map(([chave, info]) => [
      `\`${chave}\``,
      info.niveis
        .map((nivel) =>
          nivel === "6" && info.restricaoMunicipal === "capitais" ? "6 (capitais)" : nivel
        )
        .join(", "),
    ]),
    { alignment: ["left", "left"] }
  );
  output += "\nCódigos: 1=Brasil; 2=Grande Região; 3=UF; 6=Município.\n";

  output += "\n### Exemplos de Uso\n\n";
  output += "```\n";
  output += "# Mortalidade infantil no Brasil\n";
  output += 'ibge_datasaude(indicador="mortalidade_infantil")\n\n';
  output += "# Esperança de vida por UF\n";
  output += 'ibge_datasaude(indicador="esperanca_vida", nivel_territorial="3")\n\n';
  output += "# Óbitos em São Paulo (código 35)\n";
  output += 'ibge_datasaude(indicador="obitos", nivel_territorial="3", localidade="35")\n\n';
  output += "# Série histórica de nascidos vivos\n";
  output += 'ibge_datasaude(indicador="nascidos_vivos", periodo="all")\n';
  output += "```\n";

  return output;
}

function formatResponse(
  data: SidraData[],
  indicadorInfo: (typeof INDICADORES_SAUDE)[string],
  input: DatasaudeInput
): string {
  let output = `## ${indicadorInfo.nome}\n\n`;
  output += `**Descrição:** ${indicadorInfo.descricao}\n`;
  output += `**Fonte:** ${indicadorInfo.fonte}\n\n`;

  if (data.length === 0) {
    return output + "Nenhum dado encontrado.\n";
  }

  // Get headers from first row
  const headerRow = data[0];
  const dataRows = data.slice(1);

  if (input.formato === "json") {
    output += "### Dados\n\n```json\n";
    output += JSON.stringify(dataRows, null, 2);
    output += "\n```\n";
    return output;
  }

  // Table format
  output += "### Dados\n\n";

  const columns = Object.keys(headerRow);
  const headers = columns.map((col) => headerRow[col] || col);

  // Build table rows (limit to 30)
  const displayRows = dataRows.slice(0, 30);

  const rows = displayRows.map((row) =>
    columns.map((col) => formatarCelulaSidra(headerRow[col] || col, row[col]))
  );

  output += createMarkdownTable(headers, rows);

  if (dataRows.length > 30) {
    output += `\n_Mostrando 30 de ${dataRows.length} registros._\n`;
  }

  return output;
}
