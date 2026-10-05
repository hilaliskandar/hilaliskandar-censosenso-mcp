#!/usr/bin/env node

/**
 * Piloto municipal CensoSenso — Guararema/SP.
 *
 * Executa as próprias funções do MCP contra as fontes reais, transforma as
 * respostas em observações auditáveis e preserva respostas brutas para
 * reprodução. Não usa fontes auxiliares.
 *
 * Uso:
 *   npm run pilot:guararema
 *   PILOTO_OUT=artifacts/piloto-guararema/minha-execucao npm run pilot:guararema
 *   PILOTO_STRICT=1 npm run pilot:guararema
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CODIGO = "3518305";
const MUNICIPIO = "Guararema";
const UF = "SP";
const NIVEL_MUNICIPAL = "6";
const EXECUTADO_EM = new Date().toISOString();
const GIT_COMMIT = (() => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
})();
const stamp = EXECUTADO_EM.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const OUT =
  process.env.PILOTO_OUT ??
  path.join("artifacts", "piloto-guararema", `execucao-${stamp}`);

const [
  { ibgeGeocodigo },
  { ibgeLocalidade },
  { ibgeVizinhos },
  { ibgeMalhas },
  { ibgeMalhasTema },
  { ibgeCidades },
  { ibgeCenso, CENSO_TABELAS },
  { ibgeDatasaude, INDICADORES_SAUDE },
  { ibgeIndicadores, INDICADORES_CONHECIDOS },
  { ibgeComparar },
] = await Promise.all([
  import("../dist/tools/geocodigo.js"),
  import("../dist/tools/localidade.js"),
  import("../dist/tools/vizinhos.js"),
  import("../dist/tools/malhas.js"),
  import("../dist/tools/malhas-tema.js"),
  import("../dist/tools/cidades.js"),
  import("../dist/tools/censo.js"),
  import("../dist/tools/datasaude.js"),
  import("../dist/tools/indicadores.js"),
  import("../dist/tools/comparar.js"),
]);

const schema = JSON.parse(
  await readFile("docs/schemas/piloto-municipal-observacao.schema.json", "utf8")
);

const observacoes = [];
const chamadas = [];
const arquivosBrutos = [];

function slug(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fonteDaProveniencia(result) {
  return result?.provenance?.source?.name ?? "CensoSenso MCP";
}

function camposProveniencia(result) {
  const p = result?.provenance;
  return {
    fonte: fonteDaProveniencia(result),
    source_url: p?.source_url ?? null,
    periodo_retornado: p?.data_vintage ?? null,
    retrieved_at:
      p?.retrieved_at instanceof Date
        ? p.retrieved_at.toISOString()
        : p?.retrieved_at ?? null,
    license: p?.license?.name ?? null,
    observado_derivado: p?.derived ? "derivado" : "observado",
  };
}

function baseObservacao({
  dominio,
  informacao,
  ferramenta,
  parametros = null,
  nivel = "municipio",
  result,
  tabela = null,
  variavel = null,
  classificacao = null,
  periodoSolicitado = null,
  valor = null,
  unidade = null,
  observadoDerivado,
  qualityFlags = [],
  lacunaTipo = null,
  observacao = null,
  fonte,
  sourceUrl,
}) {
  const prov = result ? camposProveniencia(result) : {};
  return {
    municipio_codigo: CODIGO,
    municipio_nome: MUNICIPIO,
    uf: UF,
    dominio,
    informacao,
    ferramenta,
    parametros,
    fonte: fonte ?? prov.fonte ?? "CensoSenso MCP",
    source_url: sourceUrl ?? prov.source_url ?? null,
    tabela,
    variavel,
    classificacao,
    nivel_territorial: nivel,
    periodo_solicitado: periodoSolicitado,
    periodo_retornado: prov.periodo_retornado ?? null,
    valor,
    unidade,
    observado_derivado:
      observadoDerivado ?? prov.observado_derivado ?? "referencia",
    quality_flags: qualityFlags,
    retrieved_at: prov.retrieved_at ?? null,
    license: prov.license ?? null,
    lacuna_tipo: lacunaTipo,
    observacao,
  };
}

function lacuna(opts) {
  observacoes.push(
    baseObservacao({
      ...opts,
      valor: null,
      observadoDerivado: "referencia",
      qualityFlags: [...(opts.qualityFlags ?? []), "LACUNA_CLASSIFICADA"],
    })
  );
}

function valorLinha(row) {
  const entradas = Object.entries(row ?? {});
  const achar = (regex) => entradas.find(([k]) => regex.test(k))?.[1] ?? null;
  return {
    valor: achar(/^Valor$/i) ?? achar(/\bValor\b/i),
    unidade:
      achar(/^Unidade de Medida$/i) ??
      achar(/Unidade.*Medida(?!.*Código)/i),
    periodo:
      achar(/^Ano$/i) ??
      achar(/^Período$/i) ??
      achar(/^Trimestre$/i) ??
      achar(/^Mês$/i),
    variavel:
      achar(/^Variável \(Código\)$/i) ??
      achar(/Variável.*Código/i),
  };
}

function classificacaoLinha(row) {
  const ignorar = /(Valor|Código|Unidade de Medida|Ano|Período|Trimestre|Mês|Município|Unidade da Federação)/i;
  const pares = Object.entries(row ?? {}).filter(([k, v]) => v && !ignorar.test(k));
  return pares.length ? JSON.stringify(Object.fromEntries(pares)) : null;
}

function adicionarLinhasSidra({
  dominio,
  informacao,
  ferramenta,
  parametros,
  result,
  tabela,
  variavel,
  nivel = NIVEL_MUNICIPAL,
  periodoSolicitado = null,
}) {
  const s = result?.structured ?? {};
  const rows = Array.isArray(s.registros) ? s.registros : [];

  if (rows.length === 0) {
    lacuna({
      dominio,
      informacao,
      ferramenta,
      parametros,
      nivel,
      result,
      tabela: tabela ?? s.tabela ?? null,
      variavel,
      periodoSolicitado,
      lacunaTipo: "SEM_DADO_NA_FONTE",
      observacao: "Consulta concluída sem registros de dados.",
    });
    return;
  }

  rows.forEach((row, idx) => {
    const cel = valorLinha(row);
    observacoes.push(
      baseObservacao({
        dominio,
        informacao: rows.length === 1 ? informacao : `${informacao} — registro ${idx + 1}`,
        ferramenta,
        parametros,
        nivel,
        result,
        tabela: tabela ?? s.tabela ?? null,
        variavel: cel.variavel ?? variavel ?? null,
        classificacao: classificacaoLinha(row),
        periodoSolicitado,
        valor: cel.valor ?? row,
        unidade: cel.unidade,
        observacao: cel.periodo
          ? `Período da linha: ${cel.periodo}`
          : "Período da linha não identificado; consultar periodo_retornado/proveniência.",
      })
    );
  });
}

async function gravarBruto(id, ferramenta, parametros, result) {
  const dir = path.join(OUT, "brutos");
  await mkdir(dir, { recursive: true });
  const nome = `${String(id).padStart(2, "0")}-${slug(ferramenta)}.json`;
  const rel = path.join("brutos", nome).replaceAll("\\", "/");
  const payload = {
    id,
    ferramenta,
    parametros,
    executado_em: new Date().toISOString(),
    isError: Boolean(result?.isError),
    markdown: result?.markdown ?? null,
    structured: result?.structured ?? null,
    provenance: result?.provenance ?? null,
  };
  await writeFile(path.join(OUT, rel), JSON.stringify(payload, null, 2) + "\n");
  arquivosBrutos.push(rel);
}

async function executar({
  ferramenta,
  parametros,
  fn,
  dominio,
  informacao,
  nivel = "municipio",
  onSuccess,
  onError,
  erroEsperado,
}) {
  const id = chamadas.length + 1;
  const inicio = Date.now();
  let result;
  try {
    result = await fn();
  } catch (error) {
    result = {
      isError: true,
      markdown: error instanceof Error ? error.message : String(error),
    };
  }

  await gravarBruto(id, ferramenta, parametros, result);
  const ausenciaEsperada =
    Boolean(result?.isError) &&
    typeof erroEsperado === "function" &&
    Boolean(erroEsperado(result));
  chamadas.push({
    id,
    ferramenta,
    parametros,
    ok: !result?.isError || ausenciaEsperada,
    resultado: ausenciaEsperada ? "ausencia_classificada" : result?.isError ? "erro" : "sucesso",
    duracao_ms: Date.now() - inicio,
    ...(result?.isError ? { erro: result?.markdown ?? "Falha sem mensagem." } : {}),
  });

  if (result?.isError) {
    if (onError) {
      onError(result);
    } else {
      lacuna({
        dominio,
        informacao,
        ferramenta,
        parametros,
        nivel,
        result,
        lacunaTipo: /HTTP|upstream|indispon/i.test(result.markdown ?? "")
          ? "ERRO_UPSTREAM"
          : "ERRO_MCP",
        observacao: result.markdown ?? "Falha sem mensagem.",
      });
    }
    return result;
  }

  if (onSuccess) {
    onSuccess(result);
  } else {
    observacoes.push(
      baseObservacao({
        dominio,
        informacao,
        ferramenta,
        parametros,
        nivel,
        result,
        valor: result.structured ?? null,
      })
    );
  }
  return result;
}

function validarObservacao(obs) {
  const erros = [];
  for (const chave of schema.required ?? []) {
    if (!(chave in obs) || obs[chave] === undefined || obs[chave] === null) {
      erros.push(`campo obrigatório ausente: ${chave}`);
    }
  }
  if (!/^\d{7}$/.test(obs.municipio_codigo ?? "")) erros.push("municipio_codigo inválido");
  if (!/^[A-Z]{2}$/.test(obs.uf ?? "")) erros.push("uf inválida");
  if (!["observado", "derivado", "referencia"].includes(obs.observado_derivado)) {
    erros.push("observado_derivado inválido");
  }
  const lacunas =
    schema.properties?.lacuna_tipo?.enum?.filter((x) => x !== null) ?? [];
  if (obs.lacuna_tipo !== null && !lacunas.includes(obs.lacuna_tipo)) {
    erros.push(`lacuna_tipo inválido: ${obs.lacuna_tipo}`);
  }
  return erros;
}

// 1. Identidade e hierarquia.
await executar({
  ferramenta: "ibge_geocodigo",
  parametros: { codigo: CODIGO },
  dominio: "identidade",
  informacao: "Código IBGE e hierarquia territorial",
  fn: () => ibgeGeocodigo({ codigo: CODIGO }),
});

await executar({
  ferramenta: "ibge_localidade",
  parametros: { codigo: Number(CODIGO) },
  dominio: "identidade",
  informacao: "Estrutura territorial municipal",
  fn: () => ibgeLocalidade({ codigo: Number(CODIGO) }),
});

// 2. Vizinhança e malha.
let vizinhos = [];
await executar({
  ferramenta: "ibge_vizinhos",
  parametros: { municipio: CODIGO, incluir_dados: false },
  dominio: "territorio",
  informacao: "Municípios limítrofes",
  fn: () => ibgeVizinhos({ municipio: CODIGO, incluir_dados: false }),
  onSuccess: (result) => {
    vizinhos = result.structured?.vizinhos ?? [];
    for (const v of vizinhos) {
      observacoes.push(
        baseObservacao({
          dominio: "territorio",
          informacao: "Município limítrofe",
          ferramenta: "ibge_vizinhos",
          parametros: { municipio: CODIGO, incluir_dados: false },
          nivel: "municipio",
          result,
          valor: { codigo: v.codigo, nome: v.nome, uf: v.uf ?? null },
        })
      );
    }
  },
});

await executar({
  ferramenta: "ibge_malhas",
  parametros: { localidade: CODIGO, formato: "geojson", resolucao: "0", qualidade: "minima" },
  dominio: "territorio",
  informacao: "Malha administrativa municipal",
  fn: () =>
    ibgeMalhas({
      localidade: CODIGO,
      formato: "geojson",
      resolucao: "0",
      qualidade: "minima",
    }),
});

// 3. Recortes temáticos.
lacuna({
  dominio: "recortes",
  informacao: "Bioma aplicável ao município",
  ferramenta: "ibge_malhas_tema",
  parametros: { tema: "biomas" },
  nivel: "municipio",
  lacunaTipo: "NAO_EXPOSTO_PELO_MCP",
  observacao:
    "O contrato de biomas filtra por código do bioma, não por município; o piloto não infere associação sem ferramenta explícita.",
});

for (const tema of [
  "amazonia_legal",
  "semiarido",
  "costeiro",
  "fronteira",
  "metropolitana",
  "ride",
]) {
  const parametros = { tema, codigo: CODIGO, limite: 50 };
  await executar({
    ferramenta: "ibge_malhas_tema",
    parametros,
    dominio: "recortes",
    informacao: `Pertencimento ao recorte ${tema}`,
    fn: () => ibgeMalhasTema(parametros),
    erroEsperado: (result) => /Nenhuma feição encontrada/.test(result?.markdown ?? ""),
    onSuccess: (result) => {
      observacoes.push(
        baseObservacao({
          dominio: "recortes",
          informacao: `Pertencimento ao recorte ${tema}`,
          ferramenta: "ibge_malhas_tema",
          parametros,
          nivel: "municipio",
          result,
          valor: true,
          observacao: JSON.stringify(result.structured?.registros ?? []),
        })
      );
    },
    onError: (result) => {
      if (/Nenhuma feição encontrada/.test(result?.markdown ?? "")) {
        lacuna({
          dominio: "recortes",
          informacao: `Pertencimento ao recorte ${tema}`,
          ferramenta: "ibge_malhas_tema",
          parametros,
          nivel: "municipio",
          result,
          lacunaTipo: "NAO_APLICAVEL",
          observacao:
            "Filtro municipal exato sem registro no snapshot versionado; município não pertence ao recorte.",
        });
        return;
      }
      lacuna({
        dominio: "recortes",
        informacao: `Pertencimento ao recorte ${tema}`,
        ferramenta: "ibge_malhas_tema",
        parametros,
        nivel: "municipio",
        result,
        lacunaTipo: "ERRO_MCP",
        observacao: result?.markdown ?? "Falha não classificada ao consultar recorte.",
      });
    },
  });
}

// 4. Panorama e séries municipais.
let avisosPanorama = [];
await executar({
  ferramenta: "ibge_cidades",
  parametros: { tipo: "panorama", municipio: CODIGO },
  dominio: "panorama",
  informacao: "Panorama municipal",
  fn: () => ibgeCidades({ tipo: "panorama", municipio: CODIGO }),
  onSuccess: (result) => {
    const indicadores = result.structured?.indicadores ?? [];
    for (const item of indicadores) {
      observacoes.push(
        baseObservacao({
          dominio: "panorama",
          informacao: item.nome,
          ferramenta: "ibge_cidades",
          parametros: { tipo: "panorama", municipio: CODIGO },
          nivel: "municipio",
          result,
          valor: item.valor,
          periodoSolicitado: null,
          observacao: item.ano ? `Ano informado pelo indicador: ${item.ano}` : null,
        })
      );
    }
    avisosPanorama = result.structured?.avisos ?? [];
  },
});

const diagnosticosPanorama = [
  {
    nome: "Taxa de escolarização 6-14 anos",
    indicador: "escolarizacao",
  },
  {
    nome: "Salário médio mensal",
    indicador: "salario_medio",
  },
];

for (const aviso of avisosPanorama) {
  const alvo = diagnosticosPanorama.find((d) => aviso.startsWith(d.nome + ":"));
  if (!alvo) {
    lacuna({
      dominio: "panorama",
      informacao: "Indicador do panorama indisponível nesta execução",
      ferramenta: "ibge_cidades",
      parametros: { tipo: "panorama", municipio: CODIGO },
      nivel: "municipio",
      lacunaTipo: "ERRO_UPSTREAM",
      observacao: aviso,
    });
    continue;
  }

  await executar({
    ferramenta: "ibge_cidades",
    parametros: { tipo: "indicador", municipio: CODIGO, indicador: alvo.indicador },
    dominio: "panorama",
    informacao: `Diagnóstico do aviso: ${alvo.nome}`,
    fn: () =>
      ibgeCidades({
        tipo: "indicador",
        municipio: CODIGO,
        indicador: alvo.indicador,
      }),
    onSuccess: (result) => {
      const itens = result.structured?.indicadores ?? [];
      if (itens.length === 0) {
        lacuna({
          dominio: "panorama",
          informacao: alvo.nome,
          ferramenta: "ibge_cidades",
          parametros: { tipo: "indicador", municipio: CODIGO, indicador: alvo.indicador },
          nivel: "municipio",
          result,
          lacunaTipo: "SEM_DADO_NA_FONTE",
          observacao:
            "A consulta diagnóstica específica respondeu sem valores após aviso do panorama.",
        });
        return;
      }
      for (const item of itens) {
        observacoes.push(
          baseObservacao({
            dominio: "panorama",
            informacao: alvo.nome,
            ferramenta: "ibge_cidades",
            parametros: { tipo: "indicador", municipio: CODIGO, indicador: alvo.indicador },
            nivel: "municipio",
            result,
            valor: item.valor,
            observacao: item.ano
              ? `Recuperado em consulta diagnóstica específica; ano: ${item.ano}`
              : "Recuperado em consulta diagnóstica específica.",
          })
        );
      }
    },
    onError: (result) => {
      lacuna({
        dominio: "panorama",
        informacao: alvo.nome,
        ferramenta: "ibge_cidades",
        parametros: { tipo: "indicador", municipio: CODIGO, indicador: alvo.indicador },
        nivel: "municipio",
        result,
        lacunaTipo: "ERRO_UPSTREAM",
        observacao: result?.markdown ?? aviso,
      });
    },
  });
}

for (const indicador of ["29171", "47001", "28141", "28142"]) {
  await executar({
    ferramenta: "ibge_cidades",
    parametros: { tipo: "historico", municipio: CODIGO, indicador },
    dominio: indicador === "29171" ? "demografia" : indicador === "47001" ? "economia" : "financas",
    informacao: `Série histórica do indicador Cidades@ ${indicador}`,
    fn: () => ibgeCidades({ tipo: "historico", municipio: CODIGO, indicador }),
    onSuccess: (result) => {
      for (const item of result.structured?.indicadores ?? []) {
        observacoes.push(
          baseObservacao({
            dominio:
              indicador === "29171" ? "demografia" : indicador === "47001" ? "economia" : "financas",
            informacao: item.nome ?? `Indicador Cidades@ ${indicador}`,
            ferramenta: "ibge_cidades",
            parametros: { tipo: "historico", municipio: CODIGO, indicador },
            nivel: "municipio",
            result,
            valor: item.valor,
            observacao: item.ano ? `Ano: ${item.ano}` : null,
          })
        );
      }
    },
  });
}

// 5. Censo 2022: temas essenciais.
for (const tema of ["populacao", "domicilios", "saneamento", "alfabetizacao", "idade_sexo", "cor_raca"]) {
  const tabela = CENSO_TABELAS?.[tema]?.["2022"]?.tabela ?? null;
  await executar({
    ferramenta: "ibge_censo",
    parametros: {
      ano: "2022",
      tema,
      nivel_territorial: NIVEL_MUNICIPAL,
      localidades: CODIGO,
      formato: "json",
    },
    dominio: tema === "saneamento" ? "saneamento" : "censo",
    informacao: `Censo 2022 — ${tema}`,
    fn: () =>
      ibgeCenso({
        ano: "2022",
        tema,
        nivel_territorial: NIVEL_MUNICIPAL,
        localidades: CODIGO,
        formato: "json",
      }),
    onSuccess: (result) =>
      adicionarLinhasSidra({
        dominio: tema === "saneamento" ? "saneamento" : "censo",
        informacao: `Censo 2022 — ${tema}`,
        ferramenta: "ibge_censo",
        parametros: {
          ano: "2022",
          tema,
          nivel_territorial: NIVEL_MUNICIPAL,
          localidades: CODIGO,
          formato: "json",
        },
        result,
        tabela,
        nivel: NIVEL_MUNICIPAL,
        periodoSolicitado: "2022",
      }),
  });
}

// 6. Saúde e saneamento: usa catálogo para não provocar erros que já são
// restrições territoriais conhecidas.
for (const [chave, info] of Object.entries(INDICADORES_SAUDE)) {
  if (!info.niveis.includes(NIVEL_MUNICIPAL) || info.restricaoMunicipal === "capitais") {
    lacuna({
      dominio: chave.startsWith("saneamento_") ? "saneamento" : "saude",
      informacao: info.nome,
      ferramenta: "ibge_datasaude",
      parametros: {
        indicador: chave,
        nivel_territorial: NIVEL_MUNICIPAL,
        localidade: CODIGO,
        periodo: "last",
      },
      nivel: NIVEL_MUNICIPAL,
      tabela: info.tabela,
      variavel: info.variaveis,
      lacunaTipo: "NIVEL_NAO_PUBLICADO",
      observacao:
        info.restricaoMunicipal === "capitais"
          ? "A publicação municipal deste indicador cobre apenas capitais e Brasília."
          : `O catálogo da ferramenta declara níveis disponíveis: ${info.niveis.join(", ")}.`,
      fonte: info.fonte,
    });
    continue;
  }

  await executar({
    ferramenta: "ibge_datasaude",
    parametros: {
      indicador: chave,
      nivel_territorial: NIVEL_MUNICIPAL,
      localidade: CODIGO,
      periodo: "last",
      formato: "json",
    },
    dominio: chave.startsWith("saneamento_") ? "saneamento" : "saude",
    informacao: info.nome,
    fn: () =>
      ibgeDatasaude({
        indicador: chave,
        nivel_territorial: NIVEL_MUNICIPAL,
        localidade: CODIGO,
        periodo: "last",
        formato: "json",
      }),
    onSuccess: (result) =>
      adicionarLinhasSidra({
        dominio: chave.startsWith("saneamento_") ? "saneamento" : "saude",
        informacao: info.nome,
        ferramenta: "ibge_datasaude",
        parametros: {
          indicador: chave,
          nivel_territorial: NIVEL_MUNICIPAL,
          localidade: CODIGO,
          periodo: "last",
          formato: "json",
        },
        result,
        tabela: info.tabela,
        variavel: info.variaveis,
        nivel: NIVEL_MUNICIPAL,
        periodoSolicitado: "last",
      }),
  });
}

// 7. Economia, trabalho, população e agropecuária disponíveis em N6.
for (const chave of [
  "populacao",
  "densidade",
  "pib",
  "desemprego",
  "ocupacao",
  "rendimento",
  "agricultura",
  "pecuaria",
]) {
  const info = INDICADORES_CONHECIDOS[chave];
  if (!info?.niveis?.includes(NIVEL_MUNICIPAL)) {
    lacuna({
      dominio: "economia",
      informacao: info?.nome ?? chave,
      ferramenta: "ibge_indicadores",
      parametros: { indicador: chave, nivel_territorial: NIVEL_MUNICIPAL, localidades: CODIGO },
      nivel: NIVEL_MUNICIPAL,
      tabela: info?.tabela ?? null,
      variavel: info?.variavel ?? null,
      lacunaTipo: "NIVEL_NAO_PUBLICADO",
      observacao: "O catálogo da ferramenta não declara nível municipal.",
    });
    continue;
  }

  await executar({
    ferramenta: "ibge_indicadores",
    parametros: {
      indicador: chave,
      nivel_territorial: NIVEL_MUNICIPAL,
      localidades: CODIGO,
      periodos: "last",
      formato: "json",
    },
    dominio: chave === "populacao" || chave === "densidade" ? "demografia" : "economia",
    informacao: info.nome,
    fn: () =>
      ibgeIndicadores({
        indicador: chave,
        nivel_territorial: NIVEL_MUNICIPAL,
        localidades: CODIGO,
        periodos: "last",
        formato: "json",
      }),
    onSuccess: (result) =>
      adicionarLinhasSidra({
        dominio: chave === "populacao" || chave === "densidade" ? "demografia" : "economia",
        informacao: info.nome,
        ferramenta: "ibge_indicadores",
        parametros: {
          indicador: chave,
          nivel_territorial: NIVEL_MUNICIPAL,
          localidades: CODIGO,
          periodos: "last",
          formato: "json",
        },
        result,
        tabela: info.tabela,
        variavel: info.variavel,
        nivel: NIVEL_MUNICIPAL,
        periodoSolicitado: "last",
      }),
  });
}

// 8. Comparação derivada com até quatro vizinhos, quando o gate espacial trouxe
// vizinhança suficiente.
const comparandos = [CODIGO, ...vizinhos.slice(0, 4).map((v) => String(v.codigo))];
if (comparandos.length >= 2) {
  await executar({
    ferramenta: "ibge_comparar",
    parametros: { localidades: comparandos.join(","), indicador: "populacao", formato: "ranking" },
    dominio: "comparacao",
    informacao: "População de Guararema e municípios limítrofes",
    fn: () =>
      ibgeComparar({
        localidades: comparandos.join(","),
        indicador: "populacao",
        formato: "ranking",
      }),
    onSuccess: (result) => {
      for (const item of result.structured?.localidades ?? []) {
        observacoes.push(
          baseObservacao({
            dominio: "comparacao",
            informacao: "População comparada",
            ferramenta: "ibge_comparar",
            parametros: {
              localidades: comparandos.join(","),
              indicador: "populacao",
              formato: "ranking",
            },
            nivel: NIVEL_MUNICIPAL,
            result,
            tabela: result.structured?.tabela ?? null,
            valor: {
              codigo: item.codigo,
              nome: item.nome,
              valor: item.valor,
              valorTexto: item.valorTexto,
            },
            observadoDerivado: "derivado",
          })
        );
      }
    },
  });
}

// Validação estrutural contra as regras essenciais do schema.
const errosSchema = [];
observacoes.forEach((obs, idx) => {
  for (const erro of validarObservacao(obs)) {
    errosSchema.push({ observacao: idx + 1, erro });
  }
});

await mkdir(OUT, { recursive: true });
await writeFile(
  path.join(OUT, "observacoes.jsonl"),
  observacoes.map((o) => JSON.stringify(o)).join("\n") + "\n"
);

const porDominio = Object.fromEntries(
  [...new Set(observacoes.map((o) => o.dominio))]
    .sort()
    .map((d) => [d, observacoes.filter((o) => o.dominio === d).length])
);
const porLacuna = Object.fromEntries(
  [...new Set(observacoes.map((o) => o.lacuna_tipo).filter(Boolean))]
    .sort()
    .map((d) => [d, observacoes.filter((o) => o.lacuna_tipo === d).length])
);

const execucao = {
  municipio: { codigo: CODIGO, nome: MUNICIPIO, uf: UF },
  executado_em: EXECUTADO_EM,
  git_commit: GIT_COMMIT,
  schema: "docs/schemas/piloto-municipal-observacao.schema.json",
  chamadas,
  resumo: {
    chamadas: chamadas.length,
    chamadas_ok: chamadas.filter((c) => c.ok).length,
    chamadas_erro: chamadas.filter((c) => !c.ok).length,
    observacoes: observacoes.length,
    por_dominio: porDominio,
    por_lacuna: porLacuna,
    erros_schema: errosSchema.length,
  },
  erros_schema: errosSchema,
  observacoes,
};
await writeFile(path.join(OUT, "execucao.json"), JSON.stringify(execucao, null, 2) + "\n");

const linhasResumo = [
  "# Piloto CensoSenso — Guararema/SP",
  "",
  `Execução: ${EXECUTADO_EM}`,
  `Código IBGE: ${CODIGO}`,
  `Chamadas: ${chamadas.length} (${chamadas.filter((c) => c.ok).length} sucesso; ${chamadas.filter((c) => !c.ok).length} erro)`,
  `Observações: ${observacoes.length}`,
  `Erros estruturais do schema: ${errosSchema.length}`,
  "",
  "## Observações por domínio",
  "",
  ...Object.entries(porDominio).map(([k, v]) => `- ${k}: ${v}`),
  "",
  "## Lacunas classificadas",
  "",
  ...(Object.keys(porLacuna).length
    ? Object.entries(porLacuna).map(([k, v]) => `- ${k}: ${v}`)
    : ["- nenhuma"]),
  "",
  "## Chamadas",
  "",
  ...chamadas.map(
    (c) => `- ${c.ok ? "OK" : "ERRO"} — ${c.id}. ${c.ferramenta} — ${c.duracao_ms} ms`
  ),
  "",
];
await writeFile(path.join(OUT, "resumo.md"), linhasResumo.join("\n") + "\n");

const files = [
  "execucao.json",
  "observacoes.jsonl",
  "resumo.md",
  ...arquivosBrutos,
];
const manifesto = [];
for (const rel of files) {
  const data = await readFile(path.join(OUT, rel));
  manifesto.push({
    arquivo: rel,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
await writeFile(
  path.join(OUT, "manifesto.json"),
  JSON.stringify({ executado_em: EXECUTADO_EM, arquivos: manifesto }, null, 2) + "\n"
);

const chamadasComErro = chamadas
  .filter((c) => !c.ok)
  .map((c) => ({
    id: c.id,
    ferramenta: c.ferramenta,
    parametros: c.parametros,
    erro: c.erro,
  }));

const lacunasAbertas = observacoes
  .filter((o) =>
    ["ERRO_UPSTREAM", "ERRO_MCP", "PENDENTE_VALIDACAO", "NAO_EXPOSTO_PELO_MCP"].includes(
      o.lacuna_tipo
    )
  )
  .map((o) => ({
    dominio: o.dominio,
    informacao: o.informacao,
    ferramenta: o.ferramenta,
    lacuna_tipo: o.lacuna_tipo,
    parametros: o.parametros,
    observacao: o.observacao,
  }));

console.log(
  JSON.stringify(
    {
      out: OUT,
      ...execucao.resumo,
      chamadas_com_erro: chamadasComErro,
      lacunas_abertas: lacunasAbertas,
    },
    null,
    2
  )
);

const pendentes = observacoes.filter((o) => o.lacuna_tipo === "PENDENTE_VALIDACAO").length;
const errosMcp = observacoes.filter((o) => o.lacuna_tipo === "ERRO_MCP").length;
if (process.env.PILOTO_STRICT === "1" && (errosSchema.length || pendentes || errosMcp)) {
  process.exitCode = 2;
}
