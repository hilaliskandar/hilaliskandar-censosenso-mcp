/**
 * Identidade e parâmetros do transporte HTTP do CensoSenso.
 *
 * O Worker usa exclusivamente censosenso.poderdapalavra.org como domínio
 * público de produção. A versão continua vindo do build do pacote pai, que é a
 * única fonte de verdade de versão.
 */

import { SERVER_VERSION } from "../../dist/server.js";

export const SERVER_CONFIG = {
  /** Nome curto do servidor (handshake MCP, /status, landing). */
  name: "censosenso-mcp",
  /** Versão do servidor — única fonte: package.json do pacote pai. */
  version: SERVER_VERSION,
  /** Título de exibição. */
  title: "CensoSenso MCP",
  /** Uma frase: o que o servidor oferece e de qual fonte. */
  description:
    "CensoSenso: dados oficiais do IBGE para análises territoriais, sociais, econômicas e de saúde.",
  /**
   * Contato público do endpoint HTTP. Permanece nulo enquanto o CensoSenso não
   * definir um canal público próprio.
   */
  contactEmail: null as string | null,
  /**
   * Repositório público do protótipo usado no handshake e na documentação.
   */
  websiteUrl: "https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp",
  /**
   * Base pública do Worker em produção. Nula desativaria as rotas de descoberta/IndexNow.
   */
  publicBaseUrl: "https://censosenso.poderdapalavra.org" as string | null,
  /** Chave IndexNow do domínio próprio, quando existir. */
  indexNowKey: null as string | null,
  /** Rota do endpoint MCP (Streamable HTTP). */
  mcpRoute: "/mcp",
  /**
   * Hosts aceitos pelo transporte MCP: desenvolvimento local e domínio canônico.
   */
  extraAllowedHostnames: [
    "localhost",
    "127.0.0.1",
    "censosenso.poderdapalavra.org",
  ] as string[],
} as const;

/**
 * Rate limit por cliente (IP), aplicado às rotas não-públicas.
 * Token bucket em memória por isolate.
 */
export const RATE_LIMIT = {
  clientBurst: 20,
  clientRefillPerSec: 5,
  maxClientBuckets: 1000,
} as const;

export const LANDING = {
  lang: "pt-BR" as "pt-BR" | "en",
  resumo:
    "Servidor MCP com 24 ferramentas de dados oficiais do IBGE — geografia, censo, " +
    "economia e saúde — com valor exato e a fonte citada em cada resposta.",
  exemplos: [
    "“Qual era a população de Belo Horizonte no Censo 2022?”",
    "“Liste os municípios do Espírito Santo.”",
    "“Compare o PIB das capitais do Sudeste.”",
    "“Qual foi o desemprego no 2º trimestre de 2026?”",
  ] as readonly string[],
  destaques: [
    "Toda resposta traz procedência: pesquisa ou tabela, período e URL que reproduz a consulta.",
    "Consultas territoriais, censitárias, econômicas e de saúde usam fontes oficiais do IBGE.",
    "O servidor diferencia dados observados, derivações e limitações da fonte.",
    "Snapshots oficiais versionados são usados quando a fonte externa não é operacionalmente confiável.",
  ] as readonly string[],
  repoUrl: "https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp",
  npmUrl: null as string | null,
  docsUrl: "https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/blob/main/README.pt-BR.md",
  tutorialUrl: null as string | null,
  /**
   * Referência técnica histórica preservada explicitamente, sem usar sua
   * infraestrutura como identidade operacional do CensoSenso.
   */
  referenceUrl: "https://github.com/SidneyBissoli/ibge-br-mcp",
  emOutroIdioma: {
    lang: "en" as "pt-BR" | "en",
    resumo:
      "Official Brazilian public data for AI-assisted analysis: geography, census, " +
      "economy and health from IBGE APIs, with reproducible provenance.",
    exemplos: [
      "“What was the population of Belo Horizonte in the 2022 Census?”",
      "“Which municipalities border Guararema?”",
    ] as readonly string[],
    tutorialUrl: null as string | null,
  },
} as const;
