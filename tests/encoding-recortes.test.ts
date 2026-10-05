import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const arquivos = [
  path.resolve("src/data/recortes/amazonia_legal.json"),
  path.resolve("src/data/recortes/costeiro.json"),
  path.resolve("src/data/recortes/fronteira.json"),
  path.resolve("src/data/recortes/semiarido.json"),
  path.resolve("src/data/recortes-gerados.ts"),
];

const marcadoresMojibake = [
  "RegiÒo",
  "SÒo",
  "JoÒo",
  "BelÚm",
  "Vit¾ria",
  "GoiÔnia",
  "JundiaÝ",
  "Esperanþa",
  "N·cleo",
  "┴rea",
  "N├O",
  "Aþo",
  "Maringß",
  "Macapß",
];

describe("integridade de codificação dos recortes versionados", () => {
  it("não contém marcadores conhecidos de CP1252 interpretado como CP850", () => {
    for (const arquivo of arquivos) {
      const texto = fs.readFileSync(arquivo, "utf8");
      for (const marcador of marcadoresMojibake) {
        expect(texto, `${path.basename(arquivo)} contém mojibake: ${marcador}`).not.toContain(
          marcador
        );
      }
    }
  });

  it("preserva acentos portugueses em exemplos reais", () => {
    const amazonia = fs.readFileSync(path.resolve("src/data/recortes/amazonia_legal.json"), "utf8");
    const costeiro = fs.readFileSync(path.resolve("src/data/recortes/costeiro.json"), "utf8");
    const semiarido = fs.readFileSync(path.resolve("src/data/recortes/semiarido.json"), "utf8");
    const fronteira = fs.readFileSync(path.resolve("src/data/recortes/fronteira.json"), "utf8");

    expect(amazonia).toContain("São");
    expect(amazonia).toContain("João");
    expect(costeiro).toContain("Belém");
    expect(costeiro).toContain("Vitória");
    expect(semiarido).toContain("ÁGUA DOCE DO MARANHÃO");
    expect(semiarido).toContain("BARÃO DE GRAJAÚ");
    expect(fronteira).toContain("Área");
  });
});
