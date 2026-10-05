# CensoSenso MCP — Cloudflare Worker

Este diretório contém o transporte **Streamable HTTP** de produção do CensoSenso e reutiliza a mesma superfície lógica do transporte STDIO por meio de `registerAll`.

## Estado atual

Worker em produção:

```text
censosenso-mcp
```

Endpoint MCP:

```text
https://censosenso.poderdapalavra.org/mcp
```

Rotas:

- `/` — landing;
- `/mcp` — MCP Streamable HTTP;
- `/health` — liveness;
- `/status` — versão e metadata do deploy;
- `/metrics` — estatísticas agregadas, privadas por padrão; exige `METRICS_API_KEY` e Bearer correspondente;
- `/icon.png` — ícone servido pelo Worker;
- `/.well-known/mcp/server-card.json` — server card;
- `/robots.txt` e `/sitemap.xml` — descoberta pública.

## Desenvolvimento local

Da raiz:

```bash
npm ci
npm run build
```

Depois:

```bash
cd worker
npm ci
npm run typecheck
npm test
npm run dev
```

Endpoint local padrão:

```text
http://localhost:8787/mcp
```

## Deploy

O caminho preferencial é automático:

```text
GitHub main
  → Cloudflare Workers Builds
  → npm run gate:deploy
  → npm --prefix worker run deploy
  → wrangler deploy
```

Deploy manual, quando necessário:

```bash
cd worker
npm ci
npm run deploy
```

O lifecycle `predeploy` recompila e testa a raiz e o Worker.

## Bindings atuais

Declarados no `wrangler.jsonc`:

- `USAGE` — Durable Object `UsageTracker`;
- `CF_VERSION_METADATA` — metadata da versão publicada;
- `ALLOWED_ORIGIN="*"`;
- observabilidade do Worker.

O binding opcional `ANALYTICS` foi retirado do primeiro deploy porque Analytics Engine não estava habilitado na conta. O código continua tolerando sua ausência.

## Sessão MCP

O Worker emite `mcp-session-id` no `initialize`. O handler permanece stateless no modo atual; o id é usado para correlacionar mensagens do handshake/telemetria, não como armazenamento de sessão do usuário.

## Segurança

- tools read-only;
- validação de Host/Origin pelo handler MCP;
- CORS explícito;
- rate limit por cliente;
- Bearer opcional do endpoint MCP via `API_KEY`;
- `/metrics` privado por padrão: sem `METRICS_API_KEY` responde 404; com o secret, exige `Authorization: Bearer <METRICS_API_KEY>`;
- OAuth ainda não habilitado.

Para habilitar acesso operacional às métricas:

```bash
cd worker
npx wrangler secret put METRICS_API_KEY
```

O secret de métricas é deliberadamente independente de `API_KEY`: o MCP pode continuar público enquanto a telemetria operacional permanece privada.

## Smoke

```bash
node scripts/smoke-mcp.mjs https://censosenso.poderdapalavra.org
```

O roteiro cobre `initialize`, superfície, procedência, estatística, `search`/`fetch` e chamadas reais.

## Documentação relacionada

- [Arquitetura, fluxos e reprodução](../docs/ARQUITETURA_FLUXOS_E_REPRODUTIBILIDADE.md)
- [Deploy Cloudflare Workers](../docs/deploy-cloudflare-workers.md)
- [Origem, módulos e contribuições](../docs/ORIGEM_MODULOS_E_CONTRIBUICOES.md)
