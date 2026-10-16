# Plano de homologação e publicação da próxima versão do CensoSenso

**Registro:** 16/10/2026. **Situação:** planejamento — nenhuma tag ou GitHub Release criada por este documento.  
**Ambiente:** código GitHub público, Worker Cloudflare `censosenso-mcp`, https://censosenso.poderdapalavra.org/mcp.

## 1. Estado de partida e integridade da evidência

- Último conjunto de dependências consolidado via PRs #29, #26, #27, #30, #23, #24 e #28. A PR #31 atualizou a documentação do Cloudflare, não o runtime.
- Pacote público continua em **0.7.0**, conforme `package.json`. A política em [VERSIONAMENTO.md](VERSIONAMENTO.md) orienta incrementos `0.x.y` para correções e melhorias compatíveis. **Versão 0.7.1 é candidata**, não versão publicada.
- `CHANGELOG.md` inclui 0.7.0 e ainda não documenta a candidata.
- GitHub sem GitHub Releases na auditoria; o Worker já estava implantado em Cloudflare. Não assumir relação 1:1 entre SHA da `main` e deployment atual sem verificar dados de build e versão servida.
- CI e smoke da `main` em commit `0ecb75fccccfc05d16f8776d77b22a13b142a736` estavam aprovados antes da integração documental #31. Validar o novo SHA após ela.

## 2. Portões obrigatórios antes de criar a release

| Portão | Condição mensurável | Comprovação |
|---|---|---|
| G1 — inventário | Nenhuma PR pendente relevante; issues e mudanças classificadas | URL de PRs, HEAD, histórico do Git |
| G2 — segurança | `npm audit` revisado, bloqueios críticos/altos tratados ou formalmente justificados; segredos não expostos | relatórios e decisões sem segredos |
| G3 — governança | Corrigir homepage e número de ferramentas na descrição administrativa; estabelecer proteção da `main` | leitura posterior da API GitHub/rulesets |
| G4 — pacote | `package.json`, `package-lock.json`, `server.json`, `lhm.plugin.json`, `docs/reproducibility.json`, baseline e changelog sincronizados | `npm run check:version-sync` e diff |
| G5 — qualidade | `npm run gate:deploy`; smoke Wrangler HTTP local incluindo concorrência; checagem de Host/Origin | logs GitHub Actions e comandos |
| G6 — serviço publicado | Cloudflare versão/deployment e commit associados, endpoint saudável, 24 ferramentas, contrato provenance 1.1, `tools/call` real | logs e metadados Cloudflare + smoke |
| G7 — publicação | Tag, GitHub Release, notas, rollback e documentação coerentes, sem duplicar publicação | URLs públicas verificadas |

**Regra:** nenhum portão pode ser marcado como aprovado com base em presunção, configuração histórica ou teste do código que não está implantado.

## 3. Procedimento reproduzível

```bash
git clone https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp.git
cd hilaliskandar-censosenso-mcp
npm ci
npm run gate:deploy
npm --prefix worker run test:http-e2e
npm --prefix worker run test:security-http
node scripts/smoke-mcp.mjs https://censosenso.poderdapalavra.org
```

O último comando verifica a **produção efetiva**, não o código local. Associar o resultado à versão que o Worker informa no momento da consulta. Registrar data/hora, HEAD, deployment id, versão ativa e resultados de cada etapa.

## 4. Governança e proteção da `main`

A issue [#19](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/19) contém a lista auditada de ajustes. Corrigir nas **configurações administrativas** do repositório, não somente nos arquivos versionados:

1. Homepage: `https://censosenso.poderdapalavra.org`.
2. Descrição: 24 ferramentas, com procedência e Cloudflare Workers.
3. Ruleset para `main`: pull request obrigatória, check `gate`/CI obrigatório com nome atual exato do workflow, sem force push nem exclusão. Definir exceções e aprovações conforme a política do mantenedor; evitar bloquear o responsável único sem procedimento de recuperação.
4. Política de vulnerabilidades, permissões de Actions e Dependabot: conferir `SECURITY.md`, `CONTRIBUTING.md`, CODEOWNERS e workflows, que já existem.

A alteração de regras administrativas não está disponível nas atuais ações de escrita da integração GitHub. Registrar resultado como **pendente de execução e posterior verificação**, não como configuração concluída.

## 5. Lançamento e rollback

Somente depois de G1–G6 completos: criar branch de release, preparar incremento de versão e metadados, revisar changelog, gerar baseline coerente e executar testes. Associar a implantação à versão e ao SHA. Fazer smoke depois do deployment; criar tag imutável e GitHub Release com notas, fontes, limitações e instruções de rollback. Preservar deployment anterior identificável no Cloudflare para recuperação rápida.

Evitar fixar a tag `v0.7.1` antecipadamente. Se a revisão revelar mudanças incompatíveis, reclassificar a versão segundo [VERSIONAMENTO.md](VERSIONAMENTO.md).

## 6. Fontes de verificação

- [Relatório técnico consolidado](RELATORIO_INTEGRACAO_VALIDACAO_2026-10-16.md)
- [Plano mestre](PLANO_MESTRE_PENDENCIAS_2026-10-16.md)
- [Checklist normativo](RELEASE_CHECKLIST.md)
- [Operação Cloudflare](deploy-cloudflare-workers.md)
- [Issue #19](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/19)

**Procedimento de continuidade:** atualizar este plano, o relatório mestre no Drive e a issue #19 sempre que um portão mudar de estado, com URL, commit e data.
