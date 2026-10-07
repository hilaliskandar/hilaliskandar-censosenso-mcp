import { z } from "zod";
import { IBGE_API } from "../types.js";
import { cacheKey, CACHE_TTL, cachedFetch } from "../cache.js";
import { fetchSidra } from "../sidra-agregados.js";
import { withMetrics } from "../metrics.js";
import { sidraRecords, type StructuredToolResult } from "../structured.js";
import { valorSidra } from "../stats.js";
import { extrairPeriodoSidra, provenienciaIbge } from "../provenance.js";
import { TEMPLATES_COMPARACAO } from "./comparar.js";

const INDICADORES_MAPA = [
  "populacao",
  "populacao_censo",
  "pib",
  "area",
  "densidade",
  "alfabetizacao",
  "domicilios",
] as const;

const PALETA = ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"];

export const mapaSchema = z.object({
  municipios: z.string().describe("Códigos IBGE municipais de 7 dígitos, separados por vírgula; todos na mesma UF"),
  indicador: z.enum(INDICADORES_MAPA).optional().default("populacao"),
  classificacao: z.enum(["quantis", "intervalos_iguais"]).optional().default("quantis"),
  classes: z.number().int().min(2).max(7).optional().default(5),
  largura: z.number().int().min(480).max(1600).optional().default(960),
  titulo: z.string().max(160).optional(),
});

export type MapaInput = z.infer<typeof mapaSchema>;

export const mapaOutputSchema = z.object({
  indicador: z.string(),
  nome: z.string(),
  tabela: z.string(),
  classificacao: z.string(),
  classes: z.array(z.object({
    indice: z.number().int(),
    minimo: z.number(),
    maximo: z.number(),
    cor: z.string(),
  })),
  localidades: z.array(z.object({
    codigo: z.string(),
    nome: z.string(),
    valor: z.number().nullable(),
    classe: z.number().int().nullable(),
  })),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  svg: z.string(),
  fontes: z.object({ dados: z.string(), geometria: z.string() }),
});

interface MalhaFeature {
  type: "Feature";
  properties?: { codarea?: string; [key: string]: unknown };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] }
    | null;
}

interface MalhaCollection {
  type: "FeatureCollection";
  features: MalhaFeature[];
}

interface ValorMunicipal {
  codigo: string;
  nome: string;
  valor: number | null;
}

interface ClasseMapa {
  indice: number;
  minimo: number;
  maximo: number;
  cor: string;
}

function parseMunicipios(texto: string): string[] {
  return [...new Set(texto.split(",").map((v) => v.trim()).filter(Boolean))];
}

function parseValores(data: Record<string, string>[]): ValorMunicipal[] {
  const parsed = sidraRecords(data);
  const idxCodigo = parsed.colunas.findIndex((c) => /munic[ií]pio/i.test(c) && /c[oó]digo/i.test(c));
  const idxNome = parsed.colunas.findIndex((c) => /^munic[ií]pio$/i.test(c));
  const idxValor = parsed.colunas.findIndex((c) => /^valor$/i.test(c));
  if (idxCodigo < 0 || idxValor < 0) return [];
  return parsed.registros.map((row) => ({
    codigo: row[parsed.colunas[idxCodigo]] ?? "",
    nome: idxNome >= 0 ? row[parsed.colunas[idxNome]] ?? "" : row[parsed.colunas[idxCodigo]] ?? "",
    valor: valorSidra(row[parsed.colunas[idxValor]] ?? ""),
  }));
}

function limitesQuantis(valores: number[], quantidade: number): number[] {
  const ordenados = [...valores].sort((a, b) => a - b);
  if (ordenados[0] === ordenados.at(-1)) return [ordenados[0], ordenados[0]];
  const limites = [ordenados[0]];
  for (let i = 1; i < quantidade; i++) {
    const pos = Math.min(ordenados.length - 1, Math.ceil((i * ordenados.length) / quantidade) - 1);
    limites.push(ordenados[pos]);
  }
  limites.push(ordenados.at(-1)!);
  return limites;
}

function limitesIguais(valores: number[], quantidade: number): number[] {
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  if (minimo === maximo) return [minimo, maximo];
  const passo = (maximo - minimo) / quantidade;
  return Array.from({ length: quantidade + 1 }, (_, i) => i === quantidade ? maximo : minimo + passo * i);
}

function construirClasses(
  valores: number[],
  metodo: "quantis" | "intervalos_iguais",
  desejadas: number
): ClasseMapa[] {
  const unicos = [...new Set(valores)].sort((a, b) => a - b);
  if (unicos.length === 1) {
    return [{ indice: 0, minimo: unicos[0], maximo: unicos[0], cor: PALETA[5] }];
  }
  const quantidade = Math.min(desejadas, unicos.length, PALETA.length);
  const limites = metodo === "quantis"
    ? limitesQuantis(valores, quantidade)
    : limitesIguais(valores, quantidade);
  const cores = PALETA.slice(PALETA.length - quantidade);
  return Array.from({ length: quantidade }, (_, i) => ({
    indice: i,
    minimo: limites[i],
    maximo: limites[i + 1],
    cor: cores[i],
  }));
}

function classeDoValor(valor: number | null, classes: ClasseMapa[]): number | null {
  if (valor === null) return null;
  for (let i = 0; i < classes.length; i++) {
    if (valor <= classes[i].maximo || i === classes.length - 1) return classes[i].indice;
  }
  return classes.length - 1;
}

function bboxFeatures(features: MalhaFeature[]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const scan = (v: unknown): void => {
    if (!Array.isArray(v)) return;
    if (v.length >= 2 && typeof v[0] === "number" && typeof v[1] === "number") {
      minX = Math.min(minX, v[0]);
      minY = Math.min(minY, v[1]);
      maxX = Math.max(maxX, v[0]);
      maxY = Math.max(maxY, v[1]);
      return;
    }
    for (const item of v) scan(item);
  };
  for (const feature of features) scan(feature.geometry?.coordinates);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) throw new Error("Extensão geométrica inválida");
  return [minX, minY, maxX, maxY];
}

function escapar(texto: string): string {
  return texto.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function formatar(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(valor);
}

function renderSvg(
  features: MalhaFeature[],
  valores: Map<string, ValorMunicipal>,
  classes: ClasseMapa[],
  bbox: [number, number, number, number],
  largura: number,
  titulo: string,
  fonteDados: string
): string {
  const alturaMapa = Math.round(largura * 0.62);
  const altura = alturaMapa + 118 + classes.length * 24;
  const margem = 28;
  const dx = Math.max(bbox[2] - bbox[0], 1e-9);
  const dy = Math.max(bbox[3] - bbox[1], 1e-9);
  const escala = Math.min((largura - 2 * margem) / dx, (alturaMapa - 2 * margem) / dy);
  const offX = (largura - dx * escala) / 2;
  const offY = (alturaMapa - dy * escala) / 2;
  const projetar = (c: number[]) => [offX + (c[0] - bbox[0]) * escala, offY + (bbox[3] - c[1]) * escala];
  const ring = (coords: number[][]) => coords.map((c, i) => {
    const p = projetar(c);
    return (i === 0 ? "M" : "L") + p[0].toFixed(2) + "," + p[1].toFixed(2);
  }).join(" ") + " Z";
  const path = (feature: MalhaFeature) => {
    if (!feature.geometry) return "";
    if (feature.geometry.type === "Polygon") return feature.geometry.coordinates.map(ring).join(" ");
    return feature.geometry.coordinates.flatMap((p) => p.map(ring)).join(" ");
  };
  const paths = features.map((feature) => {
    const codigo = String(feature.properties?.codarea ?? "");
    const dado = valores.get(codigo);
    const classe = classeDoValor(dado?.valor ?? null, classes);
    const cor = classe === null ? "#e6e6e6" : classes[classe].cor;
    const valor = dado?.valor == null ? "sem dado" : formatar(dado.valor);
    return '<path d="' + path(feature) + '" fill="' + cor + '" stroke="#ffffff" stroke-width="0.8" fill-rule="evenodd"><title>' + escapar(dado?.nome ?? codigo) + " — " + escapar(valor) + "</title></path>";
  }).join("");
  const legendaY = alturaMapa + 54;
  const legenda = classes.map((classe, i) => {
    const y = legendaY + i * 24;
    const rotulo = classe.minimo === classe.maximo ? formatar(classe.minimo) : formatar(classe.minimo) + " – " + formatar(classe.maximo);
    return '<rect x="32" y="' + String(y - 13) + '" width="18" height="18" fill="' + classe.cor + '"/><text x="60" y="' + String(y) + '" font-size="13" font-family="Arial, sans-serif">' + escapar(rotulo) + "</text>";
  }).join("");
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + String(largura) + '" height="' + String(altura) + '" viewBox="0 0 ' + String(largura) + " " + String(altura) + '" role="img" aria-label="' + escapar(titulo) + '"><rect width="100%" height="100%" fill="#ffffff"/><text x="32" y="30" font-size="20" font-weight="700" font-family="Arial, sans-serif">' + escapar(titulo) + '</text><g transform="translate(0,38)">' + paths + '</g><text x="32" y="' + String(alturaMapa + 28) + '" font-size="14" font-weight="700" font-family="Arial, sans-serif">Legenda</text>' + legenda + '<text x="32" y="' + String(altura - 28) + '" font-size="11" font-family="Arial, sans-serif">Fonte dos dados: ' + escapar(fonteDados) + ". Geometria: IBGE — API de Malhas Geográficas.</text></svg>";
}

export async function ibgeMapa(input: MapaInput): Promise<StructuredToolResult> {
  return withMetrics("ibge_mapa", "cartografia", async () => {
    const municipios = parseMunicipios(input.municipios);
    if (municipios.length < 2) return { markdown: "Informe pelo menos 2 municípios.", isError: true };
    if (municipios.length > 50) return { markdown: "Máximo de 50 municípios nesta versão.", isError: true };
    const invalidos = municipios.filter((codigo) => !/^\d{7}$/.test(codigo));
    if (invalidos.length) return { markdown: "Códigos municipais inválidos: " + invalidos.join(", "), isError: true };
    const ufs = [...new Set(municipios.map((codigo) => codigo.slice(0, 2)))];
    if (ufs.length !== 1) return { markdown: "Todos os municípios devem pertencer à mesma UF.", isError: true };

    const indicador = input.indicador ?? "populacao";
    const template = TEMPLATES_COMPARACAO[indicador];
    if (!template) return { markdown: "Indicador cartográfico não suportado.", isError: true };

    try {
      const caminho = "/t/" + template.tabela + "/n6/" + municipios.join(",") + "/v/" + template.variaveis + "/p/" + template.periodos;
      const sidra = await fetchSidra(caminho, CACHE_TTL.SHORT);
      const valoresLista = parseValores(sidra.data);
      const porCodigo = new Map(valoresLista.map((item) => [item.codigo, item]));
      for (const codigo of municipios) if (!porCodigo.has(codigo)) porCodigo.set(codigo, { codigo, nome: codigo, valor: null });

      const geometriaUrl = IBGE_API.MALHAS + "/estados/" + ufs[0] + "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio";
      const malha = await cachedFetch<MalhaCollection>(geometriaUrl, cacheKey(geometriaUrl), CACHE_TTL.STATIC);
      const selecionados = malha.features.filter((f) => municipios.includes(String(f.properties?.codarea ?? "")));
      if (!selecionados.length) return { markdown: "Nenhuma geometria municipal encontrada.", isError: true };

      const numericos = [...porCodigo.values()].map((d) => d.valor).filter((v): v is number => v !== null);
      if (!numericos.length) return { markdown: "Nenhum valor numérico disponível.", isError: true };

      const classes = construirClasses(numericos, input.classificacao ?? "quantis", input.classes ?? 5);
      const bbox = bboxFeatures(selecionados);
      const titulo = input.titulo?.trim() || template.nome + " — " + String(municipios.length) + " municípios";
      const svg = renderSvg(selecionados, porCodigo, classes, bbox, input.largura ?? 960, titulo, "IBGE — SIDRA, Tabela " + template.tabela);
      const localidades = municipios.map((codigo) => {
        const item = porCodigo.get(codigo)!;
        return { codigo, nome: item.nome, valor: item.valor, classe: classeDoValor(item.valor, classes) };
      });
      const parsed = sidraRecords(sidra.data);
      const periodo = extrairPeriodoSidra(parsed.colunas, parsed.registros);

      return {
        markdown: "## " + titulo + "\n\nIndicador: " + template.nome + "\nMunicípios: " + String(municipios.length) + "\nClassificação: " + (input.classificacao ?? "quantis") + "\n\nO SVG completo está em structuredContent.svg.",
        structured: {
          indicador,
          nome: template.nome,
          tabela: template.tabela,
          classificacao: input.classificacao ?? "quantis",
          classes,
          localidades,
          bbox,
          svg,
          fontes: { dados: sidra.url, geometria: geometriaUrl },
        },
        provenance: provenienciaIbge({
          fonte: "SIDRA",
          url: sidra.url,
          chaveCache: sidra.chaveCache,
          pesquisa: "SIDRA, Tabela " + template.tabela + " + API de Malhas Geográficas",
          dataset: template.tabela,
          dataVintage: periodo,
          derivado: {
            nota: "Mapa coroplético derivado dos valores SIDRA e das geometrias municipais da API de Malhas; classificação, projeção SVG e legenda são computadas pelo CensoSenso.",
          },
        }),
      };
    } catch (error) {
      return { markdown: "Erro ao gerar mapa: " + (error instanceof Error ? error.message : "falha desconhecida"), isError: true };
    }
  });
}
