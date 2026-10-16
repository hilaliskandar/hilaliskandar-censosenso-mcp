# Plano mestre de correções, homologação e continuidade — CensoSenso MCP
**Data de corte:** 16/10/2026 (America/Sao_Paulo)  
**Escopo:** repositório público `hilaliskandar/hilaliskandar-censosenso-mcp` e laboratório privado `hilaliskandar/ibge-br-mcp-lab`.  
**Natureza:** inventário auditável de pendências; não constitui evidência de suíte executada em 16/10.

## 1. Estado verificado
- `main` público no commit `583901242368690e3646ba855571cee2d71fc129` (07/10/2026), `package.json.version=0.7.0`, `@sbissoli/mcp-provenance=^0.1.0`.
- O repositório público tem **sete PRs abertas** (#22–#28), **duas issues abertas** (#19 e #20), **nenhuma GitHub Release**, `main` sem branch protection e nenhum ruleset, lista de topics vazia.
- Metadados do repositório: homepage incorreta `censocenso.poderdapalavra.org` e descrição com **23 ferramentas**; `package.json.homepage` já aponta corretamente para `https://censosenso.poderdapalavra.org`.
- Laboratório privado: issues #70 (abertura controlada do protótipo) e #24 (monitor WFS), ambas registradas como abertas. Evidência histórica indica validação dos 645 municípios de SP, CI/smoke do protótipo 0.6.0 e proteção de `/metrics`; revalidar contra a implantação vigente antes de anunciar a versão 0.7.x como homologada.
- **Separar estados:** código presente ≠ teste aprovado ≠ deploy atualizado ≠ release publicada.

## 2. Matriz priorizada
| Ordem | Prioridade | ID | Tarefa | Dependências | Critério de aceite | Evidência obrigatória |
|---|---|---|---|---|---|---|
| 01 | P0 | #20 | Migrar contrato `@sbissoli/mcp-provenance` v1.0→v1.1, adaptar schemas, projeções e testes; impedir propriedades adicionais inesperadas | branch de correção e lockfile | 24 ferramentas com schemas válidos; `search/fetch` compatíveis; testes sem falhas | commit, logs de CI, matriz contrato antigo/novo |
| 02 | P0 | PR #25 | Auditar atualização do grupo runtime (SDK, proveniência etc.) e só integrar após #20 | item 01 | typecheck, lint, build, teste completo, smoke HTTP/STDIO; ausência de breaking change não documentada | relatórios dos gates e SHA de merge |
| 03 | P1 | PR #26/#22 | Reconciliar versões de `agents` 0.28.0 x 0.26.0; evitar merge regressivo | análise de impacto Worker | um só alvo homologado, testes Worker e smoke remoto aprovados | lockfile, CI e decisão registrada |
| 04 | P1 | PR #23/#24/#27 | Atualizar Vite, Wrangler e Workers Types conjuntamente ou por lotes sem conflitos | item 03 | Worker build, testes e deploy dry-run/smoke aprovados | SHA e workflow |
| 05 | P1 | PR #28 | Revisar sete atualizações de dev tooling | gates base | suite, formatação e segurança sem regressão | logs CI |
| 06 | P1 | #19 | Corrigir homepage do GitHub, descrição para 24 ferramentas e topics; conferir reportar vulnerabilidade privadamente; aplicar ruleset da `main` exigindo CI/revisão adequada | CI estável | metadados corrigidos, ruleset ativo | leitura API GitHub posterior |
| 07 | P1 | #19 | Homologar versão de release: `main` está em 0.7.0 e issue #19 propõe 0.7.1; conferir changelog, pacote, tags, manifesto, `/status` e deploy antes da tag | itens 01–06 | tag coerente, release publicada, notas e link de evidências; não anunciar npm inexistente | tag SHA, release URL, smoke |
| 08 | P2 | lab #70 | Abrir grupo externo controlado, executar período inicial de observação, registrar falhas, latência, rate limit e disponibilidade; só então ampliar divulgação | release e segurança | relatório de operação sem incidentes P0/P1 pendentes | relatório com janela, métricas e decisões |
| 09 | P3 | lab #24 | Monitorar WFS Geosserviços (historicamente 403 Cloudflare) sem colocá-lo no caminho crítico; snapshots/GeoFTP mantidos | nenhuma bloqueante | diagnóstico atualizado; eventual recuperação testada por camada | logs HTTP, contrato por tema |
| 10 | P2 | documentação | Reconciliar memória, inventário, diário e plano no Drive; registrar cada merge/release e mudança de escopo | contínuo | documentação convergente com GitHub e produção | links e data de revisão |

## 3. Sequência operacional e gates
**G0 — Congelamento de referência:** registrar `git rev-parse HEAD`, branch, status, versão, SHA do Worker, endpoint canônico e outputs de `/status`. Não misturar laboratório privado e árvore pública.  
**G1 — Contrato:** construir testes de migração para propriedades novas do provenance v1.1, `contract_version`, projeção concise e `outputSchema`; testar erros e valores ausentes; validar 24 tools.  
**G2 — Qualidade:** `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` e testes do Worker; documentar eventuais skips condicionados à rede. Não converter skip em aprovação.  
**G3 — Integração:** merges em ordem de dependência, cada um com testes e SHA, sem merges conflitantes de `agents`.  
**G4 — Segurança e operação:** verificação de metadados GitHub, ruleset, dependências, segredos, rate limiting, proteção de `/metrics`, endpoint `/mcp`, contrato `search/fetch` e CORS/autenticação conforme o modelo de acesso aprovado. OAuth e npm permanecem decisões distintas, não pressupostos.  
**G5 — Release:** tag aponta para SHA aprovado; versão concorda entre package, servidor e `/status`; changelog, release notes e documentação refletem superfície real.  
**G6 — Janela externa:** acompanhamento com critérios de rollback, incidentes e decisão formal de ampliar acesso.

## 4. Matriz de evidências e estados
Em cada frente manter: `ID | título | prioridade | estado [não iniciado/em execução/bloqueado/validado/integrado/publicado] | branch | commit | PR/issue | gate | resultado | fonte/URL | data UTC | responsável | próxima ação`. Um item só se torna **concluído** com prova do gate e fechamento documental. Ausência de execução em 16/10 significa **não revalidado**, não falha.

## 5. Riscos
- **Alto:** atualizar provenance sem migrar schemas; fusão de PRs que mudam o mesmo pacote; tag de 0.7.1 sobre código ainda identificado como 0.7.0.
- **Médio:** `main` pública sem proteção; homepage incorreta; ferramentas anunciadas em número errado; divulgar endpoint antes de observabilidade e teste de clientes externos.
- **Controlado:** WFS 403 permanece externo e não deve impedir o runtime de snapshots.
- **Governança:** não importar histórico do laboratório privado para o público; manter crédito e licença do upstream; preservar nenhuma informação secreta nos documentos.

## 6. Reprodução em qualquer chat
1. Ler este arquivo na `main` pública: `docs/PLANO_MESTRE_PENDENCIAS_2026-10-16.md`.
2. Abrir issues públicas #19 e #20; listar PRs abertas; verificar branch `main`, SHA, releases e regras atuais via GitHub; consultar laboratório #70 e #24 quando autorizado.
3. Abrir o documento homônimo no Google Drive e consultar `MEMORIA_MESTRE`, `INVENTARIO_MESTRE`, `DIARIO_TECNICO` e `00_LEIA_PRIMEIRO`; confrontar versões.
4. Reexecutar gates apenas conforme necessidade. Nunca assumir que estado registrado em 16/10 continua válido.
5. Ao finalizar tarefa, gravar **resultado, SHA, URL de CI, decisão, data e próxima ação** em GitHub e Drive no mesmo ciclo.
6. Não afirmar deploy, merge, tag, fechamento de issue ou validação sem resposta verificável das ferramentas.

## 7. Links canônicos
- Público: https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp
- Endpoint: https://censosenso.poderdapalavra.org/mcp
- Domínio do projeto: https://censosenso.poderdapalavra.org
- Proveniência: https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/20
- Governança: https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/19
- Lançamento no laboratório: https://github.com/hilaliskandar/ibge-br-mcp-lab/issues/70
- WFS no laboratório: https://github.com/hilaliskandar/ibge-br-mcp-lab/issues/24

**Revisão:** 16/10/2026. Documento operacional, sujeito a atualização por evidência; não substitui logs e testes.

## Atualização de execução — 16/10/2026

- PR #29 **integrada** à `main` via squash no commit `25b66838ffc85ff5147ec460dceee6287f6d6c18`, após gate completo e prova HTTP do Wrangler com requisições sequenciais e concorrentes: https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/pull/29.
- PR #25 **fechada por redundância**, pois seus bumps de runtime fazem parte da PR #29 integrada.
- Production smoke pós-merge **aprovado**: https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38906241858. CI da `main` iniciado em https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38906242114, pendente de resultado no momento deste registro.
- Próximos itens: confirmar CI da `main`, resolver redundância de `agents` entre #22 e #26, avaliar demais PRs, regras da `main` e release #19. Integração de código não significa nova implantação do Worker; nenhum deploy manual foi solicitado ou realizado neste ciclo.

## Consolidação de integrações e referência detalhada — 16/10/2026

**Leitura prioritária:** [Relatório de integração, validação e implantação de 16/10/2026](RELATORIO_INTEGRACAO_VALIDACAO_2026-10-16.md), com matriz de PRs, SHAs, gates, scripts, estado do Cloudflare, riscos e procedimento de retomada.

Após a PR #29: #26 (`agents` 0.28.0; SHA `925fd4c37ea4`), #27 (tipos Cloudflare; SHA `20a85d1310ae`), #30 (smoke de proveniência v1.1; SHA `67e7ed39a04b`), #23 (Vite 8.3.4; SHA `07c3e7dda539`) e #24 (Wrangler 4.149.0; SHA `0e4c878dbda2`) foram integradas à `main`. PRs #22 e #25 fechadas por redundância. PR #28 aberta e pendente de avaliação. O CI e o smoke da PR #23 na `main` foram aprovados; smoke da PR #24 aprovado. CI após PR #24: completed/success na última consulta, run https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/38921060207.

**Distinção operacional:** não houve implantação manual como consequência das integrações; a execução do smoke remoto não comprova que o Worker usa o último SHA do GitHub. Verificação de deployment exige consulta à API Cloudflare.
