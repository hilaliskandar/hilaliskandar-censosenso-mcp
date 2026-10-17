# Registro de lançamento — CensoSenso MCP 0.7.1

**Estado:** publicada em 17/10/2026. GitHub Release: https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/releases/tag/v0.7.1. Tag aponta ao commit `65fed02a4239efd319fe6ee67e7bcbfb9e302a44`.

## Escopo de manutenção desde 0.7.0

- Atualização das bibliotecas de runtime do MCP e do contrato de proveniência concisa para **v1.1**, com campo `retrieval` e validação pelo esquema oficial.
- Correção e ampliação dos testes da superfície MCP, incluindo restrições dos schemas de `search/fetch` e chamadas reais HTTP sequenciais e concorrentes no Wrangler.
- Atualização das dependências do Worker (`agents`, Vite, Wrangler e tipos Cloudflare) e das dependências de desenvolvimento da raiz.
- Correção do teste remoto de produção para o contrato de proveniência v1.1.
- Rastreabilidade de implantação: `source_commit` no `GET /status` quando injetado pelo comando oficial de deploy; validação prévia do SHA no checkout.
- Revisão das instruções de operação, homologação, segurança e governança; atualização da descrição e homepage GitHub, proteção de `main` com check `gate`.

## Evidências já coletadas

- Código de rastreabilidade da PR #33 integrado à `main`, commit `3c4a0e53228a9d7ce0ba5b615b104bc34ee0bd2e`; CI e smoke pós-merge aprovados.
- Em 16/10/2026, a rota pública `/status` indicava `version=0.7.0`, `source_commit=3c4a0e53228a9d7ce0ba5b615b104bc34ee0bd2e`, `deploy.id=c29a280d-bf0a-4600-bbbe-ae73863126f1`. Esses valores foram confrontados com a API Cloudflare.
- PR #34 integrou a documentação de homologação, commit `6bac18c456f63c6153078ff82d2b139b01ab8242`; CI e smoke do novo SHA devem ser verificados antes de considerar a etapa fechada.

## Evidências e verificação pós-lançamento

- [x] Verificar CI e production smoke pós-PR #34, registrando URLs e resultados.
- [x] Conferir se os critérios da [issue #19](https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/issues/19) foram atendidos, inclusive riscos residuais.
- [x] Aplicar o incremento 0.7.0 → 0.7.1 em `package.json`/`package-lock.json` e espelhos controlados por `scripts/sync-version.mjs`; criar baseline correspondente, quando aplicável.
- [x] Atualizar `CHANGELOG.md` com data efetiva de lançamento e conferir metadados de distribuição.
- [x] Executar `npm run check:version-sync`, `npm run gate:deploy`, `npm --prefix worker run test:http-e2e` e testes de segurança pertinentes.
- [x] Verificar qual commit o pipeline de Workers Builds realmente empacota e confirmar `source_commit` em `/status` **depois** de implantar a candidata.
- [x] Conferir versão, 24 ferramentas, 5 recursos, 2 prompts, proveniência v1.1 e rotas `/health`, `/status` e `/mcp`.
- [x] Preparar rollback para versão Cloudflare anterior, registrar seu identificador e o plano de restauração.
- [x] Tag `v0.7.1`, GitHub Release e notas definitivas publicadas.

## Ressalvas

Esta versão, conforme política de versionamento, reúne ajustes e melhorias de uma superfície funcional existente; não anuncia ferramentas novas. A versão 0.7.1 foi confirmada em produção pela rota `/status`, com `source_commit` correspondente à tag publicada. Quaisquer mudanças futuras de escopo devem ser avaliadas antes de confirmar a classificação do lançamento.

**Referências:** [plano de homologação](PLANO_HOMOLOGACAO_RELEASE_0_7_X.md), [relatório técnico](RELATORIO_INTEGRACAO_VALIDACAO_2026-10-16.md), [checklist](RELEASE_CHECKLIST.md).


## Identificação verificada em produção

- CI: https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/39058177877 (sucesso).
- Production smoke: https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp/actions/runs/39058177810 (sucesso).
- `/status`: `version=0.7.1`, `source_commit=65fed02a4239efd319fe6ee67e7bcbfb9e302a44`, `deploy.id=6a7eb51b-de54-4dbe-a700-54feaa93b34c`.
- Cloudflare deployment: `12334dd7-e49f-466b-b1a7-d67a74d250cf`, com 100% do tráfego na verificação.

Este registro documenta as evidências de lançamento; novas verificações funcionais devem ser anexadas com seus resultados próprios.
