# Checklist de release do CensoSenso

Este checklist é normativo para releases públicos.

## 1. Classificação da versão

- [ ] A mudança foi classificada segundo [VERSIONAMENTO.md](VERSIONAMENTO.md).
- [ ] Nova funcionalidade relevante usa `0.x.0`.
- [ ] Correção/melhoria de função existente usa `0.x.y`.
- [ ] `0.9.x` é usado somente na fase beta.
- [ ] `1.0.0` é reservado ao primeiro lançamento estável.

## 2. Sincronização

- [ ] `package.json` contém a versão pretendida.
- [ ] `package-lock.json` está sincronizado.
- [ ] `server.json` está sincronizado.
- [ ] `lhm.plugin.json` está sincronizado.
- [ ] `docs/reproducibility.json` está sincronizado.
- [ ] Existe `baselines/surface-stdio-<versão>.json`.
- [ ] `npm run check:version-sync` passa.

## 3. Contrato MCP

- [ ] `tools/list` corresponde à superfície esperada.
- [ ] Schemas novos/alterados são estritos.
- [ ] `outputSchema` é compatível com o payload serializado.
- [ ] Mudanças de tools/resources/prompts estão descritas no CHANGELOG.
- [ ] Baseline novo foi inspecionado e a diferença é deliberada.

## 4. Testes

- [ ] `npm run typecheck`.
- [ ] `npm run lint`.
- [ ] `npm run format:check`.
- [ ] `npm run build`.
- [ ] `npm test`.
- [ ] `npm run test:coverage`.
- [ ] testes do Worker.
- [ ] `npm run gate:deploy`.

## 5. Fontes reais

- [ ] gate de integração real executado quando aplicável.
- [ ] ao menos uma consulta de Localidades.
- [ ] ao menos uma consulta SIDRA/Agregados.
- [ ] qualquer fonte nova foi testada diretamente.
- [ ] alterações territoriais executaram o gate territorial correspondente.
- [ ] para SP, `npm run gate:sp-645` passa quando a mudança toca localidade/códigos/território.

## 6. Procedência

- [ ] resposta inclui fonte correta.
- [ ] URL corresponde à consulta efetivamente executada.
- [ ] `retrieved_at` não é falsificado por cache hit.
- [ ] vintage/período é informado quando aplicável.
- [ ] resultados derivados são identificados como derivados.
- [ ] attribution permanece presente.

## 7. Segurança

- [ ] nenhuma credencial foi adicionada ao repositório.
- [ ] `.env` e secrets permanecem fora do controle de versão.
- [ ] Host/Origin continuam protegidos.
- [ ] `/metrics` continua não público.
- [ ] rate limit continua operacional.
- [ ] dependências novas foram revisadas quanto a mudanças de contrato.
- [ ] `SECURITY.md` continua coerente com o runtime.

## 8. Privacidade

- [ ] nenhuma nova telemetria de conteúdo foi introduzida sem documentação.
- [ ] argumentos/resultados não são persistidos indevidamente.
- [ ] `PRIVACY.md` foi atualizado se o comportamento operacional mudou.

## 9. Smoke local e remoto

STDIO:

```bash
node scripts/smoke-mcp.mjs --stdio
```

Remoto:

```bash
node scripts/smoke-mcp.mjs https://censosenso.poderdapalavra.org
```

Confirmar:

- [ ] `/health` = HTTP 200;
- [ ] `/status` = versão nova;
- [ ] `initialize`;
- [ ] `notifications/initialized`;
- [ ] `tools/list`;
- [ ] `tools/call`;
- [ ] procedência da chamada real.

## 10. Documentação

- [ ] README indica a versão correta.
- [ ] [FERRAMENTAS.md](FERRAMENTAS.md) cobre mudanças de tools.
- [ ] [MATRIZ_FONTES_E_PROCESSOS.md](MATRIZ_FONTES_E_PROCESSOS.md) cobre fonte/cache/derivação.
- [ ] [EXEMPLOS_E_CASOS_DE_ERRO.md](EXEMPLOS_E_CASOS_DE_ERRO.md) foi atualizado se o uso mudou.
- [ ] release notes foram criadas.
- [ ] CHANGELOG foi atualizado.
- [ ] atribuições/licenças continuam preservadas.

## 11. Publicação

Somente depois dos itens anteriores:

- [ ] merge na `main`;
- [ ] deploy concluído;
- [ ] smoke pós-deploy verde;
- [ ] tag `v<versão>`;
- [ ] GitHub Release;
- [ ] notas de release;
- [ ] anúncio/divulgação compatível com o estágio do produto.

## 12. Pós-release

- [ ] observar erros e rate limiting;
- [ ] observar mudanças nas APIs upstream;
- [ ] registrar regressões como issues específicas;
- [ ] correções entram como incremento do terceiro componente;
- [ ] nova funcionalidade entra no próximo incremento do segundo componente.
