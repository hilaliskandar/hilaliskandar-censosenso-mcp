# CensoSenso 0.6.0 — Protótipo público 1

Data de preparação: 5 de outubro de 2026.

## Significado da versão

`0.6.0` é a primeira versão pública preparada sob a política pré-1.0 do CensoSenso.

Ela corresponde ao marco funcional anteriormente chamado internamente de `6.0.0` no laboratório privado.

Não houve uma sequência pública 4.x → 5.x → 6.x. Esses números pertencem ao histórico de desenvolvimento anterior à adoção da política pública.

## Principais capacidades

- 23 ferramentas MCP;
- transporte STDIO;
- transporte remoto Streamable HTTP;
- domínio canônico próprio;
- procedência estruturada;
- cache com data real de extração;
- retry com backoff exponencial;
- wrappers de Censo, indicadores, saúde e Cidades@;
- estatísticas sobre conjuntos completos antes da paginação;
- vizinhança municipal topológica;
- modo de proximidade por centróides;
- sete recortes territoriais por snapshots oficiais versionados;
- `search` e `fetch` para pesquisa assistida;
- schemas estritos;
- baseline de superfície MCP;
- gates de CI, Worker e integração;
- proteção da rota `/metrics`;
- documentação de segurança, privacidade e atribuições.

## Validação paulista

O gate específico do Estado de São Paulo confirmou:

- 645 municípios;
- zero divergências globais;
- zero divergências municipais;
- amostra determinística de 21 municípios;
- 21/21 chamadas reais aprovadas;
- SHA-256 `a215de0ed21d5538db07a35e65c8dcd9fb1c201491c1ee1f4d0aaaa757810d86`.

Detalhes: [VALIDACAO_SP_645.md](VALIDACAO_SP_645.md). Evidência pública: [`validation/sp/0.6.0/`](../validation/sp/0.6.0/).

## Estado do produto

Esta versão é um protótipo público:

- somente leitura;
- sem SLA;
- sem OAuth obrigatório;
- sem pacote npm público;
- com rate limit por isolate;
- dependente de disponibilidade das APIs oficiais externas.

## Próxima linha de evolução

- `0.6.x`: correções e melhorias das capacidades atuais;
- `0.7.0`, `0.8.0`: novas funcionalidades;
- `0.9.0`: início do beta;
- `0.9.x`: estabilização do beta;
- `1.0.0`: primeiro lançamento estável.

Consulte [VERSIONAMENTO.md](VERSIONAMENTO.md).
