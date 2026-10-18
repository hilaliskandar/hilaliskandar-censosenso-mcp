# Inventário operacional e homologação MCP 0.7.2

**Atualização:** 18/10/2026. **Questão-mestra:** [#48](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/48). **Ambiente:** https://censosenso.poderdapalavra.org/mcp.

## Regra de leitura e continuidade

Este documento separa **versão publicada** (tag imutável), **HEAD da main** (inclui melhorias de testes) e **Worker realmente implantado**. Nunca equiparar os três sem conferir SHA em `/status`, CI e smoke. Resultados de PR não substituem testes pós-merge.

- Release oficial: [v0.7.2](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/releases/tag/v0.7.2), tag no SHA `5a2db4a4e984a2063d5e237b450a4f3e96db33fb`. Não mover tag.
- Último SHA da main com CI e Production smoke **aprovados** na verificação desta atualização: `c4aeae55ded60623aa269656ed140a5ef5a3245a`, PR #50.
- Último Worker consultado em `/status`: `version=0.7.2`, `status=ok`, `source_commit=ae63a3d20721344a695d2a0cbca3e5ec4a26bd28`, deployment `62db1410-48d8-486c-adb9-c7c7f603dae7`. **Defasagem de implantação em relação à main observada**; reconsultar antes de qualquer afirmação de sincronização.
- PR #51 (cabeçalho Content-Type incompatível) em execução de gate na última inspeção; **não integrada**. Não atribuir os resultados deste teste à main.
- Inventário estático: **90 arquivos** de testes `.test.` em `tests/` e `worker/tests/`, além dos E2E HTTP `worker/scripts/m3-http-e2e-local.mjs` e `worker/scripts/m6-host-origin-local.mjs`. Quantidade de arquivos não significa percentual de cobertura dos comportamentos.

## Linha de evidências e alterações

| PR | Efeito | Validação conhecida |
|---|---|---|
| [#39](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/39) | Corrige página SIDRA fora do intervalo, sem repetição de resultados | Gate e reteste em produção |
| [#40](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/40) | Smoke remoto da regressão SIDRA | CI e smoke aprovados |
| [#41](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/41) | Formalização da versão 0.7.2 | Release publicada e deployment confirmado |
| [#42](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/42) | Listas MCP, contagens, cursor inválido | CI pós-merge aprovado |
| [#43](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/43) | Leitura de recursos e obtenção de prompts | CI pós-merge aprovado |
| [#44](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/44) | Erros de recurso, prompt, ferramenta inexistente | CI pós-merge aprovado; cuidado com 429 |
| [#45](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/45) | Cinco catálogos, argumentos e structuredContent | CI pós-merge aprovado |
| [#46](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/46) | Método JSON-RPC inexistente e resposta JSON/SSE | CI pós-merge aprovado |
| [#47](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/47) | Negociação de initialize, versão/capabilities | CI pós-merge aprovado |
| [#49](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/49) | JSON sintaticamente malformado | CI pós-merge aprovado |
| [#50](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/50) | MCP-Protocol-Version e Accept incompatível | CI e smoke pós-merge aprovados |
| [#51](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/51) | Content-Type text/plain rejeitado | **Aguardando gate; não integrado** |

## Matriz de cobertura

| Dimensão | Comprovação | Lacunas ainda abertas |
|---|---|---|
| Handshake HTTP | initialize, initialized, versão 2025-11-25, serverInfo, capabilities, sessão, JSON/SSE | compatibilidade outras versões e combinação de headers |
| Listagens MCP | 24 tools; 5 resources; 2 prompts; cursor inválido -32602 | paginação válida/limites em futuros catálogos dinâmicos |
| Operações | resources/read nos cinco catálogos, prompts/get nos dois prompts, tools/call estado SE | matriz completa de entradas para as 24 tools |
| Erros | método -32601, inexistentes, argumento de tipo errado, JSON truncado | JSON-RPC -32700/-32600, id inválido, lote, notificações impróprias |
| Proveniência | content + structuredContent, attribution e source_url nos cenários testados | checagem por ferramenta, unidade/período, auditoria de dados |
| Segurança | testes unitários de sessão, Host/Origin, rate-limit e E2E local de Origin | DELETE sessão, Content-Type invalido (#51), Retry-After/429, autenticação e CORS adicionais |
| Resiliência | chamadas HTTP consecutivas e simultâneas no Wrangler | carga e latência controladas, timeouts, indisponibilidade upstream |

**Atenção técnica:** o Worker tem token bucket de entrada com burst de 20 solicitações por cliente e reposição de 5 por segundo. A suíte HTTP cresceu além desse burst; inserir reposição *real* entre lotes, distinguir erro do servidor de 429 e nunca enfraquecer a proteção operacional para fazer um teste passar. Testes intensivos apenas isolados/local; em produção, smoke de volume baixo.

## Procedimentos reproduzíveis

```bash
npm ci
npm run gate:deploy
npm --prefix worker run test:http-e2e
npm --prefix worker run test:security-http
node scripts/smoke-mcp.mjs https://censosenso.poderdapalavra.org
```

Registrar para cada execução: cenário, SHA sob teste, URL do Actions run, horário, esperado, observado, resultado **PASS/FAIL/BLOCKED/NOT RUN**, link de issue em falhas, e `/status` em produção. Gate de PR, CI de main, smoke remoto e deployment são etapas independentes.

## Próxima fila, por prioridade

1. Resolver e integrar [PR #51](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/51), apenas se gate verde.
2. Verificar deployment de `c4aeae55...` ou do HEAD mais recente em `/status`; registrar CI e smoke associados.
3. Testes negativos adicionais de JSON-RPC, encerramento HTTP DELETE de sessão e rate limit Retry-After; validar contratos reais antes de fixar status esperados.
4. Levantar matriz `24 ferramentas x entradas válidas/inválidas x fontes IBGE x estruturas e erros` para medir lacunas. Classificar explicitamente não testado.
5. Gerar relatório de conformidade rastreável com testes, resultados e limitações; atualizar este inventário e diário operacional no Google Drive.

## Fontes e manutenção

- [Issue #48](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/48) — checklist da homologação extensa.
- [Histórico de CI](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions) e [GitHub Releases](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/releases).
- [Plano anterior de homologação e lançamento](PLANO_HOMOLOGACAO_RELEASE_0_7_X.md) — documento histórico de **16/10/2026**, com informações sobre versão candidata que **não representam o estado atual**.
- Diário operacional Google Drive: https://docs.google.com/document/d/1nIKXuv4yE29Pb0hmqvFmTb0wHiDX1D9UrTAqBIN-FLA/edit.

**Critério de encerramento:** testes obrigatórios executados ou justificados, falhas críticas/altas resolvidas, main validada, deployment comprovado e relatórios arquivados. Não confundir teste de conformidade abrangente com prova absoluta de todas as entradas possíveis.
