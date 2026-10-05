# Referência das 23 ferramentas do CensoSenso MCP

Esta página é a referência operacional da superfície MCP 0.6.0. Ela complementa o [README](../README.md), que descreve arquitetura, algoritmos, instalação e validação.

Todas as ferramentas são **somente leitura**, idempotentes do ponto de vista do efeito e, quando consultam fontes externas, são marcadas como `openWorld`.

Os schemas das ferramentas `ibge_*` são registrados em modo estrito. Parâmetros desconhecidos são recusados em vez de descartados silenciosamente.

---

## 1. `ibge_estados`

**Finalidade:** listar as 27 unidades da Federação e permitir recorte por região.

**Fonte:** API de Localidades do IBGE.

**Entradas principais:**
- `regiao`: filtro regional;
- `ordenar`: ordenação por código, nome ou sigla.

**Saída:** tabela/estrutura com código, sigla, nome e região.

**Cache:** referência estática, normalmente até 24 h.

**Quando usar:** listagem de UFs, enumeração regional e resolução inicial de contexto territorial.

**Não usar para:** municípios de uma UF; nesse caso use `ibge_municipios`.

---

## 2. `ibge_municipios`

**Finalidade:** listar e buscar municípios brasileiros.

**Fonte:** API de Localidades.

**Entradas principais:**
- `uf`: sigla da UF;
- `busca`: trecho do nome municipal.

**Saída:** municípios com código IBGE de 7 dígitos e nome.

**Comportamento de decisão:**
- sem UF, pode trabalhar no universo nacional;
- com UF, restringe a origem antes do filtro textual;
- a busca por nome não inventa correspondência probabilística.

**Cache:** referência estática, normalmente até 24 h.

**Não usar para:** decompor hierarquia de um código; use `ibge_geocodigo` ou `ibge_localidade`.

---

## 3. `ibge_localidade`

**Finalidade:** obter o registro detalhado de uma localidade a partir de seu código.

**Fonte:** API de Localidades.

**Entradas principais:**
- `codigo`;
- tipo territorial quando exigido pelo schema.

**Níveis suportados:** UF, município e distrito, de acordo com o código e o contrato publicado.

**Saída:** registro da localidade e hierarquia territorial disponível.

**Cache:** referência estática, normalmente até 24 h.

**Uso típico:** quando o código já é conhecido e se deseja o registro territorial completo.

---

## 4. `ibge_geocodigo`

**Finalidade:** resolver nomes para códigos e decompor códigos IBGE.

**Fonte:** API de Localidades e catálogos territoriais locais auditados.

**Entradas principais:**
- `codigo`;
- `nome`;
- `uf`.

**Algoritmo por código:**
- 1 dígito → região;
- 2 dígitos → UF;
- 7 dígitos → município;
- 9 dígitos → distrito.

**Algoritmo por nome:**
1. tenta UF;
2. tenta região;
3. consulta municípios;
4. restringe por UF quando fornecida;
5. faz correspondência textual por inclusão;
6. limita resultados múltiplos a 20;
7. uma única correspondência é expandida para detalhe territorial.

**Saída:** código, nome, tipo, hierarquia e códigos relacionados quando aplicável.

**Validação adicional:** esta ferramenta participou do gate paulista 645/645; 21/21 municípios da amostra determinística foram aprovados.

---

## 5. `ibge_sidra`

**Finalidade:** motor tabular de baixo nível para consultas SIDRA.

**Fonte:** API de Agregados v3 do IBGE.

Desde setembro de 2026, a camada operacional do CensoSenso usa a API de Agregados como backend do SIDRA porque o endpoint histórico `apisidra.ibge.gov.br` passou a impor desafio incompatível com clientes programáticos.

**Entradas principais:**
- `tabela`;
- `variaveis`;
- `nivel_territorial`;
- `localidades`;
- `periodos`;
- parâmetros de classificação;
- paginação/formatação;
- `estatisticas`;
- `agruparPor`;
- `topN`.

**Modo normal:** retorna registros tabulares.

**Modo estatístico:** processa todos os registros antes de paginação e calcula distribuição, percentis e rankings.

**Limitação importante:** consultas muito grandes podem ser recusadas pela própria origem; reduzir períodos, localidades ou elevar o nível territorial.

---

## 6. `ibge_sidra_tabelas`

**Finalidade:** descobrir tabelas/agregados SIDRA.

**Fonte:** catálogo da API de Agregados.

**Entradas principais:**
- texto de busca;
- pesquisa/fonte temática quando aplicável.

**Regras de busca:**
- comparação sem diferença de caixa ou acento;
- palavras da busca precisam casar segundo a regra AND;
- vocabulário cotidiano pode ser normalizado para terminologia usada pelo IBGE, com aviso explícito.

Exemplos de normalização:
- renda → rendimento;
- desemprego → desocupação;
- cidade → município;
- gênero → sexo.

**Uso recomendado:** primeira etapa quando o código da tabela é desconhecido.

---

## 7. `ibge_sidra_metadados`

**Finalidade:** inspecionar a estrutura de uma tabela antes da consulta.

**Fonte:** API de Agregados/SIDRA.

**Entradas principais:**
- código da tabela;
- opções para períodos;
- opções para localidades/classificações.

**Saída:** variáveis, classificações, categorias, períodos e níveis suportados pela tabela.

**Uso recomendado:** segunda etapa do fluxo de descoberta:

```text
ibge_sidra_tabelas → ibge_sidra_metadados → ibge_sidra
```

---

## 8. `ibge_pesquisas`

**Finalidade:** consultar o catálogo de pesquisas e agregados do IBGE.

**Fonte:** API de Pesquisas/Agregados, conforme o contrato da operação.

**Uso:** descobrir pesquisas, produtos e relações com tabelas.

**Distinção:** não é substituto de `ibge_sidra_tabelas` para uma consulta tabular concreta; funciona como catálogo de contexto.

---

## 9. `ibge_censo`

**Finalidade:** wrapper de alto nível para temas do Censo Demográfico.

**Fonte:** SIDRA/API de Agregados.

**Entradas principais:**
- ano;
- tema;
- nível territorial;
- localidades;
- parâmetros estatísticos quando aplicáveis.

**Temas auditados incluem:** população, estrutura etária, idade/sexo, alfabetização, ocupação, renda e outros recortes documentados no código.

**Exemplo metodológico:**
- pirâmide etária 2022 → tabela 9514;
- índice de envelhecimento, idade mediana e razão de sexo → tabela 9515.

**Vantagem:** encapsula escolha de tabela/variável já auditada e reduz erros de parametrização de baixo nível.

---

## 10. `ibge_indicadores`

**Finalidade:** consultar séries econômicas e sociais conhecidas.

**Fonte:** SIDRA/API de Agregados.

**Entradas principais:**
- `indicador`;
- nível territorial;
- localidades;
- períodos;
- modo estatístico.

**Uso:** séries recorrentes para as quais o projeto mantém dicionário auditado de tabela e variável.

**Distinção:** quando a tabela é arbitrária ou não está no dicionário, use `ibge_sidra`.

---

## 11. `ibge_comparar`

**Finalidade:** comparar ou ranquear pequeno conjunto explícito de localidades.

**Fonte:** wrappers e tabelas oficiais usadas pelo indicador solicitado.

**Escopo recomendado:** aproximadamente 2–10 localidades.

**Saída:** comparação normalizada e ordenada, com fonte e parâmetros.

**Não usar para:** ranking de todos os municípios do país; nesse caso prefira o modo `estatisticas=true` na ferramenta tabular apropriada.

---

## 12. `ibge_cidades`

**Finalidade:** produzir panorama de um município semelhante ao fluxo do Cidades@.

**Fonte:** API de Pesquisas/Cidades@ e API de Localidades.

**Entradas principais:**
- `municipio`;
- `tipo`;
- `indicador`.

**Indicadores disponíveis no wrapper incluem:** população, área, densidade, PIB per capita, IDH, escolarização, mortalidade, salário médio, receitas e despesas.

**Regra operacional:** um panorama pode combinar várias consultas; lacunas de fonte são relatadas como indisponibilidade parcial em vez de serem ocultadas.

**Uso recomendado:** pergunta ampla sobre um único município.

---

## 13. `ibge_datasaude`

**Finalidade:** indicadores de saúde, saneamento e condições de vida disponibilizados em tabelas do IBGE/SIDRA.

**Fonte:** SIDRA/API de Agregados.

**Entradas principais:**
- indicador;
- nível territorial;
- localidades;
- períodos;
- modo estatístico.

**Limitações:** a cobertura territorial varia por indicador. A ferramenta deve respeitar a granularidade efetivamente publicada e recusar inferências municipais quando a tabela não publica município.

**Exemplo documentado:** mortalidade infantil não deve ser forçada a nível municipal se o contrato do indicador não o suporta; em determinados casos o dado municipal pode estar disponível por outro caminho, como `ibge_cidades`.

---

## 14. `ibge_malhas`

**Finalidade:** recuperar malhas administrativas.

**Fonte:** API de Malhas Geográficas do IBGE.

**Escopo:** Brasil, regiões, UFs, municípios e demais níveis aceitos pelo contrato.

**Formatos:** conforme o contrato da API e do wrapper, incluindo formatos geográficos estruturados.

**Uso:** geometria administrativa; não confundir com recortes temáticos.

---

## 15. `ibge_vizinhos`

**Finalidade:** identificar vizinhança municipal.

**Fonte:** geometrias administrativas oficiais + algoritmos Turf.

**Sem raio:**
- calcula contiguidade topológica com `@turf/boolean-touches`;
- “vizinho” significa fronteira tocante.

**Com raio:**
- calcula centróides;
- usa `@turf/distance`;
- filtra pela distância informada.

**Limitação:** modo com raio é aproximação entre centróides e não distância mínima entre limites.

**Validação documentada:** Guararema retornou os seis municípios contíguos esperados no ciclo de regressão.

---

## 16. `ibge_malhas_tema`

**Finalidade:** listar e filtrar composição/atributos de recortes territoriais especiais.

**Fonte operacional:** snapshots oficiais versionados derivados do GeoFTP/IBGE.

**Recortes atuais:**
- Amazônia Legal 2024;
- Biomas 2025;
- Semiárido 2022;
- Zona Costeira 2021;
- Faixa de Fronteira 2024;
- Regiões Metropolitanas 2025;
- RIDEs 2025.

**Processo ETL:**
1. fonte oficial;
2. inspeção;
3. validação de estrutura, vintage e encoding;
4. normalização;
5. JSON versionado;
6. geração do catálogo runtime.

**Limitação:** geometria temática não faz parte do contrato desta ferramenta; para malha administrativa use `ibge_malhas`.

---

## 17. `ibge_cnae`

**Finalidade:** consultar a Classificação Nacional de Atividades Econômicas.

**Fonte:** API CNAE do IBGE.

**Códigos aceitos pelo validador compartilhado:**
- seção A–U;
- divisão de 2 dígitos;
- grupo;
- classe;
- subclasse.

Pontuação como ponto, hífen e barra pode ser normalizada antes da validação.

---

## 18. `ibge_nomes`

**Finalidade:** frequência e ranking de nomes.

**Fonte:** API de Nomes do IBGE.

**Modos principais:**
- frequência;
- ranking.

**Filtros:** sexo, década e localidade, quando suportados.

**Observação:** a série é vinculada aos dados censitários disponibilizados pela própria API e não deve ser interpretada como registro civil corrente.

---

## 19. `ibge_paises`

**Finalidade:** informações do catálogo de países do IBGE.

**Fonte:** API de Países.

**Modos:** listar, buscar, detalhes e indicadores, conforme o schema publicado.

**Identificação:** códigos ISO Alpha-2 como `BR`, `US`, `AR`, `PT`.

---

## 20. `ibge_noticias`

**Finalidade:** pesquisar notícias e releases já publicados pelo IBGE.

**Fonte:** API de Notícias.

**Entradas principais:**
- `busca`;
- `tipo`;
- `de`;
- `ate`;
- `destaque`;
- `quantidade`;
- `pagina`.

**Datas de entrada:** DD/MM/AAAA, DD-MM-AAAA ou ISO; a adaptação ao formato exigido pela API é interna.

**Distinção:** eventos futuros/agendados devem ser consultados por `ibge_calendario`.

---

## 21. `ibge_calendario`

**Finalidade:** consultar calendário de divulgações do IBGE.

**Fonte:** API de Calendário.

**Uso:** identificar divulgações programadas e eventos do calendário estatístico.

**Distinção:** notícia/release já publicado → `ibge_noticias`.

---

## 22. `search`

**Finalidade:** busca assistida sobre um índice interno do universo IBGE.

**Contrato:** fornecido por `@sbissoli/mcp-search`.

**Corpus construído pelo CensoSenso:**
- tabelas SIDRA;
- municípios;
- indicadores conhecidos;
- temas do Censo;
- indicadores de saúde;
- recortes territoriais.

**Construção:**
- catálogo SIDRA e municípios são carregados em paralelo;
- entradas estáticas auditadas são acrescentadas;
- índice fica em cache por até 24 h;
- chamadas concorrentes compartilham a construção em andamento.

**Saída:** IDs, títulos e URLs que podem ser resolvidos por `fetch`.

---

## 23. `fetch`

**Finalidade:** transformar um ID retornado por `search` em documento útil e rastreável.

**Regra:** o tipo do ID determina qual ferramenta de domínio gera o documento.

Exemplos:
- tabela SIDRA → `ibge_sidra_metadados`;
- município → `ibge_localidade` + população SIDRA;
- tema de Censo → catálogo auditado;
- saúde → indicador auditado;
- recorte territorial → snapshot;
- indicador conhecido → `ibge_indicadores`.

Assim, `fetch` reutiliza os adapters do servidor em vez de manter uma fonte paralela.

---

# Convenções compartilhadas

## Schemas estritos

Nas ferramentas `ibge_*`, chaves desconhecidas são recusadas.

Isso evita o caso perigoso em que um parâmetro digitado incorretamente é descartado e um valor padrão responde outra pergunta.

## Cache

Presets:

- STATIC: 24 h;
- MEDIUM: 1 h;
- SHORT: 15 min;
- REALTIME: 1 min.

## Retry

- até 4 novas tentativas;
- backoff exponencial;
- 2 s inicial;
- multiplicador 2;
- máximo 16 s;
- retry em 429, 500, 502, 503 e 504 e erros transitórios de rede.

## Procedência

Quando aplicável, a resposta preserva:
- fonte;
- URL;
- instante real de extração;
- indicação de cache;
- dataset/tabela;
- vintage/período;
- derivação;
- atribuição.

## Estatísticas

As estatísticas genéricas são calculadas por `@sbissoli/mcp-stats`; a lógica específica do CensoSenso escolhe a coluna, trata marcadores SIDRA, resolve agrupamentos, previne ambiguidade e monta o contrato de saída.

## Segurança

Todas as tools são somente leitura. O transporte remoto adiciona validação de host/origin, rate limit, autenticação Bearer opcional e proteção independente da rota `/metrics`.
