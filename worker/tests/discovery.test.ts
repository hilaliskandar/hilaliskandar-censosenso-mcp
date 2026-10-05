import { describe, expect, it } from "vitest";

import { discoveryResponseForPath, robotsTxt, sitemapXml } from "../src/discovery.js";
import { SERVER_CONFIG } from "../src/config.js";

describe("descoberta pública do endpoint CensoSenso", () => {
  it("declara exclusivamente a base pública de produção e mantém IndexNow desativado", () => {
    expect(SERVER_CONFIG.publicBaseUrl).toBe("https://censosenso.poderdapalavra.org");
    expect(SERVER_CONFIG.indexNowKey).toBeNull();
    expect(SERVER_CONFIG.extraAllowedHostnames).toContain("censosenso.poderdapalavra.org");
    expect(SERVER_CONFIG.extraAllowedHostnames).not.toContain(
      "censosenso-mcp.radar-urbano-hilaliskandar.workers.dev",
    );
  });

  it("publica robots e sitemap, mas não inventa chave IndexNow", async () => {
    const robots = discoveryResponseForPath("/robots.txt");
    const sitemap = discoveryResponseForPath("/sitemap.xml");

    expect(robots?.status).toBe(200);
    expect(await robots?.text()).toContain(`Sitemap: ${SERVER_CONFIG.publicBaseUrl}/sitemap.xml`);
    expect(sitemap?.status).toBe(200);
    expect(await sitemap?.text()).toContain(`<loc>${SERVER_CONFIG.publicBaseUrl}/</loc>`);
    expect(discoveryResponseForPath("/qualquer-chave.txt")).toBeNull();
  });

  it("as funções auxiliares anunciam apenas rotas públicas adequadas", () => {
    const robots = robotsTxt();
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /mcp");
    expect(robots).toContain("Disallow: /health");
    expect(robots).toContain("Disallow: /status");
    expect(robots).toContain("Disallow: /metrics");
    expect(robots).toContain(`Sitemap: ${SERVER_CONFIG.publicBaseUrl}/sitemap.xml`);

    const sitemap = sitemapXml();
    expect(sitemap).toContain(`<loc>${SERVER_CONFIG.publicBaseUrl}/</loc>`);
  });

  it("não carrega o domínio do projeto de referência", () => {
    const material = [robotsTxt(), sitemapXml(), SERVER_CONFIG.websiteUrl].join("\n");
    expect(material).not.toContain("sidneybissoli.com");
  });
});
