# Contributing to CensoSenso MCP

Este documento descreve o caminho atual de contribuição. Para arquitetura e linhagem, leia antes:

- [docs/ARQUITETURA_FLUXOS_E_REPRODUTIBILIDADE.md](docs/ARQUITETURA_FLUXOS_E_REPRODUTIBILIDADE.md)
- [docs/ORIGEM_MODULOS_E_CONTRIBUICOES.md](docs/ORIGEM_MODULOS_E_CONTRIBUICOES.md)
- [CLAUDE.md](CLAUDE.md), que contém invariantes técnicas detalhadas usadas também por agentes de código.

## Pré-requisitos

- Node.js 22 ou superior;
- npm;
- Git.

Para regenerar snapshots territoriais, Python também é necessário.

## Setup

```bash
git clone https://github.com/hilaliskandar/hilaliskandar-censosenso-mcp.git
cd ibge-br-mcp-lab
npm ci
npm run gate:deploy
```

Use `npm ci`, não `npm install`, quando a finalidade for reproduzir o estado versionado.

## Estrutura

```text
src/
  server.ts          registro MCP e SERVER_INSTRUCTIONS
  provenance.ts      adapter de procedência IBGE
  stats.ts           adapter estatístico
  structured.ts      emissão content/structuredContent/_meta
  tools/             ferramentas de domínio
  data/recortes/     snapshots oficiais versionados
worker/
  src/               transporte HTTP Cloudflare
  tests/
  wrangler.jsonc
tests/                unitários, contratos e integrações
evals/                seleção semântica
scripts/              gates, normalização, auditoria e smoke
baselines/            superfície MCP normalizada
docs/                 arquitetura, auditorias e diário
```

## Adicionando ou alterando uma ferramenta

### 1. Implementação

Crie ou altere o módulo em `src/tools/`.

O módulo deve:

- usar schema Zod estrito;
- separar validação, consulta e formatação;
- usar `cachedFetch`/retry quando consultar HTTP;
- retornar `StructuredToolResult`;
- anexar procedência em toda resposta bem-sucedida;
- usar as utilities existentes em vez de reimplementar mecanismos compartilhados.

### 2. Export

Atualize `src/tools/index.ts` quando for uma ferramenta nova.

### 3. Registro

O registro acontece em `src/server.ts`, dentro de `registerAll()`, com `server.registerTool(...)`.

A configuração deve conter:

- `title`;
- `description`;
- `inputSchema`;
- `outputSchema`;
- anotações read-only/idempotent;
- callback envolvido pelo mecanismo comum de handling/métricas.

Não registrar tools diretamente em `src/index.ts`.

### 4. Descrição semântica

A descrição é parte do roteamento de agentes. Deve dizer:

- quando usar;
- quando usar outra ferramenta;
- exemplos;
- limitações relevantes.

Orientações transversais ficam em `SERVER_INSTRUCTIONS`, em `src/server.ts`.

### 5. Procedência

Use `provenienciaIbge(...)` e as fontes registradas em `src/provenance.ts`.

Não montar manualmente:

- citação;
- `retrieved_at`;
- `_meta`;
- footer;
- attribution.

O namespace atual é `io.github.hilaliskandar.censosenso/*`.

### 6. Output schema

Toda resposta estruturada deve validar contra o `outputSchema` anunciado. O gate `tests/output-contract.test.ts` protege essa invariância.

### 7. Testes

No mínimo:

- teste de schema/validação;
- teste do handler;
- erro relevante;
- procedência;
- structured output.

Se a mudança corrige comportamento observado na fonte real, acrescente contrato de integração condicional quando for útil para detectar futura mudança upstream.

### 8. Documentação

Atualize, conforme o impacto:

- README;
- CHANGELOG;
- descrição da tool;
- documentação de arquitetura;
- origem/contribuições, se introduzir novo módulo externo ou novo componente próprio;
- diário/auditoria quando a mudança decorrer de investigação de fonte.

## Gates

### Gate completo

```bash
npm run gate:deploy
```

### Integração real

Windows/PowerShell:

```powershell
.\scripts\run_integration_gate.ps1
```

### Smoke

STDIO:

```bash
node scripts/smoke-mcp.mjs --stdio
```

Remoto:

```bash
node scripts/smoke-mcp.mjs https://censosenso.poderdapalavra.org
```

### Superfície MCP

```bash
node scripts/dump-surface.mjs --stdio
```

Mudança intencional de superfície deve atualizar o baseline correspondente e ser explicada.

## Recortes territoriais

Não editar manualmente os JSONs em `src/data/recortes/` para “corrigir” dados.

Fluxo:

1. atualizar/confirmar fonte em `scripts/fontes_recortes_ibge.json`;
2. inspecionar a fonte;
3. executar o normalizador;
4. validar contagem/encoding;
5. revisar diff;
6. rodar testes específicos;
7. versionar artefato e explicação.

## Dependências externas

Ao acrescentar uma dependência:

1. justificar por que não deve ser implementada localmente;
2. atualizar `package.json` e lockfile juntos;
3. documentar o papel em `docs/ORIGEM_MODULOS_E_CONTRIBUICOES.md`;
4. preservar licença/atribuição exigidas;
5. executar auditoria de segurança e gate completo.

## Versão

A fonte de verdade é `package.json`.

O script `scripts/sync-version.mjs` espelha a versão nos manifestos que não conseguem derivá-la.

Não fazer bumps manuais inconsistentes em arquivos espelho.

## Pull requests

Uma PR deve indicar:

- objetivo;
- arquivos/módulos;
- origem da mudança;
- efeito no contrato MCP;
- efeito em dados/procedência;
- testes executados;
- impacto de deploy;
- mudança de documentação.

Não fazer merge com gate vermelho sem explicação e decisão explícita.

## Estilo

- TypeScript/ESM;
- imports com extensão `.js` conforme a configuração atual;
- ESLint;
- Prettier;
- LF;
- nomes e mensagens de usuário preferencialmente em pt-BR;
- descrição MCP pode usar inglês quando necessário para interoperabilidade, preservando títulos/saída em pt-BR conforme o padrão atual.

## Segurança

O servidor é read-only sobre fontes públicas. Não introduzir:

- ações destrutivas;
- segredos em código;
- valores de autenticação em logs;
- bypass silencioso de Host/Origin;
- fallback de fonte que altere silenciosamente a semântica.

## Dúvidas

Use issues do repositório e cite arquivos/commits concretos. Quando uma dúvida envolver autoria/origem, prefira a árvore Git e o documento de linhagem a inferências.
