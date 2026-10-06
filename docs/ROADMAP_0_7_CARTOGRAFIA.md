# Roadmap 0.7 — Integração cartográfica no CensoSenso MCP

## Objetivo da versão 0.7

A versão 0.7 tem como objetivo transformar a superfície geográfica atual do CensoSenso, hoje concentrada em malhas administrativas, recortes territoriais e consultas tabulares, em uma capacidade cartográfica reproduzível dentro do MCP.

O resultado esperado é permitir que clientes MCP solicitem não apenas geometrias e URLs de origem, mas também dados espaciais recortados, mapas temáticos e mapas de meio físico, com procedência, limites operacionais e testes reproduzíveis.

A versão 0.7 não pretende incorporar o QGIS ao runtime. A implementação deverá permanecer compatível com o servidor TypeScript/Node e com o Cloudflare Worker.

## Referência metodológica e limites de reutilização

O repositório GISBR, de d-camargo/gisbr, será tratado como referência metodológica para catálogo de fontes, estratégias de filtragem, recorte espacial, escalas de uso e robustez de conectores.

O GISBR reúne 75 fontes em nove eixos e, para meio físico, já identifica diretamente no BDIA/IBGE as seguintes camadas:

| Tema | Identificador GISBR | Camada WFS |
|---|---|---|
| Pedologia | ibge_bdia_pedologia | BDIA:pedo_area |
| Geologia | ibge_bdia_geologia | BDIA:geol_area |
| Geomorfologia | ibge_bdia_geomorfologia | BDIA:geom_area |
| Vegetação | ibge_bdia_vegetacao | BDIA:vege_area |

Endpoint WFS comum:

`https://geoservicos.ibge.gov.br/geoserver/ows`

CRS de trabalho:

`EPSG:4674 — SIRGAS 2000`

O código do GISBR é GPL-3.0 e o CensoSenso é MIT. A versão 0.7 não deverá copiar código GPL para o repositório. Serão reaproveitados apenas conceitos arquiteturais, identificação de serviços públicos, nomes de camadas, estratégias de consulta e documentação pública das fontes. Os conectores e renderizadores do CensoSenso serão implementados de forma independente.

## Princípios da implementação

1. Separar aquisição de dados espaciais de renderização cartográfica.
2. Trabalhar prioritariamente em EPSG:4674.
3. Consultar serviços públicos diretamente, sem dependência de QGIS.
4. Filtrar no servidor sempre que possível.
5. Para fontes sem campo municipal, usar BBOX e depois recorte pelo polígono municipal.
6. Não devolver geometrias enormes sem limite explícito.
7. Preservar procedência, URL reproduzível, vintage quando disponível e instante de extração.
8. Tratar HTTP 200 com corpo de erro como falha real quando aplicável a WFS/ArcGIS.
9. Detectar truncamento ou paginação incompleta.
10. Manter compatibilidade com STDIO e Cloudflare Worker.

## Arquitetura-alvo

Fluxo de dados:

```text
código IBGE
   ↓
limite administrativo
   ↓
bbox
   ↓
conector espacial
   ↓
WFS / ArcGIS REST / GeoJSON / COG
   ↓
normalização
   ↓
recorte pelo limite
   ↓
GeoJSON + metadados + procedência
   ↓
renderizador cartográfico
   ↓
SVG temático
```

A versão 0.7 deve evitar acoplamento entre fonte e renderer. O mesmo renderer deverá poder receber:

- dados de meio físico;
- indicadores municipais;
- recortes administrativos;
- áreas de risco;
- uso e cobertura da terra;
- outras camadas futuras.

## Ferramentas MCP previstas

### ibge_meio_fisico

Primeira ferramenta nova da versão.

Contrato inicial proposto:

```ts
{
  municipio: string,
  tema: "pedologia" | "geologia" | "geomorfologia" | "vegetacao",
  formato?: "resumo" | "geojson"
}
```

Responsabilidades:

- resolver e validar código municipal;
- obter limite municipal;
- calcular BBOX;
- consultar a camada WFS correspondente;
- recortar as feições ao limite municipal;
- normalizar atributos;
- devolver contagem de feições;
- registrar fonte, camada, CRS e procedência;
- aplicar limites de volume.

### ibge_mapa

Ferramenta de composição cartográfica.

Contrato inicial proposto:

```ts
{
  municipio?: string,
  municipios?: string[],
  tipo: "meio_fisico" | "coropletico",
  tema?: string,
  indicador?: string,
  formato?: "svg",
  legenda?: boolean,
  rotulos?: boolean
}
```

Responsabilidades:

- receber camada geográfica já normalizada;
- aplicar simbologia;
- montar viewport;
- desenhar limites;
- criar legenda;
- adicionar título, fonte e data de extração;
- produzir SVG reproduzível.

PNG não é requisito inicial da 0.7. SVG será o formato cartográfico canônico da primeira implementação.

## Escala progressiva de Pull Requests

A ordem abaixo é obrigatoriamente progressiva. Cada PR deve deixar o repositório em estado funcional e com testes verdes antes do PR seguinte.

### PR 0 — Documentação e contrato da versão 0.7

Objetivo:

- registrar esta roadmap;
- atualizar README;
- consolidar decisões arquiteturais;
- definir critérios de aceite;
- explicitar compatibilidade de licença;
- fixar o escopo mínimo da 0.7.

Sem alteração funcional.

Critério de saída:

- roadmap publicada;
- README apontando para a roadmap;
- sequência de PRs acordada.

### PR 1 — Núcleo geoespacial e cliente WFS

Branch sugerida:

`feat/0.7-geo-wfs-core`

Escopo:

- módulo genérico de construção de requisições WFS GetFeature;
- suporte a `outputFormat=application/json`;
- suporte a BBOX;
- suporte a CRS;
- parse e validação de GeoJSON;
- timeout e retry;
- detecção de erro WFS;
- detecção de truncamento quando a origem expuser contagens;
- normalização de FeatureCollection;
- testes unitários.

Dependências Turf a avaliar:

- bbox;
- boolean-intersects;
- intersect.

Critério de aceite:

- consulta real simples ao GeoServer do IBGE;
- GeoJSON válido;
- erro upstream reproduzido de forma explícita;
- testes unitários e integração verdes;
- nenhum impacto nas 23 ferramentas existentes.

### PR 2 — Limite municipal, BBOX e recorte

Branch sugerida:

`feat/0.7-geo-clip`

Escopo:

- reaproveitar `ibge_malhas` para limite municipal;
- calcular BBOX;
- recortar feições pelo polígono municipal;
- preservar propriedades originais;
- normalizar CRS esperado;
- impor limite de feições e tamanho.

Critério de aceite:

- teste com Jundiaí, código 3525904;
- nenhuma feição devolvida exclusivamente fora do limite municipal;
- comportamento documentado para feições que cruzam o limite;
- testes determinísticos com fixtures.

### PR 3 — Catálogo BDIA e ferramenta ibge_meio_fisico

Branch sugerida:

`feat/0.7-meio-fisico-bdia`

Escopo:

- catálogo declarativo TypeScript;
- pedologia;
- geologia;
- geomorfologia;
- vegetação;
- ferramenta MCP `ibge_meio_fisico`;
- modos `resumo` e `geojson`;
- procedência por camada;
- documentação em FERRAMENTAS e MATRIZ_FONTES_E_PROCESSOS.

Critério de aceite:

- 4/4 temas retornando para pelo menos um município piloto;
- `structuredContent` válido;
- fonte, URL, CRS e data de extração presentes;
- resposta `resumo` adequada para uso por LLM;
- resposta `geojson` limitada e reproduzível.

### PR 4 — Homologação meio físico nos 30 municípios TIC-TIM

Branch sugerida:

`test/0.7-tic-tim-meio-fisico`

Escopo:

- script reproduzível de homologação;
- universo fixo dos 30 municípios;
- quatro temas BDIA;
- 120 combinações município × tema;
- registro de sucesso, vazio, erro, truncamento e tamanho;
- artefatos versionados de validação.

Critério de aceite:

- relatório consolidado 30 × 4;
- inexistência de erro silencioso;
- todas as respostas com procedência;
- limites operacionais conhecidos;
- documentação dos casos vazios ou indisponíveis.

### PR 5 — Renderer SVG genérico

Branch sugerida:

`feat/0.7-map-svg-renderer`

Escopo:

- transformação de GeoJSON em paths SVG;
- viewport automático;
- margem e enquadramento;
- limite municipal;
- simbologia categórica;
- simbologia graduada básica;
- legenda;
- título;
- fonte;
- data de extração;
- escala gráfica simplificada quando tecnicamente defensável.

Não acoplar o renderer ao BDIA.

Critério de aceite:

- SVG válido;
- resultado determinístico para fixture;
- renderização de pelo menos uma camada categórica;
- renderização de pelo menos um coroplético;
- sem dependência nativa incompatível com Cloudflare Worker.

### PR 6 — Ferramenta ibge_mapa

Branch sugerida:

`feat/0.7-ibge-mapa`

Escopo:

- registrar ferramenta MCP;
- fluxo `meio_fisico`;
- fluxo `coropletico`;
- mapa municipal;
- mapa com conjunto de municípios;
- legenda e rótulos opcionais;
- metadados cartográficos e procedência.

Primeiro caso funcional obrigatório:

`Mapa de geomorfologia de Jundiaí`.

Primeiro caso coroplético obrigatório:

`Mapa de PIB per capita dos 30 municípios TIC-TIM`.

Critério de aceite:

- tool call real via STDIO;
- tool call real via Worker;
- SVG devolvido ou referenciado de forma compatível com o contrato;
- ausência de regressão nas ferramentas existentes.

### PR 7 — Ampliação das fontes de meio físico

Branch sugerida:

`feat/0.7-physical-environment-sources`

Fontes prioritárias:

1. hidrografia;
2. bacias hidrográficas;
3. risco geológico SGB/CPRM;
4. poços SIAGAS;
5. processos minerários ANM;
6. risco de inundação DataGeo-SP;
7. biomas;
8. uso e cobertura da terra MapBiomas.

A entrada dessas fontes será condicionada a:

- endpoint público;
- licença compatível para consulta;
- comportamento mensurável;
- capacidade de filtro;
- tamanho suportável no Worker;
- procedência rastreável.

Critério de aceite:

- matriz de fontes atualizada;
- cada fonte com teste funcional;
- limitações registradas;
- fontes instáveis não bloqueiam a ferramenta inteira.

### PR 8 — Gate final da versão 0.7

Branch sugerida:

`release/0.7-cartografia-gate`

Escopo:

- baseline MCP atualizado;
- testes de contrato;
- testes STDIO;
- testes Worker;
- testes WFS;
- testes de mapas;
- TIC-TIM 30 × 4;
- smoke de produção;
- documentação final;
- notas da versão 0.7.0.

Critérios de saída para release:

- CI verde;
- `npm run gate:deploy` verde;
- `tools/list` com superfície esperada;
- `ibge_meio_fisico` homologado;
- `ibge_mapa` homologado;
- mapas de meio físico reproduzíveis;
- mapa coroplético dos 30 municípios reproduzível;
- produção validada em `censosenso.poderdapalavra.org`.

## Marcos funcionais

### Marco A — Consulta espacial

Concluído quando o CensoSenso consegue consultar WFS e devolver GeoJSON recortado.

Abrange PRs 1 e 2.

### Marco B — Meio físico

Concluído quando as quatro camadas BDIA funcionam por município.

Abrange PRs 3 e 4.

### Marco C — Cartografia

Concluído quando o MCP consegue produzir SVG cartográfico a partir de GeoJSON.

Abrange PRs 5 e 6.

### Marco D — Diagnóstico territorial ampliado

Concluído quando o conjunto de fontes físicas prioritárias está integrado e testado.

Abrange PR 7.

### Marco E — Release 0.7

Concluído com gate final, documentação, baseline e deploy.

Abrange PR 8.

## Critérios transversais de qualidade

Todos os PRs funcionais devem observar:

- TypeScript estrito;
- schemas Zod;
- `content` e `structuredContent` coerentes;
- procedência;
- attribution;
- timeout;
- retry;
- cache quando apropriado;
- limite explícito de volume;
- erros upstream legíveis;
- testes unitários;
- testes de integração quando houver fonte pública;
- ausência de alterações silenciosas no baseline MCP.

## Limites operacionais a definir antes do PR 3

Devem ser fixados e testados:

- máximo de feições por resposta;
- máximo de bytes de GeoJSON;
- política de simplificação;
- timeout WFS;
- número máximo de páginas;
- tamanho máximo de SVG;
- comportamento quando a consulta exceder limites;
- política de cache para geometrias;
- política de cache para mapas renderizados.

## Questões que não devem bloquear o início

Podem ser decididas durante os PRs correspondentes:

- paleta definitiva;
- PNG;
- tiles;
- mapas interativos;
- hospedagem persistente de artefatos;
- estilos cartográficos avançados;
- suporte a mapas impressos;
- escala gráfica de alta precisão;
- generalização cartográfica multiescala.

Esses itens não fazem parte do escopo mínimo da versão 0.7.

## Definição de pronto da versão 0.7

A versão 0.7 será considerada concluída quando um cliente MCP puder solicitar, pelo endpoint remoto de produção:

```text
Produza um mapa de geomorfologia de Jundiaí.
```

e receber uma resposta cartográfica reproduzível, com:

- geometria oficial;
- recorte municipal correto;
- simbologia;
- legenda;
- identificação da fonte;
- procedência;
- CRS;
- data de extração.

Também deverá ser possível solicitar:

```text
Produza um mapa do PIB per capita dos 30 municípios do TIC-TIM.
```

e receber um coroplético gerado a partir de dados e geometrias obtidos pelo próprio CensoSenso.

Esse é o critério funcional final da roadmap 0.7.
