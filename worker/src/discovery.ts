/**
 * Rotas de descoberta do transporte HTTP.
 *
 * Elas só devem existir quando o CensoSenso possuir uma base pública própria.
 * Enquanto publicBaseUrl for nulo, nenhum robots/sitemap/IndexNow é anunciado.
 */

import { SERVER_CONFIG } from "./config.js";

const ULTIMA_MUDANCA = "2026-09-21";

function texto(corpo: string, tipo = "text/plain; charset=utf-8"): Response {
  return new Response(corpo, {
    status: 200,
    headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=3600" },
  });
}

export function robotsTxt(): string {
  const site = SERVER_CONFIG.publicBaseUrl;
  if (!site) return "User-agent: *\nDisallow: /\n";

  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /mcp",
    "Disallow: /health",
    "Disallow: /status",
    "Disallow: /metrics",
    "",
    `Sitemap: ${site}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml(): string {
  const site = SERVER_CONFIG.publicBaseUrl;
  if (!site) return "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site}/</loc>
    <lastmod>${ULTIMA_MUDANCA}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

export function discoveryResponseForPath(pathname: string): Response | null {
  if (!SERVER_CONFIG.publicBaseUrl) return null;

  if (pathname === "/robots.txt") return texto(robotsTxt());
  if (pathname === "/sitemap.xml") return texto(sitemapXml(), "application/xml; charset=utf-8");

  const key = SERVER_CONFIG.indexNowKey;
  if (key && pathname === `/${key}.txt`) return texto(key);
  return null;
}
