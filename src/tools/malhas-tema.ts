/**
 * Recortes temáticos do território brasileiro.
 *
 * Atributos e listagens dos sete temas públicos são servidos exclusivamente por
 * snapshots oficiais versionados, gerados a partir de fontes IBGE/GeoFTP.
 *
 * Esta ferramenta não publica nem promete geometria temática. Malhas
 * administrativas com geometria continuam sendo responsabilidade de
 * `ibge_malhas`.
 */
import { z } from "zod";
import { withMetrics } from "../metrics.js";
import { formatError } from "../errors.js";
import type { StructuredToolResult } from "../structured.js";
import { provenienciaIbge } from "../provenance.js";
import { RECORTES_GERADOS } from "../data/recortes-gerados.js";
import {
  consultarSnapshot,
  type SnapshotRecorte,
  type RegistroRecorte,
} from "../data/recortes-snapshot.js";

/**
 * Metadados públicos de um recorte temático e, quando existir, o campo usado
 * para filtrar um registro por código no snapshot versionado.
 */
export interface Recorte {
  nome: string;
  descricao: string;
  /** Campo aceito em `codigo`; ausente = o recorte não tem código próprio. */
  codigo?: { campo: string; numerico: boolean; exemplo: string; oque: string };
}

/** Ordem em que os recortes aparecem no catálogo e no esquema publicado. */
export const TEMAS = [
  "biomas",
  "amazonia_legal",
  "semiarido",
  "costeiro",
  "fronteira",
  "metropolitana",
  "ride",
] as const;

export type Tema = (typeof TEMAS)[number];

export const RECORTES: Record<Tema, Recorte> = {
  biomas: {
    nome: "Biomas",
    descricao: "Os seis biomas continentais brasileiros",
    codigo: { campo: "cd_bioma", numerico: true, exemplo: "1", oque: "código do bioma" },
  },
  amazonia_legal: {
    nome: "Amazônia Legal",
    descricao: "Limite da Amazônia Legal brasileira",
    codigo: {
      campo: "cd_mun",
      numerico: false,
      exemplo: "1302603",
      oque: "código IBGE de 7 dígitos do município",
    },
  },
  semiarido: {
    nome: "Semiárido",
    descricao: "Área do semiárido brasileiro",
    codigo: {
      campo: "cd_mun",
      numerico: false,
      exemplo: "2304400",
      oque: "código IBGE de 7 dígitos do município",
    },
  },
  costeiro: {
    nome: "Zona Costeira",
    descricao: "Municípios da zona costeira",
    codigo: {
      campo: "cd_mun",
      numerico: false,
      exemplo: "3550308",
      oque: "código IBGE de 7 dígitos do município",
    },
  },
  fronteira: {
    nome: "Faixa de Fronteira",
    descricao: "Municípios na faixa de fronteira",
    codigo: {
      campo: "cd_mun",
      numerico: false,
      exemplo: "4108304",
      oque: "código IBGE de 7 dígitos do município",
    },
  },
  metropolitana: {
    nome: "Regiões Metropolitanas",
    descricao: "Regiões metropolitanas instituídas",
    codigo: {
      campo: "cd_mun",
      numerico: false,
      exemplo: "3550308",
      oque: "código IBGE de 7 dígitos do município",
    },
  },
  ride: {
    nome: "RIDEs",
    descricao: "Regiões Integradas de Desenvolvimento",
    codigo: {
      campo: "cd_mun",
      numerico: false,
      exemplo: "5300108",
      oque: "código IBGE de 7 dígitos do município",
    },
  },
};

/** Teto de feições trazidas numa chamada (a faixa de fronteira tem 590). */
const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 600;

// Schema for the tool input
export const malhasTemaSchema = z.object({
  tema: z.enum([...TEMAS, "listar"]).describe(`Recorte temático do território:
- biomas: os seis biomas continentais
- amazonia_legal: limite da Amazônia Legal
- semiarido: área do semiárido
- costeiro: municípios da zona costeira
- fronteira: municípios da faixa de fronteira
- metropolitana: regiões metropolitanas
- ride: Regiões Integradas de Desenvolvimento
- listar: lista os recortes disponíveis, sem consultar a fonte`),
  codigo: z
    .string()
    .optional()
    .describe(
      'Filtra registros do recorte. Em biomas, usa cd_bioma (ex. "1"). ' +
        "Nos recortes compostos por municípios — amazonia_legal, semiarido, costeiro, " +
        "fronteira, metropolitana e ride — usa o código IBGE municipal de 7 dígitos."
    ),
  limite: z
    .number()
    .int()
    .min(1)
    .max(LIMITE_MAXIMO)
    .optional()
    .default(LIMITE_PADRAO)
    .describe(
      `Quantas feições trazer (padrão ${LIMITE_PADRAO}, máx. ${LIMITE_MAXIMO}). ` +
        "O total do recorte vem sempre, mesmo quando o limite corta a lista."
    ),
});

export type MalhasTemaInput = z.infer<typeof malhasTemaSchema>;

/**
 * Structured output payload (validated against this schema by the MCP SDK).
 * Metadados e ATRIBUTOS das feições; nunca a geometria — ver o cabeçalho.
 */
export const malhasTemaOutputSchema = z.object({
  tema: z.string().describe("Recorte solicitado (ou 'listar')"),
  codigo: z.string().optional().describe("Código usado como filtro, quando informado"),
  versao: z.string().optional().describe("Versão/vintage da fonte temática consultada"),
  fonte_dados: z.string().optional().describe("URL oficial da fonte de atributos/listagem usada"),
  tipo_registro: z
    .enum(["feicao_geografica", "municipio_componente"])
    .optional()
    .describe(
      "Unidade dos registros retornados: feição geográfica do recorte ou município componente"
    ),
  feicoes: z
    .number()
    .optional()
    .describe(
      "Total de registros retornáveis na fonte; consulte tipo_registro para interpretar a unidade"
    ),
  feicoes_retornadas: z.number().optional().describe("Quantas vieram nesta resposta"),
  registros: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe("Atributos de cada feição (sem geometria)"),
  temas: z
    .array(
      z.object({
        tema: z.string().describe("Identificador do recorte"),
        nome: z.string().describe("Nome do recorte"),
        descricao: z.string().describe("Descrição do recorte"),
      })
    )
    .optional()
    .describe("Lista de recortes disponíveis (somente no modo 'listar')"),
});

type TemaSnapshotRuntime = Tema;

function snapshotRuntime(tema: TemaSnapshotRuntime): SnapshotRecorte {
  const snapshot = (RECORTES_GERADOS as Record<string, SnapshotRecorte>)[tema];
  if (!snapshot) {
    throw new Error(
      `Snapshot obrigatório ausente para ${tema}. Regenere com scripts/normalizar_recortes.py.`
    );
  }
  return snapshot;
}

function registroSnapshotParaSaida(tema: TemaSnapshotRuntime, registro: RegistroRecorte) {
  if (tema === "biomas") {
    return {
      cd_bioma: registro.codigo_bioma,
      nm_bioma: registro.bioma,
    };
  }
  if (tema === "amazonia_legal") {
    return {
      cd_mun: registro.codigo_municipio,
      nm_mun: registro.municipio,
      uf: registro.uf,
      area_total_km2: registro.area_total_km2,
      area_no_recorte_km2: registro.area_no_recorte_km2,
      percentual_no_recorte: registro.percentual_no_recorte,
    };
  }
  if (tema === "semiarido") {
    return {
      cd_mun: registro.codigo_municipio,
      nm_mun: registro.municipio,
    };
  }
  if (tema === "costeiro") {
    return {
      cd_mun: registro.codigo_municipio,
      nm_mun: registro.municipio,
    };
  }
  if (tema === "fronteira") {
    return {
      cd_mun: registro.codigo_municipio,
      nm_mun: registro.municipio,
      uf: registro.uf,
      toca_lim: registro.toca_limite_internacional,
      area_int: registro.area_no_recorte_km2,
      porc_int: registro.percentual_no_recorte,
      faixa_sede: registro.sede_na_faixa,
      cid_gemea: registro.cidade_gemea,
    };
  }
  return {
    cd_recorte: registro.codigo_recorte,
    nm_recorte: registro.recorte,
    cd_categoria: registro.codigo_categoria,
    nm_categoria: registro.categoria,
    cd_mun: registro.codigo_municipio,
    nm_mun: registro.municipio,
    uf: registro.uf,
    legislacao: registro.legislacao,
    data: registro.data,
  };
}
async function respostaDeSnapshot(
  input: MalhasTemaInput,
  recorte: Recorte,
  snapshot: SnapshotRecorte
): Promise<StructuredToolResult> {
  const tema = input.tema as TemaSnapshotRuntime;
  const campoCodigo = tema === "biomas" ? "codigo_bioma" : "codigo_municipio";
  const consulta = consultarSnapshot(snapshot, {
    ...(input.codigo ? { codigo: input.codigo, campoCodigo } : {}),
    limite: input.limite ?? LIMITE_PADRAO,
  });

  if (consulta.total === 0) {
    return { markdown: nadaEncontrado(input), isError: true };
  }

  const registros = consulta.registros.map((r) => registroSnapshotParaSaida(tema, r));

  return {
    markdown: formataSnapshot(input, recorte, snapshot, consulta.total, registros),
    structured: {
      tema: input.tema,
      ...(input.codigo ? { codigo: input.codigo } : {}),
      versao: snapshot.versao,
      fonte_dados: snapshot.fonte_url,
      tipo_registro: tema === "biomas" ? "feicao_geografica" : "municipio_componente",
      feicoes: consulta.total,
      feicoes_retornadas: registros.length,
      registros,
    },
    provenance: provenienciaIbge({
      fonte: "GEOFTP",
      url: snapshot.fonte_url,
      pesquisa: recorte.nome + ", versão " + snapshot.versao,
      dataVintage: snapshot.versao,
    }),
  };
}

/** Consulta recortes temáticos a partir dos snapshots oficiais versionados. */
export async function ibgeMalhasTema(input: MalhasTemaInput): Promise<StructuredToolResult> {
  return withMetrics("ibge_malhas_tema", "geoftp", async () => {
    if (input.tema === "listar") {
      const temas = Object.entries(RECORTES).map(([key, r]) => ({
        tema: key,
        nome: r.nome,
        descricao: r.descricao,
      }));
      return {
        markdown: listaDeRecortes(),
        structured: { tema: "listar", temas },
        provenance: provenienciaIbge({
          fonte: "GEOFTP",
          url: "https://geoftp.ibge.gov.br/",
          pesquisa: "catálogo dos sete recortes temáticos versionados pelo servidor",
        }),
      };
    }

    const recorte = RECORTES[input.tema as Tema];
    if (!recorte) {
      return { markdown: recorteInvalido(input.tema), isError: true };
    }
    if (input.codigo && !recorte.codigo) {
      return { markdown: semCodigo(input), isError: true };
    }
    if (input.codigo && recorte.codigo?.numerico && !/^\d+$/.test(input.codigo)) {
      return { markdown: codigoNaoNumerico(input, recorte), isError: true };
    }

    const tema = input.tema as TemaSnapshotRuntime;
    try {
      return respostaDeSnapshot(input, recorte, snapshotRuntime(tema));
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Falha ao carregar snapshot temático";
      return {
        markdown: formatError({
          message: mensagem,
          tool: "ibge_malhas_tema",
          params: { tema: input.tema, codigo: input.codigo },
          suggestion: "Regenere e versione os snapshots com scripts/normalizar_recortes.py.",
          relatedTools: ["ibge_malhas"],
        }),
        isError: true,
      };
    }
  });
}

// ============================================================================
// Mensagens de erro — todas nomeiam o que aceitar no lugar
// ============================================================================

function recorteInvalido(tema: string): string {
  return formatError({
    message: `Recorte temático desconhecido: "${tema}"`,
    tool: "ibge_malhas_tema",
    suggestion: `Recortes aceitos: ${TEMAS.join(", ")}. Use tema="listar" para ver a descrição de cada um.`,
    relatedTools: ["ibge_malhas"],
  });
}

function semCodigo(input: MalhasTemaInput): string {
  const comCodigo = TEMAS.filter((t) => RECORTES[t].codigo);
  return formatError({
    message: `O recorte "${input.tema}" não tem código por feição`,
    tool: "ibge_malhas_tema",
    params: { tema: input.tema, codigo: input.codigo },
    suggestion:
      `Chame sem \`codigo\` para ver as feições deste recorte. ` +
      `Aceitam código: ${comCodigo.join(", ")}.`,
    relatedTools: ["ibge_malhas"],
  });
}

function codigoNaoNumerico(input: MalhasTemaInput, r: Recorte): string {
  return formatError({
    message: `Código inválido para "${input.tema}": "${input.codigo}"`,
    tool: "ibge_malhas_tema",
    params: { tema: input.tema, codigo: input.codigo },
    suggestion: `Aqui \`codigo\` é o ${r.codigo?.oque} (ex.: "${r.codigo?.exemplo}"). Chame sem \`codigo\` para ver os disponíveis.`,
  });
}

function nadaEncontrado(input: MalhasTemaInput): string {
  return formatError({
    message: `Nenhuma feição encontrada em "${input.tema}"${input.codigo ? ` para o código "${input.codigo}"` : ""}`,
    tool: "ibge_malhas_tema",
    params: { tema: input.tema, codigo: input.codigo },
    suggestion: input.codigo
      ? `Chame sem \`codigo\` para ver quais existem neste recorte.`
      : `O snapshot respondeu vazio, o que não é esperado para este recorte — pode ser mudança na fonte.`,
    relatedTools: ["ibge_malhas"],
  });
}

// ============================================================================
// Formatação
// ============================================================================

function listaDeRecortes(): string {
  let out = "## Recortes temáticos disponíveis\n\n";
  out += "| Tema | Nome | Descrição |\n|:-----|:-----|:----------|\n";
  for (const [key, r] of Object.entries(RECORTES)) {
    out += `| \`${key}\` | ${r.nome} | ${r.descricao} |\n`;
  }
  out += "\nFonte dos atributos/listagens: snapshots oficiais IBGE/GeoFTP para os sete recortes. ";
  out +=
    "Geometria temática não faz parte do contrato desta ferramenta. Malha administrativa (país, região, UF, município) é `ibge_malhas`.\n";
  return out;
}

function formataSnapshot(
  input: MalhasTemaInput,
  r: Recorte,
  snapshot: SnapshotRecorte,
  total: number,
  registros: Array<Record<string, unknown>>
): string {
  let out = `## ${r.nome}\n\n`;
  out += "| Campo | Valor |\n|:------|:------|\n";
  out += `| **Recorte** | ${r.descricao} |\n`;
  out += `| **Registros** | ${total}${registros.length < total ? ` (mostrando ${registros.length})` : ""} |\n`;
  out += `| **Versão da fonte** | ${snapshot.versao} |\n`;
  const composicao = input.tema !== "biomas";
  out += `| **Unidade dos registros** | ${composicao ? "Município componente" : "Feição geográfica"} |\n`;
  out += "| **Fonte dos atributos** | GeoFTP/IBGE |\n";
  if (input.codigo) out += `| **Filtro** | ${r.codigo?.oque} = ${input.codigo} |\n`;
  out += "\n### Registros\n\n";

  const colunas = [...new Set(registros.flatMap((registro) => Object.keys(registro)))];
  out += "| " + colunas.join(" | ") + " |\n";
  out += "|" + colunas.map(() => ":---").join("|") + "|\n";
  for (const reg of registros) {
    out +=
      "| " +
      colunas
        .map((c) => (reg[c] === undefined || reg[c] === null ? "-" : String(reg[c])))
        .join(" | ") +
      " |\n";
  }
  if (registros.length < total) {
    out += `\n_… e mais ${total - registros.length}. Use \`limite\` para trazer mais._\n`;
  }

  out += "\n### Fontes\n\n";
  out += `Atributos/listagem: ${snapshot.fonte_url}\n`;
  return out;
}
