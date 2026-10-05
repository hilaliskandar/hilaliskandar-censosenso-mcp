# Deploy do CensoSenso MCP no Cloudflare Workers

## Estado atual

O CensoSenso MCP está publicado por Streamable HTTP em:

`https://censosenso.poderdapalavra.org/mcp`

Rotas operacionais:

- `/health`
- `/status`
- `/mcp`

A primeira homologação remota foi concluída em 03/10/2026.

## Integração GitHub → Cloudflare

Cloudflare Workers Builds está conectado ao repositório:

- GitHub: `hilaliskandar/ibge-br-mcp-lab`
- branch de produção: `main`
- Worker: `censosenso-mcp`
- root directory: `/`
- build command: `npm run gate:deploy`
- deploy command: `npm --prefix worker run deploy`
- previews do Workers Builds: desativados

Um push/merge em `main` dispara a construção e, se o gate passar, o deploy.

## Gate de produção

```bash
npm ci
npm run gate:deploy
```

O gate executa:

1. typecheck;
2. lint;
3. EOL + Prettier;
4. build;
5. testes;
6. cobertura;
7. `npm ci` do Worker;
8. typecheck do Worker;
9. testes do Worker.

## Lifecycle do Worker

O comando de deploy é:

```bash
npm --prefix worker run deploy
```

O lifecycle `predeploy` recompila e testa a raiz e o Worker antes de `wrangler deploy`. Essa redundância é intencional: o deploy manual continua protegido mesmo fora do Workers Builds.

## Configuração Wrangler

Arquivo: `worker/wrangler.jsonc`.

Parâmetros principais:

- `name = censosenso-mcp`;
- `workers_dev = true`;
- `preview_urls = false`;
- `compatibility_date = 2026-10-03`;
- `nodejs_compat`;
- Durable Object `USAGE`;
- `CF_VERSION_METADATA`;
- observabilidade habilitada;
- `ALLOWED_ORIGIN="*"`.

O binding do Analytics Engine foi retirado do primeiro deploy porque o produto não estava habilitado na conta. O código trata esse binding como opcional, portanto a remoção afeta apenas telemetria avançada, não o contrato MCP nem os resultados das ferramentas.

## Smoke remoto

### Health

```bash
curl -i https://censosenso.poderdapalavra.org/health
```

Esperado: HTTP 200 e `ok`.

### Status

```bash
curl -i https://censosenso.poderdapalavra.org/status
```

Esperado: `status=ok`, nome `censosenso-mcp`, versão e metadata do deploy.

### MCP

Validar na ordem:

1. POST `initialize`;
2. capturar `mcp-session-id`;
3. POST `notifications/initialized`;
4. POST `tools/list`;
5. POST `tools/call`.

O smoke de homologação executou `ibge_geocodigo` para Campinas e recebeu `3509502` com procedência oficial.

O script automatizado é:

```bash
node scripts/smoke-mcp.mjs https://censosenso.poderdapalavra.org
```

## Deploy manual

```bash
cd worker
npm ci
npm run deploy
```

É necessário estar autenticado no Wrangler/Cloudflare com permissão para o Worker.

## Domínio próprio

O domínio canônico é `censosenso.poderdapalavra.org`. O hostname `workers.dev` permanece habilitado como fallback operacional durante a transição. A configuração do domínio próprio deve permanecer sincronizada entre:

- `worker/src/config.ts`: `publicBaseUrl` e `extraAllowedHostnames`;
- `server.json`: `remotes[].url`;
- documentação;
- testes de Host/Origin;
- smoke remoto.

## Autenticação

Estado atual:

- acesso público;
- Bearer opcional suportado por `API_KEY`;
- OAuth não habilitado.

A introdução de OAuth deve ser uma mudança separada, com testes de discovery, handshake, headers e clientes compatíveis.

## Rollback

O Cloudflare mantém versões/deployments do Worker. Em incidente:

1. interromper merges em `main`;
2. identificar a última versão saudável;
3. fazer rollback pelo painel/API Cloudflare;
4. reproduzir localmente com o commit correspondente;
5. corrigir em branch;
6. passar `gate:deploy`;
7. fazer novo merge e smoke.

## Fonte de verdade

- código: GitHub `main`;
- configuração Worker: `worker/wrangler.jsonc`;
- endpoint: `worker/src/config.ts` + `server.json`;
- versão: `package.json`;
- build/deploy: Workers Builds;
- documentação arquitetural: `docs/ARQUITETURA_FLUXOS_E_REPRODUTIBILIDADE.md`.


## Métricas operacionais privadas

A rota `/metrics` não é pública. O comportamento padrão é responder 404 enquanto o secret dedicado não existir.

Para habilitar acesso administrativo:

```bash
cd worker
npx wrangler secret put METRICS_API_KEY
```

Consulta:

```bash
curl -H "Authorization: Bearer <METRICS_API_KEY>" \
  https://censosenso.poderdapalavra.org/metrics
```

Não é necessário configurar `API_KEY` para tornar as métricas privadas; os dois contratos são independentes.
