import { describe, expect, it } from "vitest";

import { landingHtml } from "../src/landing.js";
import { LANDING, SERVER_CONFIG } from "../src/config.js";

const html = landingHtml();

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

describe("landing page — identidade CensoSenso", () => {
  it("declara o idioma e o resumo do projeto", () => {
    expect(html).toContain(`<html lang="${LANDING.lang}">`);
    expect(html).toContain(`<meta name="description" content="${esc(LANDING.resumo)}">`);
  });

  it("usa a identidade própria do CensoSenso", () => {
    expect(SERVER_CONFIG.name).toBe("censosenso-mcp");
    expect(SERVER_CONFIG.title).toBe("CensoSenso MCP");
    expect(html).toContain(SERVER_CONFIG.title);
    expect(html).not.toContain("ibge.sidneybissoli.com");
    expect(html).not.toContain("sbissoli76@gmail.com");
  });

  it("aponta para o repositório atual e preserva a referência técnica", () => {
    expect(html).toContain(`href="${LANDING.repoUrl}"`);
    expect(html).toContain(`href="${LANDING.referenceUrl}"`);

    const bruto = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
    expect(bruto).toBeTruthy();
    const dados = JSON.parse(bruto as string) as Record<string, unknown>;
    expect(dados.name).toBe(SERVER_CONFIG.title);
    expect(dados.codeRepository).toBe(LANDING.repoUrl);
    expect(dados.isBasedOn).toBe(LANDING.referenceUrl);
  });

  it("anuncia o endpoint HTTP público de produção", () => {
    expect(SERVER_CONFIG.publicBaseUrl).toBe("https://censosenso.poderdapalavra.org");
    expect(html).toContain(`${SERVER_CONFIG.publicBaseUrl}${SERVER_CONFIG.mcpRoute}`);
    expect(html).not.toContain("ainda não declara endpoint HTTP público");
    expect(html).not.toContain("https://ibge.sidneybissoli.com/mcp");
  });

  it("não inventa contato, pacote npm ou tutorial próprios", () => {
    expect(SERVER_CONFIG.contactEmail).toBeNull();
    expect(LANDING.npmUrl).toBeNull();
    expect(LANDING.tutorialUrl).toBeNull();
    expect(LANDING.emOutroIdioma.tutorialUrl).toBeNull();
    expect(html).not.toContain("mailto:");
  });

  it("mantém exemplos e destaques úteis", () => {
    for (const exemplo of LANDING.exemplos) expect(html).toContain(esc(exemplo));
    for (const destaque of LANDING.destaques) expect(html).toContain(esc(destaque));
  });

  it("traz resumo e exemplos no segundo idioma", () => {
    expect(LANDING.emOutroIdioma.lang).not.toBe(LANDING.lang);
    expect(html).toContain(`lang="${LANDING.emOutroIdioma.lang}"`);
    expect(html).toContain(esc(LANDING.emOutroIdioma.resumo));
    for (const exemplo of LANDING.emOutroIdioma.exemplos) {
      expect(html).toContain(esc(exemplo));
    }
  });
});
