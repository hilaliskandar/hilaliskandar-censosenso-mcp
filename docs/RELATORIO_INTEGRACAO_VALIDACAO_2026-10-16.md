# Relatório de integração, validação e implantação — 16/10/2026

**Projeto:** CensoSenso MCP · **Repositório público:** https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp  
**Produção:** https://censosenso.poderdapalavra.org/mcp · **Plataforma:** Cloudflare Workers  
**Data-base:** 16/10/2026 · **Natureza:** inventário técnico de execução, não certificado de release.

> **Regra de interpretação:** este arquivo registra evidências observadas em 16/10/2026. Atualizações futuras exigem novas consultas a GitHub Actions, ao HEAD da `main`, às PRs e aos deployments do Cloudflare. **Merge de código não equivale a deploy.** Teste de produção sobre o Worker publicado não demonstra que o último commit esteja implantado.

## 1. Sumário executivo

A migração do contrato de proveniência para **v1.1** foi consolidada na `main`, junto da atualização do SDK MCP e das bibliotecas de runtime. O Worker continua hospedado no Cloudflare, com domínio próprio e transporte MCP Streamable HTTP. A integração foi acompanhada de uma prova HTTP real, com chamadas sequenciais e concorrentes, incluída na integração contínua.

A sequência revisada de dependências foi: primeiro o pacote de runtime e o ajuste do esquema (`#29`); depois `agents` 0.28.0 (`#26`), tipos Cloudflare (`#27`), correção do teste remoto de proveniência (`#30`), Vite (`#23`) e Wrangler (`#24`). As PRs `#25` e `#22` foram fechadas sem merge por redundância. **PR #28 continua pendente**, sujeita à revalidação contra a `main` mais recente.

## 2. Linha do tempo verificável

| PR | Modificação | Resultado | Commit `main` | Evidência |
|---|---|---|---|---|
| #29 | Contrato concise v1.1, runtime, testes e smoke HTTP local | **Integrada** | `25b66838ffc85ff5147ec460dceee6287f6d6c18` | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38903357669 |
| #25 | Atualização de runtime absorvida pela #29 | **Fechada, redundante** | — | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/25 |
| #26 | Worker `agents` 0.24.0 → 0.28.0 | **Integrada** | `925fd4c37ea4f3baeec2f9b8af0e0cb6def8e753` | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38907369583 |
| #22 | `agents` 0.26.0, superada pela #26 | **Fechada, redundante** | — | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/22 |
| #27 | `@cloudflare/workers-types` | **Integrada** | `20a85d1310ae2a66d109babc47695fcca49637c7` | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/27 |
| #30 | Corrigir smoke remoto para `retrieval` no bloco concise v1.1 | **Integrada** | `67e7ed39a04b689f04ba89665ad023e9c4ae06e4` | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38912094552 |
| #23 | Worker Vite 8.3.2 → 8.3.4 | **Integrada** | `07c3e7dda53934c2efe937bf0d022bd9516228e7` | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38920124003 |
| #24 | Worker Wrangler 4.147.0 → 4.149.0 | **Integrada** | `0e4c878dbda2af9aa1f505f8da779beb162c7741` | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/24 |
| #28 | Grupo de sete dependências de desenvolvimento | **Aberta, não integrada** | — | https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/28 |

**Situação do último commit de código verificado:** `0e4c878dbda2af9aa1f505f8da779beb162c7741`, referente à PR #24. No momento da consulta, o **Production smoke pós-merge estava aprovado** (run [38921060080](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38921060080)); o **CI completo ainda estava em execução** (run [38921060207](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38921060207)). A confirmação posterior exige verificar a conclusão do run.

## 3. Contrato de proveniência v1.1

- A projeção concise do `structuredContent.provenance` anuncia sete chaves, nesta ordem observada: `source`, `source_url`, `data_vintage`, `retrieved_at`, `retrieval`, `citation`, `license`.
- `src/provenance.ts` usa `ConciseBlockSchema` fornecido pela biblioteca, eliminando a divergência do esquema mantido manualmente.
- `tests/provenance.test.ts` valida o contrato, inclusive o campo `retrieval`; `tests/m6-security-surface.test.ts` exige `additionalProperties: false` também para `search` e `fetch`.
- A saída preserva três canais: `content` com rodapé, `structuredContent` com proveniência e atribuição, e espelho de `_meta`.
- `scripts/smoke-mcp.mjs` foi corrigido na PR #30: a falha anterior do smoke (run 38908452016) era uma **asserção obsoleta**, não uma indisponibilidade constatada do serviço.
- Atenção: versões futuras da biblioteca podem modificar campos ou ordens; os testes de contrato devem ser confrontados com os schemas efetivamente publicados pelo SDK.

## 4. Worker e ciclo de vida MCP HTTP

- Código de entrada: `worker/src/index.ts`; fábrica MCP: `worker/src/server.ts`.
- O Worker cria o handler por requisição com `createMcpHandler(() => buildServer(...))`, em vez de reutilizar uma instância de transporte stateless.
- O smoke HTTP `worker/scripts/m3-http-e2e-local.mjs` inicia o Wrangler, testa `/health`, `initialize`, notificação de inicialização e `tools/list`, depois repete `tools/list` sequencialmente e em três requisições concorrentes.
- A etapa `npm --prefix worker run test:http-e2e` faz parte de `.github/workflows/ci.yml`, após `npm run gate:deploy`.
- A superfície monitorada possui **24 ferramentas**, além de recursos e prompts; `worker/tests/server.test.ts` espera 24 tools, cinco resources e dois prompts.
- `agents` 0.28.0 declara metadados de peer dependency do SDK MCP 2.0.0, enquanto o projeto passou a usar SDK 2.3.1; a instalação preserva a política local `legacy-peer-deps`. Tratar este ponto como risco de compatibilidade a ser reavaliado em upgrades futuros, não como falha atual comprovada.

## 5. Portões mínimos para integrações subsequentes

1. **Inventário e escopo**: consultar HEAD da `main`, árvore de dependências, diffs da PR e conflitos atuais.
2. **Build estático**: `npm ci`, verificação de versões, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.
3. **Regressões**: `npm test`, `npm run test:coverage`, `npm --prefix worker ci`, `npm --prefix worker run typecheck`, `npm --prefix worker test`. A agregação está em `npm run gate:deploy`.
4. **Transporte HTTP real**: `npm --prefix worker run test:http-e2e`, que inicia Wrangler e cobre chamadas consecutivas e simultâneas.
5. **Produção**: consultar o workflow `Production smoke` e seus logs em cada novo SHA. Smoke verifica o deployment atual; não implica que o código recém-integrado esteja no Cloudflare.
6. **Integração**: preferir squash, conferir SHA esperado da PR, revalidar a `main` pós-merge e registrar URL do run.
7. **Implantação**: somente em etapa explicitamente controlada; confirmar o deployment na API do Cloudflare, a versão servida, o domínio, as 24 tools e a observabilidade.
8. **Release**: alinhar `package.json`, lockfile, metadados de repositório, changelog, tag, GitHub Release e documentação de operação.

Comandos reproduzíveis na raiz:
```bash
npm ci
npm run gate:deploy
npm --prefix worker run test:http-e2e
npm --prefix worker run test:security-http
node scripts/smoke-mcp.mjs https://censosenso.poderdapalavra.org
```
Os testes que precisam de Worker local ou dependem do ambiente devem ser executados com suas pré-condições documentadas; êxito do CI padrão **não prova** execução de testes opcionais não incluídos no workflow.

## 6. Cloudflare: operação, publicação e distinção entre ambientes

A configuração `worker/wrangler.jsonc` define o script `censosenso-mcp`, `workers_dev: false`, domínio personalizado `censosenso.poderdapalavra.org`, compatibilidade Node.js e Durable Object `UsageTracker`. A fonte de verdade para saber o código realmente implantado é o **histórico de deployments e versões do Worker na API Cloudflare**, não apenas o HEAD do GitHub.

Em consulta anterior deste ciclo, o script estava implantado no Cloudflare, com último deployment então observado em **16/10/2026 09h31, horário de Brasília**, por Wrangler, e versão do deployment servindo 100% do tráfego. Esses dados são **fotografia histórica**, não confirmação da correspondência com o HEAD atual. Nenhum deployment manual foi efetuado durante as integrações #29, #26, #27, #30, #23 e #24 nesta rotina.

Pontos de operação: `/health`, `/status`, `/mcp`, cartão de servidor, headers MCP, autenticação opcional e rotas privadas de uso/telemetria. Nunca publicar segredos ou imprimir credenciais na documentação. Para implantação e rollback detalhados, consultar [deploy-cloudflare-workers.md](deploy-cloudflare-workers.md).

## 7. Pendências priorizadas

| Prioridade | Frente | Próxima condição |
|---|---|---|
| P0 | CI pós-merge da PR #24 | Confirmar conclusão de run 38921060207; investigar falhas antes de novo merge |
| P1 | PR #28 | Verificar sobreposição com dependências já atualizadas, diferenças no lockfile, conflitos e CI; integrar somente após gates |
| P1 | Governança e release — issue #19 | Revisar homepage incorreta no GitHub, descrição de ferramentas, branch protection/rulesets, segurança e documentação |
| P1 | Proveniência — issue #20 | Conferir critérios de aceite e encerrar apenas com evidências do contrato v1.1 completo |
| P1 | Publicação controlada | Decidir versão, preparar release, executar deploy autorizadamente, validar Cloudflare e rollback |
| P2 | Piloto do laboratório privado #70 | Homologação com usuários e dados reais, métricas, registro de defeitos e feedback |
| P3 | WFS externo — laboratório #24 | Acompanhar erro 403 upstream sem bloquear snapshots já operacionais |

## 8. Roteiro de retomada em novo chat

1. Ler este relatório, o [plano mestre](PLANO_MESTRE_PENDENCIAS_2026-10-16.md) e o [checklist de release](RELEASE_CHECKLIST.md).
2. Reconsultar GitHub `main`, open PRs, issues #19/#20, status exato dos Actions e GitHub Releases; jamais tomar esta fotografia como situação corrente.
3. Revisar no Drive o `PLANO_MESTRE_PENDENCIAS — CensoSenso MCP — 2026-10-16`, além de `00_LEIA_PRIMEIRO`, `INVENTARIO_MESTRE`, `DIARIO_TECNICO` e `MEMORIA_MESTRE`.
4. Não fundir PRs redundantes nem fazer deploy implícito. Após cada ação, gravar SHA/PR, teste, resultado, link, pendência e próxima ação em GitHub e Drive.
5. Em caso de divergência entre documentos, prevalece evidência atual de GitHub/Cloudflare; indicar a divergência e corrigi-la com rastreabilidade.

## 9. Referências principais

- [PR #29 — proveniência e runtime](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/29)
- [PR #30 — smoke de proveniência](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/30)
- [PR #28 — dependências de desenvolvimento](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/28)
- [Issue #19 — governança/release](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/19)
- [Issue #20 — contrato de proveniência](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/20)
- [CI PR #29 aprovado](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38903357669)
- [CI PR #30 aprovado](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38908901979)
- [Smoke PR #30 pós-merge aprovado](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38912094552)
- [CI após Vite aprovado](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38920124003)
- [Smoke após Vite aprovado](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38920123998)
- [CI após Wrangler](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38921060207)
- [Smoke após Wrangler aprovado](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38921060080)

**Responsabilidade editorial:** documentar fatos observados, separar avaliações de evidências, nunca pressupor aprovação ou implantação.

## 10. Adendo de verificações posteriores

- **CI da PR #24 na `main` concluído com sucesso**: run https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38921060207. O smoke remoto correspondente também foi aprovado, conforme registro acima.
- **PR #28 — sobreposição específica identificada:** além de seis outras dependências de desenvolvimento, altera **Vite na raiz** de 8.3.2 para 8.3.4. A PR #23 já alterou **Vite no Worker**, que possui manifest e lockfile próprios. Portanto, há duas instalações diferentes e não se deve fechar #28 apenas por aparente duplicação do nome `vite`. A verificação da PR deve observar o lockfile da raiz, a compatibilidade com o SDK MCP e o CI da base atual.
- O presente relatório é documentação operacional; a criação dos arquivos de documentação gera novos commits na `main` e novas execuções de CI. Não presumir que seus resultados sejam idênticos aos do commit anterior do Worker.
