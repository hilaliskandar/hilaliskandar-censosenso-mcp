# Matriz de fontes, cache, derivação e limitações

Esta matriz resume a superfície 6.0.0 do CensoSenso MCP. Para detalhes de parâmetros e uso, consulte [FERRAMENTAS.md](FERRAMENTAS.md).

| Ferramenta | Fonte principal | Extração | Cache típico | Pode derivar? | Limitações/observações |
|---|---|---|---|---|---|
| `ibge_estados` | API de Localidades | live GET | STATIC 24 h | não | catálogo territorial |
| `ibge_municipios` | API de Localidades | live GET | STATIC 24 h | não | busca textual, sem fuzzy probabilístico |
| `ibge_localidade` | API de Localidades | live GET | STATIC 24 h | não | exige código conhecido |
| `ibge_geocodigo` | API de Localidades + catálogos locais | live GET / catálogo | STATIC 24 h | não | resolve por estrutura do código e busca textual |
| `ibge_sidra` | API de Agregados v3 | live GET | conforme consulta | sim | origem pode recusar consultas muito grandes |
| `ibge_sidra_tabelas` | catálogo de Agregados | live GET | STATIC 24 h | não | descoberta, não substitui consulta tabular |
| `ibge_sidra_metadados` | API de Agregados | live GET | STATIC/MEDIUM | não | depende da estrutura publicada da tabela |
| `ibge_pesquisas` | APIs de Pesquisas/Agregados | live GET | STATIC/MEDIUM | não | catálogo de contexto |
| `ibge_censo` | SIDRA/Agregados | live GET | conforme consulta | sim | temas limitados ao dicionário auditado |
| `ibge_indicadores` | SIDRA/Agregados | live GET | conforme consulta | sim | dicionário de indicadores auditados |
| `ibge_comparar` | wrappers oficiais | live GET | conforme consulta | sim | recomendado para 2–10 localidades |
| `ibge_cidades` | Pesquisas/Cidades@ + Localidades | múltiplos GETs | MEDIUM/STATIC | parcialmente | pode haver lacunas parciais na origem |
| `ibge_datasaude` | SIDRA/Agregados | live GET | conforme consulta | sim | granularidade varia por indicador |
| `ibge_malhas` | API de Malhas | live GET | STATIC | não | geometrias podem ser volumosas |
| `ibge_vizinhos` | Malhas + Turf | live GET + cálculo | STATIC para geometrias | sim | raio usa distância entre centróides |
| `ibge_malhas_tema` | snapshots GeoFTP/IBGE | snapshot local versionado | não depende de fetch a cada chamada | não/filtragem | geometria temática fora do contrato |
| `ibge_cnae` | API CNAE | live GET | STATIC/MEDIUM | não | códigos seguem hierarquia CNAE |
| `ibge_nomes` | API de Nomes | live GET | STATIC/MEDIUM | não | série censitária, não registro civil corrente |
| `ibge_paises` | API de Países | live GET | STATIC/MEDIUM | não | identificação por ISO Alpha-2 |
| `ibge_noticias` | API de Notícias | live GET | SHORT | não | somente itens já publicados |
| `ibge_calendario` | API de Calendário | live GET | SHORT | não | agenda futura, distinta de notícias |
| `search` | índice interno montado de fontes IBGE | catálogo + cache | STATIC 24 h | ranking | ranking delegado a mcp-search |
| `fetch` | ferramentas de domínio | live/snapshot conforme ID | conforme ferramenta | conforme origem | reusa adapters, não mantém fonte paralela |

## Tipos de extração

### Live GET

A ferramenta consulta a API oficial no momento da execução, sujeita a cache TTL e retry.

### Snapshot local versionado

A origem oficial é extraída por processo ETL controlado, validada, normalizada e armazenada no repositório. A chamada da ferramenta lê o snapshot local e expõe o vintage da fonte.

### Múltiplos GETs

Uma resposta de alto nível pode combinar várias fontes ou indicadores. Cada falha parcial deve ser explicitada e não substituída por valor estimado.

## Derivação

“Pode derivar” significa que a ferramenta pode produzir medidas calculadas pelo servidor, como:

- soma;
- média;
- mediana;
- desvio-padrão;
- percentis;
- rankings;
- agrupamentos;
- distância entre centróides;
- composição comparativa.

Quando há derivação, a procedência deve indicar que o resultado não é apenas transcrição da fonte.

## Cache

Os presets globais são:

| Preset | TTL |
|---|---:|
| STATIC | 24 h |
| MEDIUM | 1 h |
| SHORT | 15 min |
| REALTIME | 1 min |

A ferramenta pode definir TTL específico conforme a natureza da consulta.

Em cache hit, `retrieved_at` preserva o instante da extração upstream original; não é substituído pelo instante do reuso local.

## Fontes oficiais principais

- Localidades: `https://servicodados.ibge.gov.br/api/v1/localidades`;
- Agregados/SIDRA: `https://servicodados.ibge.gov.br/api/v3/agregados`;
- Nomes: `https://servicodados.ibge.gov.br/api/v2/censos/nomes`;
- Malhas: `https://servicodados.ibge.gov.br/api/v3/malhas`;
- Notícias: `https://servicodados.ibge.gov.br/api/v3/noticias`;
- Projeções: `https://servicodados.ibge.gov.br/api/v1/projecoes/populacao`;
- CNAE: `https://servicodados.ibge.gov.br/api/v2/cnae`;
- Calendário: `https://servicodados.ibge.gov.br/api/v3/calendario`;
- Países: `https://servicodados.ibge.gov.br/api/v1/paises`;
- Pesquisas/Cidades@: `https://servicodados.ibge.gov.br/api/v1/pesquisas`;
- GeoFTP: `https://geoftp.ibge.gov.br/`.
