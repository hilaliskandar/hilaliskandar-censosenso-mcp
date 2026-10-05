# Origem, módulos, contribuições e linhagem técnica

## 1. Objetivo deste documento

Este documento separa de forma explícita quatro categorias que não devem ser confundidas:

1. **código herdado e preservado** do projeto de origem;
2. **código herdado e modificado** pela linha CensoSenso;
3. **código, dados, testes e documentação acrescentados** pela linha CensoSenso;
4. **módulos externos reutilizados como dependências**, cuja implementação permanece nos respectivos pacotes e não é copiada para este repositório.

A finalidade é permitir auditoria de autoria, manutenção, reprodução e análise automatizada sem apagar a história do projeto nem atribuir à linha CensoSenso componentes que continuam pertencendo a outros autores/projetos.

## 2. Projeto de origem e licença

O CensoSenso é uma linha independente derivada do projeto:

- **IBGE Brasil MCP / ibge-br-mcp**
- autoria original registrada no repositório: **Sidney da Silva Pereira Bissoli**
- repositório de referência: <https://github.com/SidneyBissoli/ibge-br-mcp>
- licença recebida: **MIT**
- arquivo de licença preservado: [../LICENSE](../LICENSE)

O histórico Git foi preservado justamente para que a derivação possa ser auditada commit a commit.

A linha CensoSenso não deve ser apresentada como versão oficial, sucessora oficial ou publicação do autor original. A responsabilidade pelas alterações posteriores ao ponto de derivação é da linha independente CensoSenso.

## 3. Marco objetivo usado para comparar origem e CensoSenso

A auditoria do laboratório adotou como baseline o commit:

`d170c584b1a76a29ac16a4a5f7b56afdbc5dd337`

O estado imediatamente anterior a esta revisão documental é:

`ff880cfdbc5ebf89d0735a2274a4c9cc17764d86`

Entre esses marcos, o Git registra:

- **392 commits à frente**;
- **134 arquivos preservados byte a byte**;
- **56 arquivos modificados**;
- **73 arquivos acrescentados**;
- **1 arquivo removido**.

Esses números vêm da comparação da própria árvore Git. Eles são mais importantes que uma descrição subjetiva de “fork”, porque permitem distinguir preservação literal de modificação efetiva.

## 4. Código herdado e preservado integralmente no baseline auditado

Os arquivos abaixo existiam no baseline e chegaram ao estado comparado com o **mesmo blob Git**, isto é, sem alteração byte a byte nesse intervalo.

### 4.1 Núcleo comum

- `src/cache.ts`
- `src/call-shape.ts`
- `src/discover.ts`
- `src/errors.ts`
- `src/index.ts`
- `src/metrics.ts`
- `src/pagination.ts`
- `src/prompts.ts`
- `src/resources.ts`
- `src/retry.ts`
- `src/sidra-agregados.ts`
- `src/stats.ts`
- `src/structured.ts`
- `src/utils/formatters.ts`
- `src/utils/index.ts`
- `src/validation.ts`
- `src/vocabulario.ts`

### 4.2 Ferramentas preservadas integralmente nesse intervalo

- `src/tools/calendario.ts`
- `src/tools/censo.ts`
- `src/tools/cnae.ts`
- `src/tools/comparar.ts`
- `src/tools/estados.ts`
- `src/tools/geocodigo.ts`
- `src/tools/index.ts`
- `src/tools/localidade.ts`
- `src/tools/malhas.ts`
- `src/tools/municipios.ts`
- `src/tools/nomes.ts`
- `src/tools/noticias.ts`
- `src/tools/pesquisas.ts`
- `src/tools/sidra-metadados.ts`
- `src/tools/sidra-tabelas.ts`
- `src/tools/sidra.ts`

### 4.3 Infraestrutura HTTP preservada integralmente nesse intervalo

- `worker/src/analytics.ts`
- `worker/src/auth.ts`
- `worker/src/card.ts`
- `worker/src/icon.ts`
- `worker/src/logger.ts`
- `worker/src/rate-limit.ts`
- `worker/src/status.ts`
- `worker/src/types.ts`
- `worker/src/usage-core.ts`
- `worker/src/usage.ts`

### 4.4 Avaliação e scripts preservados

- `evals/catalog.ts`
- `evals/fixtures/queries.ts`
- `evals/results/2026-08-08.md`
- `evals/run.ts`
- `scripts/atualiza-catalogo-censo.mjs`
- `scripts/sync-version.mjs`

**Interpretação:** “preservado integralmente” aqui significa apenas “não alterado entre o baseline auditado e o estado comparado”. Esses arquivos continuam sujeitos à licença e autoria históricas recebidas do projeto de origem e/ou de fases anteriores do próprio histórico.

## 5. Código herdado que foi modificado pela linha CensoSenso

A comparação Git mostra alteração efetiva nos arquivos abaixo. A lista a seguir explicita a natureza principal da mudança documentada no diário e nos gates.

### 5.1 Identidade, contrato e registro MCP

- `src/config.ts`: ajustes de catálogos/configuração usados pela linha 6.0.0.
- `src/provenance.ts`: adaptação de fontes e, nesta revisão, migração do namespace `_meta` para `io.github.hilaliskandar.censosenso`.
- `src/server.ts`: identidade CensoSenso, instruções de roteamento, registro das ferramentas e compatibilidade dos contratos.
- `server.json`: identidade `io.github.hilaliskandar/censosenso-mcp`, pacote `censosenso-mcp` e endpoint remoto Streamable HTTP.

### 5.2 Ferramentas com mudança funcional

- `src/tools/cidades.ts`: reforço de contrato do panorama municipal, tratamento explícito de indisponibilidade parcial e testes adicionais.
- `src/tools/datasaude.ts`: endurecimento dos contratos e compatibilidade real com as tabelas/níveis efetivamente disponíveis.
- `src/tools/indicadores.ts`: correções de séries/contratos e testes contra comportamento real da origem.
- `src/tools/paises.ts`: correções de saída, tipos e cobertura de testes.
- `src/tools/deep-research.ts`: ampliação substancial do adaptador IBGE para o contrato `search`/`fetch`, incluindo índice, renderização de documentos e integração de procedência.
- `src/tools/vizinhos.ts`: substituição da noção fraca de “vizinhança” por duas semânticas explícitas: contiguidade topológica real sem raio e proximidade por distância entre centróides quando `raio` é informado.
- `src/tools/malhas-tema.ts`: migração do caminho operacional de atributos/listagens para snapshots oficiais versionados, com separação entre composição temática e geometria administrativa.

### 5.3 Worker HTTP modificado

- `worker/src/config.ts`: identidade própria, URL pública e hosts permitidos.
- `worker/src/discovery.ts`: descoberta pública coerente com o novo endpoint.
- `worker/src/index.ts`: ajustes do runtime HTTP da linha atual.
- `worker/src/landing.ts`: landing própria do CensoSenso.
- `worker/src/server.ts`: sincronização de identidade e construção do servidor no Worker.
- `worker/wrangler.jsonc`: Worker `censosenso-mcp`, bindings atuais, `workers.dev`, compatibilidade e observabilidade.

## 6. Componentes acrescentados integralmente pela linha CensoSenso

### 6.1 Camada territorial versionada

Foram acrescentados:

- `src/data/recortes-snapshot.ts`
- `src/data/recortes-gerados.ts`
- `src/data/recortes/amazonia_legal.json`
- `src/data/recortes/biomas.json`
- `src/data/recortes/costeiro.json`
- `src/data/recortes/fronteira.json`
- `src/data/recortes/metropolitana.json`
- `src/data/recortes/ride.json`
- `src/data/recortes/semiarido.json`

A camada foi criada para evitar dependência operacional de um WFS que, durante a auditoria, bloqueava clientes automatizados. Os snapshots preservam fonte, vintage e trilha de geração.

### 6.2 Scripts de auditoria e normalização territorial

Acrescentados:

- `scripts/fontes_recortes_ibge.json`
- `scripts/inspecionar_fontes_recortes.py`
- `scripts/normalizar_recortes.py`
- `scripts/inspecionar_biomas_2025.py`
- `scripts/normalizar_biomas_2025.py`
- `scripts/auditar_categorias_metropolitanas.py`

Esses scripts materializam o caminho fonte oficial → inspeção → validação → normalização → snapshot versionado.

### 6.3 Reprodutibilidade e qualidade

Acrescentados:

- `scripts/check-eol.mjs`
- `scripts/normalize-eol.mjs`
- `scripts/normalize-eol-windows.ps1`
- `scripts/run_integration_gate.ps1`
- novos gates de integração real;
- novos testes de contrato OpenAI/ChatGPT;
- testes de segurança de Host/Origin;
- testes de snapshots, encoding, fontes, recortes e integração real;
- baseline `baselines/surface-stdio-6.0.0.json`.

### 6.4 Piloto municipal

Foram acrescentados:

- `scripts/piloto-guararema.mjs`
- `docs/piloto-guararema-2026-09-19.md`
- `docs/p3-piloto-guararema-execucao-2026-09-21.md`
- `docs/p3-guararema-contraste-diagnostico-2026-09-22.md`
- schema de observação municipal em `docs/schemas/`.

Essa camada não substitui o servidor MCP; é um uso controlado do servidor para verificar utilidade analítica municipal e registrar lacunas.

## 7. Módulos externos reutilizados integralmente como dependências

A expressão “integralmente” nesta seção tem sentido diferente da seção 4: significa que o CensoSenso **consome a API publicada do pacote**, sem manter um fork local de sua implementação.

### 7.1 Pacotes de Sidney Bissoli

#### `@sbissoli/mcp-provenance`

Usado para:

- modelo canônico de procedência;
- projeções `concise`/`detailed`;
- determinismo de serialização;
- tratamento de timezone;
- construção dos nomes de chaves `_meta`;
- footer textual e lista de atribuição.

O CensoSenso **não reimplementa esse núcleo**. O arquivo `src/provenance.ts` é um adaptador IBGE: registra fontes, licença/regime jurídico, namespace próprio, locale, timezone e os dados específicos de cada consulta.

#### `@sbissoli/mcp-search`

Usado para:

- contrato estrutural de `search` e `fetch`;
- envelope de resposta;
- ranking;
- registro das ferramentas;
- mecânica comum de vocabulário.

O CensoSenso acrescenta o **adaptador IBGE** em `src/tools/deep-research.ts`: catálogo indexável, IDs, documentos, obtenção dos dados e integração com a procedência do IBGE.

#### `@sbissoli/mcp-stats`

Usado para:

- min/max;
- média;
- mediana;
- desvio-padrão populacional;
- percentis;
- ranking;
- agrupamento e ordenação estável.

O CensoSenso não copia o algoritmo matemático. `src/stats.ts` adapta colunas SIDRA, vocabulário, marcadores de ausência, identificação de colunas e schemas de entrada/saída.

#### `@sbissoli/mcp-evals`

Dependência de desenvolvimento usada como harness de avaliação de seleção de ferramentas. O catálogo e as fixtures específicas do IBGE ficam em `evals/`; o motor de avaliação permanece no pacote externo.

### 7.2 Model Context Protocol

- `@modelcontextprotocol/server`
- `@modelcontextprotocol/client`

Fornecem servidor, cliente, transporte em memória, validação e primitivas do protocolo MCP. A semântica das 23 ferramentas e seus adapters são deste repositório; o protocolo não é reimplementado localmente.

### 7.3 Turf

- `@turf/boolean-touches`
- `@turf/centroid`
- `@turf/distance`

Usados em `ibge_vizinhos`.

- sem `raio`: `boolean-touches` testa contiguidade topológica;
- com `raio`: `centroid` produz os centróides e `distance` calcula distância entre eles.

O CensoSenso define a regra de negócio e a origem das geometrias; as primitivas geométricas são fornecidas pelo Turf.

### 7.4 `agents` para o transporte MCP no Worker

O pacote `agents` é utilizado pelo Worker, em especial `agents/mcp/server`, para fornecer `createMcpHandler` e adaptar o `McpServer` ao transporte Streamable HTTP no runtime Cloudflare.

O CensoSenso reutiliza esse handler e acrescenta localmente:

- roteamento público/privado;
- CORS;
- Host/Origin;
- autenticação Bearer opcional;
- rate limiting;
- emissão/leitura de `mcp-session-id`;
- métricas;
- landing, health, status e discovery;
- integração com a mesma função `registerAll` usada pelo STDIO.

O pacote `agents` não contém as regras de domínio IBGE do CensoSenso.

### 7.5 Zod, Vitest, TypeScript, ESLint, Prettier e Cloudflare

Esses componentes são infraestrutura de schema, teste, compilação, lint, formatação e hospedagem. Não constituem autoria das regras de negócio do CensoSenso, mas são necessários para reproduzir a implementação e os gates.

## 8. Mapa resumido de responsabilidade

| Componente | Origem principal | Situação no CensoSenso |
|---|---|---|
| cobertura ampla das APIs IBGE e base histórica das tools | projeto de origem | herdada; parte preservada, parte modificada |
| núcleo de procedência | `@sbissoli/mcp-provenance` | usado como dependência; adapter IBGE local |
| `search`/`fetch` genéricos | `@sbissoli/mcp-search` | usado como dependência; índice/documentos IBGE locais |
| estatística genérica | `@sbissoli/mcp-stats` | usado como dependência; adapter SIDRA local |
| harness de evals | `@sbissoli/mcp-evals` | usado em desenvolvimento; fixtures IBGE locais |
| protocolo MCP | Model Context Protocol SDK | dependência externa |
| operações geométricas | Turf | dependência externa |
| snapshots territoriais e ETL | CensoSenso | acrescentado |
| contiguidade/radius semantics em `ibge_vizinhos` | CensoSenso + Turf | modificado/acrescentado |
| auditoria de contratos reais | CensoSenso | acrescentado |
| piloto Guararema | CensoSenso | acrescentado |
| deploy GitHub → Cloudflare Workers | CensoSenso | configurado nesta linha |
| endpoint remoto `workers.dev` | CensoSenso/Cloudflare | publicado nesta linha |

## 9. Como verificar esta classificação

A classificação pode ser reproduzida com Git:

```bash
git diff --stat d170c584b1a76a29ac16a4a5f7b56afdbc5dd337..main
git diff --name-status d170c584b1a76a29ac16a4a5f7b56afdbc5dd337..main
git log --oneline d170c584b1a76a29ac16a4a5f7b56afdbc5dd337..main
```

Para confirmar preservação literal de um arquivo:

```bash
git rev-parse d170c584b1a76a29ac16a4a5f7b56afdbc5dd337:src/tools/estados.ts
git rev-parse main:src/tools/estados.ts
```

Hashes iguais indicam o mesmo blob.

## 10. Regra de documentação para futuras mudanças

Toda mudança estrutural relevante deve indicar:

1. arquivo/módulo afetado;
2. se é herdado, modificado ou novo;
3. dependência externa eventualmente utilizada;
4. efeito no contrato MCP;
5. teste/gate que prova a mudança;
6. fonte oficial afetada;
7. efeito sobre procedência e reprodução;
8. impacto no deploy remoto.

Essa regra existe para impedir que a linhagem se torne novamente implícita.
