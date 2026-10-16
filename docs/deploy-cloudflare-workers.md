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

A documentação operacional histórica informa uma conexão do Workers Builds ao repositório abaixo; **a existência e a configuração ativa dessa conexão devem ser reconfirmadas no painel Cloudflare** antes de atribuir um deployment a um commit específico:

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
- `workers_dev = false` (conforme `worker/wrangler.jsonc` consultado em 16/10/2026);
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

O domínio canônico é `censosenso.poderdapalavra.org`. O hostname `workers.dev` **não está habilitado** na configuração versionada atual. O acesso canônico ocorre pelo domínio próprio. A configuração do domínio próprio deve permanecer sincronizada entre:

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

## Auditoria real de deployments — 16/10/2026

Em consulta direta à API Cloudflare, o Worker `censosenso-mcp` possuía deployments sucessivos atribuídos a `wrangler`. O mais recente na ocasião foi `fd93b14e-38cf-437d-a4b5-483d0031656d`, criado em **16/10/2026 às 15:42:10 UTC (12h42 em Brasília)**, com versão `e776acb4-edbd-49a4-a38c-2e719b125bbb` atendendo **100% do tráfego**. Também foram observados deployments em 15:31:09, 15:21:28 e 15:06:51 UTC do mesmo dia.

**Conclusão operacional:** afirmar que não ocorreu um *deploy manual nesta sessão* é diferente de afirmar que **não houve implantação**. A produção efetivamente teve deployments durante a sequência de merges. A API consultada informa origem `wrangler`, mas esse campo **não permite determinar por si só se a operação foi iniciada por CI/Workers Builds ou por operador autenticado**. Para vincular cada deployment a um SHA do GitHub, consultar o histórico do build, versão/metadata servida, eventos de implantação e logs associados.

**Estado da governança GitHub na auditoria:** `main` sem rulesets registrados; metadados de homepage e descrição incorretos na API administrativa; issue #19 aberta. O `package.json` possui homepage correta, porém isso não atualiza automaticamente os metadados do repositório.

**Gate antes de publicar nova versão:** conferir versão e SHA **efetivamente servidos**, smoke de produção, CI, políticas de rollback e ausência de regressões; somente depois criar tag/GitHub Release conforme checklist. Não confundir ausência de GitHub Release com ausência de Worker implantado.
