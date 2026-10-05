#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SOURCE_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios?orderBy=nome";
const EXPECTED_COUNT = 645;
const GUARAREMA = "3518305";
const SAO_PAULO = "3550308";

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function safe(obj, key) {
  return obj && typeof obj === "object" ? obj[key] ?? null : null;
}

export function normalizeMunicipio(raw) {
  const imediata = safe(raw, "regiao-imediata");
  const intermediaria = safe(imediata, "regiao-intermediaria");
  const micro = safe(raw, "microrregiao");
  const meso = safe(micro, "mesorregiao");
  const uf = safe(intermediaria, "UF") ?? safe(meso, "UF");
  const regiao = safe(uf, "regiao");

  return {
    codigo: String(raw?.id ?? ""),
    nome: String(raw?.nome ?? "").trim(),
    uf_codigo: uf?.id ?? null,
    uf_sigla: uf?.sigla ?? null,
    uf_nome: uf?.nome ?? null,
    regiao_codigo: regiao?.id ?? null,
    regiao_sigla: regiao?.sigla ?? null,
    regiao_nome: regiao?.nome ?? null,
    regiao_imediata_codigo: imediata?.id ?? null,
    regiao_imediata_nome: imediata?.nome ?? null,
    regiao_intermediaria_codigo: intermediaria?.id ?? null,
    regiao_intermediaria_nome: intermediaria?.nome ?? null,
    microrregiao_codigo: micro?.id ?? null,
    microrregiao_nome: micro?.nome ?? null,
    mesorregiao_codigo: meso?.id ?? null,
    mesorregiao_nome: meso?.nome ?? null,
  };
}

export function validateMunicipios(registros) {
  const flagsByCode = new Map();
  const add = (codigo, flag) => {
    const flags = flagsByCode.get(codigo) ?? [];
    flags.push(flag);
    flagsByCode.set(codigo, flags);
  };

  const codes = new Set();
  const names = new Set();

  for (const m of registros) {
    if (!/^\d{7}$/.test(m.codigo)) add(m.codigo, "CODIGO_INVALIDO");
    if (!m.codigo.startsWith("35")) add(m.codigo, "CODIGO_FORA_SP");
    if (codes.has(m.codigo)) add(m.codigo, "CODIGO_DUPLICADO");
    codes.add(m.codigo);

    if (!m.nome) add(m.codigo, "NOME_VAZIO");
    const nomeKey = m.nome.toLocaleLowerCase("pt-BR");
    if (names.has(nomeKey)) add(m.codigo, "NOME_DUPLICADO");
    names.add(nomeKey);

    if (m.uf_codigo !== null && m.uf_codigo !== 35) add(m.codigo, "UF_CODIGO_DIVERGENTE");
    if (m.uf_sigla !== null && m.uf_sigla !== "SP") add(m.codigo, "UF_SIGLA_DIVERGENTE");
    if (m.regiao_codigo !== null && m.regiao_codigo !== 3) add(m.codigo, "REGIAO_CODIGO_DIVERGENTE");
  }

  const globais = [];
  if (registros.length !== EXPECTED_COUNT) {
    globais.push(`TOTAL_ESPERADO_${EXPECTED_COUNT}_RECEBIDO_${registros.length}`);
  }
  if (codes.size !== registros.length) globais.push("CODIGOS_NAO_UNICOS");

  const linhas = registros.map((m) => {
    const flags = flagsByCode.get(m.codigo) ?? [];
    return {
      codigo: m.codigo,
      nome: m.nome,
      status: flags.length === 0 ? "OK" : "DIVERGENCIA",
      flags,
    };
  });

  return {
    ok: globais.length === 0 && linhas.every((x) => x.status === "OK"),
    globais,
    linhas,
    divergencias: linhas.filter((x) => x.status !== "OK"),
  };
}

function uniqueByCode(items) {
  const map = new Map();
  for (const item of items) {
    if (item?.codigo) map.set(item.codigo, item);
  }
  return [...map.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export function deterministicSample(registros) {
  const porCodigo = [...registros].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const porNome = [...registros].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const pickCode = (code) => registros.find((m) => m.codigo === code);

  const sample = [
    pickCode(SAO_PAULO),
    pickCode(GUARAREMA),
    porCodigo[0],
    porCodigo.at(-1),
    porNome[0],
    porNome.at(-1),
  ];

  for (const q of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    sample.push(porCodigo[Math.floor((porCodigo.length - 1) * q)]);
  }

  const byIntermediaria = new Map();
  for (const m of porCodigo) {
    const key = m.regiao_intermediaria_codigo;
    if (key !== null && !byIntermediaria.has(key)) byIntermediaria.set(key, m);
  }
  sample.push(...byIntermediaria.values());

  sample.push(registros.find((m) => /[ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]/u.test(m.nome)));
  sample.push(registros.find((m) => /\s/.test(m.nome)));

  return uniqueByCode(sample.filter(Boolean));
}

async function fetchJson(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw lastError;
}

async function validateLiveSample(sample) {
  const [{ ibgeGeocodigo }, { ibgeLocalidade }] = await Promise.all([
    import("../dist/tools/geocodigo.js"),
    import("../dist/tools/localidade.js"),
  ]);

  const results = [];
  for (const m of sample) {
    const [g, l] = await Promise.all([
      ibgeGeocodigo({ codigo: m.codigo }),
      ibgeLocalidade({ codigo: Number(m.codigo) }),
    ]);

    const gs = g?.structured ?? {};
    const ls = l?.structured ?? {};
    const flags = [];

    if (g?.isError) flags.push("GEOCODIGO_ERRO");
    if (l?.isError) flags.push("LOCALIDADE_ERRO");
    if (String(gs.codigo ?? "") !== m.codigo) flags.push("GEOCODIGO_CODIGO_DIVERGENTE");
    if (gs.nome && gs.nome !== m.nome) flags.push("GEOCODIGO_NOME_DIVERGENTE");
    if (String(ls.id ?? "") !== m.codigo) flags.push("LOCALIDADE_CODIGO_DIVERGENTE");
    if (ls.nome && ls.nome !== m.nome) flags.push("LOCALIDADE_NOME_DIVERGENTE");
    if (ls.estado?.sigla && ls.estado.sigla !== "SP") flags.push("LOCALIDADE_UF_DIVERGENTE");

    results.push({
      codigo: m.codigo,
      nome: m.nome,
      ok: flags.length === 0,
      flags,
      geocodigo_source_url: g?.provenance?.source_url ?? null,
      localidade_source_url: l?.provenance?.source_url ?? null,
    });
  }
  return results;
}

export async function runGate({ promote = false, outDir } = {}) {
  const retrievedAt = new Date().toISOString();
  const version = retrievedAt.slice(0, 10);
  const stamp = retrievedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const out = outDir ?? path.join("artifacts", "sp-645", `execucao-${stamp}`);

  const raw = await fetchJson(SOURCE_URL);
  if (!Array.isArray(raw)) throw new Error("API de Localidades não retornou uma lista.");

  const registros = raw.map(normalizeMunicipio).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const validation = validateMunicipios(registros);
  const sample = deterministicSample(registros);
  const live = await validateLiveSample(sample);

  const snapshot = {
    uf: { codigo: 35, sigla: "SP", nome: "São Paulo" },
    versao: version,
    natureza_versao: "data_extracao_api_localidades",
    fonte: "IBGE — API de Localidades",
    source_url: SOURCE_URL,
    retrieved_at: retrievedAt,
    total_registros: registros.length,
    registros,
  };
  const snapshotText = JSON.stringify(snapshot, null, 2) + "\n";
  const hash = sha256(snapshotText);

  const meta = {
    fonte: snapshot.fonte,
    source_url: SOURCE_URL,
    retrieved_at: retrievedAt,
    versao: version,
    natureza_versao: snapshot.natureza_versao,
    count: registros.length,
    sha256: hash,
    git_commit: gitHead(),
    gerador: "scripts/gate-sp-645.mjs",
    criterios: [
      "total=645",
      "codigo municipal com 7 digitos",
      "codigo prefixado por 35",
      "codigos unicos",
      "nomes nao vazios e unicos",
      "UF 35/SP quando presente",
      "Regiao Sudeste quando presente",
      "amostra deterministica validada em ibge_geocodigo e ibge_localidade",
    ],
    validacao_estrutural_ok: validation.ok,
    divergencias_estruturais: validation.divergencias.length + validation.globais.length,
    amostra_total: sample.length,
    amostra_ok: live.filter((x) => x.ok).length,
    amostra_falhas: live.filter((x) => !x.ok).length,
    issue: 15,
  };

  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "snapshot-candidato.json"), snapshotText);
  await writeFile(path.join(out, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  await writeFile(
    path.join(out, "validacao-645.jsonl"),
    validation.linhas.map((x) => JSON.stringify(x)).join("\n") + "\n"
  );
  await writeFile(path.join(out, "amostra.json"), JSON.stringify(sample, null, 2) + "\n");
  await writeFile(path.join(out, "amostra-resultados.json"), JSON.stringify(live, null, 2) + "\n");

  const resumo = {
    out,
    total: registros.length,
    estrutural_ok: validation.ok,
    divergencias_globais: validation.globais,
    divergencias_municipais: validation.divergencias,
    amostra_total: sample.length,
    amostra_ok: live.filter((x) => x.ok).length,
    amostra_falhas: live.filter((x) => !x.ok),
    sha256: hash,
    promote,
  };
  await writeFile(path.join(out, "resumo.json"), JSON.stringify(resumo, null, 2) + "\n");

  if (promote) {
    if (!validation.ok || live.some((x) => !x.ok)) {
      throw new Error("Promoção recusada: gate contém divergências.");
    }
    const dest = path.join("src", "data", "municipios");
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, `sp_municipios_${version}.json`), snapshotText);
    await writeFile(
      path.join(dest, `sp_municipios_${version}.meta.json`),
      JSON.stringify(meta, null, 2) + "\n"
    );
  }

  console.log(JSON.stringify(resumo, null, 2));
  return resumo;
}

async function main() {
  const promote = process.argv.includes("--promote");
  await runGate({ promote });
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invoked === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
