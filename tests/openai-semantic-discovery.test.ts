import { describe, expect, it } from "vitest";
import { createIndex } from "@sbissoli/mcp-search";
import {
  entradasCenso,
  entradasSaude,
  entradasRecortes,
  entradasIndicadores,
  entradasSidra,
  entradasMunicipios,
} from "../src/tools/deep-research.js";

const sidraConcorrentes = [
  {
    id: "CD",
    nome: "Censo Demográfico",
    agregados: [
      { id: "6803", nome: "Domicílios particulares permanentes ocupados por tipo de esgotamento sanitário" },
      { id: "9543", nome: "Taxa de alfabetização por idade, cor ou raça e sexo" },
      { id: "10089", nome: "População residente, total e quilombola, por sexo e grupos de idade" },
      { id: "9514", nome: "População residente por idade e sexo" },
    ],
  },
  {
    id: "RC",
    nome: "Estatísticas do Registro Civil",
    agregados: [
      { id: "2612", nome: "Nascidos vivos por local de residência da mãe" },
      { id: "2681", nome: "Óbitos por local de residência" },
    ],
  },
];

const municipios = [
  { "municipio-id": 3550308, "municipio-nome": "São Paulo", "UF-sigla": "SP" },
  { "municipio-id": 3509502, "municipio-nome": "Campinas", "UF-sigla": "SP" },
];

const indice = createIndex([
  ...entradasSidra(sidraConcorrentes),
  ...entradasMunicipios(municipios),
  ...entradasIndicadores(),
  ...entradasCenso(),
  ...entradasSaude(),
  ...entradasRecortes(),
]);

function ids(query: string, limit = 10): string[] {
  return indice.search(query, { limit }).map((x) => x.id);
}

function deveAparecer(query: string, esperado: string, topN = 5) {
  const encontrados = ids(query, topN);
  expect(encontrados, `"${query}" não encontrou ${esperado} no top ${topN}`).toContain(esperado);
}

describe("descoberta semântica em linguagem natural para ChatGPT", () => {
  it("encontra esgotamento sanitário sem o usuário conhecer a tabela", () => {
    deveAparecer("esgotamento sanitário", "saude:saneamento_esgoto");
    deveAparecer("rede de esgoto nos domicílios", "censo:saneamento");
  });

  it("encontra população quilombola como tema censitário", () => {
    deveAparecer("população quilombola", "censo:quilombolas");
    deveAparecer("quilombolas censo 2022", "censo:quilombolas");
  });

  it("encontra mortalidade infantil e esperança de vida", () => {
    deveAparecer("mortalidade infantil", "saude:mortalidade_infantil", 3);
    deveAparecer("esperança de vida ao nascer", "saude:esperanca_vida", 3);
  });

  it("encontra alfabetização no Censo 2022", () => {
    deveAparecer("alfabetização censo 2022", "censo:alfabetizacao");
    deveAparecer("taxa de alfabetização", "censo:alfabetizacao");
  });

  it("distingue população censitária de estimativa corrente", () => {
    deveAparecer("população censo 2022", "censo:populacao");
    deveAparecer("estimativa atual de população", "ind:populacao");
  });

  it("encontra recortes territoriais por linguagem natural", () => {
    deveAparecer("Mata Atlântica", "recorte:biomas", 3);
    deveAparecer("municípios da Amazônia Legal", "recorte:amazonia_legal", 3);
    deveAparecer("municípios do semiárido", "recorte:semiarido", 3);
    deveAparecer("faixa de fronteira cidades gêmeas", "recorte:fronteira", 3);
    deveAparecer("Região Metropolitana de Campinas", "recorte:metropolitana", 3);
    deveAparecer("RIDE Distrito Federal", "recorte:ride", 5);
  });

  it("mantém municípios pesquisáveis pelo nome", () => {
    deveAparecer("Campinas SP município", "mun:3509502", 3);
    deveAparecer("São Paulo município", "mun:3550308", 3);
  });
});
