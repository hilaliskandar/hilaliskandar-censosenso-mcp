/**
 * Landing page do transporte HTTP.
 *
 * A página identifica o projeto e anuncia o endpoint público quando
 * SERVER_CONFIG.publicBaseUrl está configurado.
 */

import { SERVER_CONFIG, LANDING } from "./config.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const T = {
  "pt-BR": {
    perguntas: "Perguntas que ele responde",
    comoUsar: "Como usar",
    endpoints: "Endpoints",
    links: "Links",
    contato: "Contato",
    repo: "Código-fonte no GitHub",
    pacote: "Pacote no npm",
    docs: "Documentação",
    tutorial: "Tutorial",
    referencia: "Referência técnica de origem",
    protocolo: "Protocolo",
    tambem: "Also in English",
    semEndpoint:
      "Este ambiente não declarou uma base HTTP pública. Use STDIO ou execute o Worker localmente com wrangler dev.",
  },
  en: {
    perguntas: "Questions it answers",
    comoUsar: "How to use it",
    endpoints: "Endpoints",
    links: "Links",
    contato: "Contact",
    repo: "Source on GitHub",
    pacote: "Package on npm",
    docs: "Documentation",
    tutorial: "Tutorial",
    referencia: "Original technical reference",
    protocolo: "Protocol",
    tambem: "Também em português",
    semEndpoint:
      "This environment does not declare a public HTTP base. Use STDIO or run the Worker locally with wrangler dev.",
  },
} as const;

export function landingHtml(): string {
  const c = SERVER_CONFIG;
  const l = LANDING;
  const t = T[l.lang];
  const site = c.publicBaseUrl ?? c.websiteUrl;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: c.title,
    description: l.resumo,
    url: site,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    inLanguage: l.lang,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    license: "https://opensource.org/licenses/MIT",
    author: { "@type": "Organization", name: "CensoSenso contributors" },
    codeRepository: l.repoUrl,
    isBasedOn: l.referenceUrl,
  };

  const listaLinks = [
    `<li><a href="${esc(l.repoUrl)}">${t.repo}</a></li>`,
    l.npmUrl ? `<li><a href="${esc(l.npmUrl)}">${t.pacote}</a></li>` : "",
    l.tutorialUrl ? `<li><a href="${esc(l.tutorialUrl)}">${t.tutorial}</a></li>` : "",
    l.docsUrl ? `<li><a href="${esc(l.docsUrl)}">${t.docs}</a></li>` : "",
    `<li><a href="${esc(l.referenceUrl)}">${t.referencia}</a></li>`,
    `<li><a href="https://modelcontextprotocol.io">${t.protocolo}: Model Context Protocol</a></li>`,
  ]
    .filter(Boolean)
    .join("\n  ");

  const uso = c.publicBaseUrl
    ? `Aponte um cliente MCP para <code>${esc(c.publicBaseUrl)}${esc(c.mcpRoute)}</code> (Streamable HTTP).`
    : t.semEndpoint;

  const contato = c.contactEmail
    ? `<p class="muted">${t.contato}: <a href="mailto:${esc(c.contactEmail)}">${esc(c.contactEmail)}</a></p>`
    : "";

  const ogImage = c.publicBaseUrl
    ? `<meta property="og:image" content="${esc(c.publicBaseUrl)}/icon.png">`
    : "";

  return `<!doctype html>
<html lang="${l.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(l.resumo)}">
<link rel="canonical" href="${esc(site)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(c.title)}">
<meta property="og:title" content="${esc(c.title)}">
<meta property="og:description" content="${esc(l.resumo)}">
<meta property="og:url" content="${esc(site)}">
${ogImage}
<meta property="og:locale" content="${l.lang === "pt-BR" ? "pt_BR" : "en_US"}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; margin: 0; padding: 2rem 1.25rem; color: CanvasText; background: Canvas; }
  main { max-width: 46rem; margin: 0 auto; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; }
  h2 { font-size: 1.15rem; margin-top: 2rem; }
  code { background: color-mix(in srgb, CanvasText 10%, Canvas 90%); padding: .1rem .35rem; border-radius: 4px; }
  ul { padding-left: 1.2rem; }
  .lead { font-size: 1.1rem; }
  .muted { color: color-mix(in srgb, CanvasText 70%, Canvas 30%); }
  .outro { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, CanvasText 20%, Canvas 80%); }
</style>
</head>
<body>
<main>
<h1>${esc(c.title)}</h1>
<p class="lead">${esc(l.resumo)}</p>

<h2>${t.perguntas}</h2>
<ul>
  ${l.exemplos.map((e) => `<li>${esc(e)}</li>`).join("\n  ")}
</ul>

<h2>${t.comoUsar}</h2>
<p>${uso}</p>
<ul>
  ${l.destaques.map((d) => `<li>${esc(d)}</li>`).join("\n  ")}
</ul>

<h2>${t.endpoints}</h2>
<ul>
  <li><code>${esc(c.mcpRoute)}</code> — endpoint MCP (Streamable HTTP)</li>
  <li><code>/health</code> — liveness</li>
  <li><code>/status</code> — ${l.lang === "pt-BR" ? "versão e build corrente" : "version and current build"}</li>
  </ul>

<h2>${t.links}</h2>
<ul>
  ${listaLinks}
</ul>

${contato}

<section class="outro" lang="${l.emOutroIdioma.lang}">
<h2>${t.tambem}</h2>
<p>${esc(l.emOutroIdioma.resumo)}</p>
<ul>
  ${l.emOutroIdioma.exemplos.map((e) => `<li>${esc(e)}</li>`).join("\n  ")}
</ul>
</section>
</main>
</body>
</html>`;
}

export function landingResponse(): Response {
  return new Response(landingHtml(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
