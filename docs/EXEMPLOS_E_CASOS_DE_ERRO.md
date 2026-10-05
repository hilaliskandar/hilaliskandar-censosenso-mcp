# Exemplos de uso e casos de erro

Esta página complementa [FERRAMENTAS.md](FERRAMENTAS.md). Os exemplos abaixo mostram a forma recomendada de chamar cada ferramenta e o tipo de resposta esperado. Valores numéricos correntes não são fixados aqui quando dependem de dados que podem mudar.

## Convenção

Exemplo:

```text
ibge_geocodigo(nome="Campinas", uf="SP")
```

Saída esperada:
- tipo de resultado;
- código IBGE;
- nome;
- hierarquia, quando aplicável;
- procedência da fonte oficial.

Erros devem aparecer explicitamente como erro de validação, ausência de resultado ou falha upstream; o servidor não deve responder outra pergunta silenciosamente.

---

## 1. ibge_estados

```text
ibge_estados(regiao="SE")
```

Esperado: lista das UFs da Região Sudeste.

Erro típico: código/região inválido → mensagem explícita e sugestão de valores aceitos.

## 2. ibge_municipios

```text
ibge_municipios(uf="SP", busca="Campinas")
```

Esperado: Campinas com código IBGE de 7 dígitos.

Erro típico: UF inexistente ou busca sem correspondência.

## 3. ibge_localidade

```text
ibge_localidade(codigo=3509502)
```

Esperado: registro territorial completo de Campinas e hierarquia disponível.

Erro típico: código sem localidade correspondente.

## 4. ibge_geocodigo

```text
ibge_geocodigo(codigo="3509502")
```

Esperado: município Campinas, código 3509502, hierarquia e código SIDRA relacionado.

Outro uso:

```text
ibge_geocodigo(nome="Campinas", uf="SP")
```

Erro típico: código com comprimento inválido ou nome ambíguo.

## 5. ibge_sidra

```text
ibge_sidra(
  tabela="6579",
  variaveis="9324",
  nivel_territorial="6",
  localidades="3509502",
  periodos="last"
)
```

Esperado: último valor publicado da tabela/variável para Campinas, com período e procedência.

Ranking:

```text
ibge_sidra(
  tabela="6579",
  variaveis="9324",
  nivel_territorial="3",
  localidades="all",
  periodos="last",
  estatisticas=true
)
```

Esperado: distribuição completa antes da paginação, top/bottom e percentis.

Erro típico: tabela/variável/período incompatível; a mensagem da API upstream deve ser preservada quando útil.

## 6. ibge_sidra_tabelas

```text
ibge_sidra_tabelas(busca="renda trabalho")
```

Esperado: tabelas cujo conteúdo corresponda aos termos, com códigos e nomes.

Erro/aviso típico: normalização de vocabulário cotidiano para terminologia IBGE deve ser informada.

## 7. ibge_sidra_metadados

```text
ibge_sidra_metadados(tabela="9515", incluir_periodos=true, incluir_localidades=true)
```

Esperado: variáveis, classificações, períodos e níveis territoriais da tabela.

Erro típico: tabela inexistente.

## 8. ibge_pesquisas

```text
ibge_pesquisas(busca="Censo")
```

Esperado: pesquisas/agregados relacionados ao termo.

## 9. ibge_censo

```text
ibge_censo(
  ano="2022",
  tema="estrutura_etaria",
  nivel_territorial="6",
  localidades="3509502"
)
```

Esperado: indicadores de estrutura etária do Censo 2022 para Campinas.

Erro típico: combinação ano/tema não disponível.

## 10. ibge_indicadores

```text
ibge_indicadores(
  indicador="populacao",
  nivel_territorial="6",
  localidades="3509502",
  periodos="last 5"
)
```

Esperado: série auditada de população para a localidade.

Erro típico: indicador não cadastrado no dicionário auditado.

## 11. ibge_comparar

```text
ibge_comparar(
  indicador="populacao",
  localidades="3509502,3525904,3550308"
)
```

Esperado: comparação entre Campinas, Jundiaí e São Paulo com ordenação/estatísticas previstas pelo contrato.

Erro típico: quantidade de localidades fora do limite aceito.

## 12. ibge_cidades

```text
ibge_cidades(tipo="panorama", municipio="3509502")
```

Esperado: panorama municipal com indicadores disponíveis e aviso explícito para lacunas parciais.

Erro típico: município inválido ou indicador não disponível na origem.

## 13. ibge_datasaude

```text
ibge_datasaude(
  indicador="saneamento_agua",
  nivel_territorial="6",
  localidades="3509502",
  periodos="last"
)
```

Esperado: indicador de saúde/condições de vida no nível efetivamente publicado.

Erro típico: nível municipal solicitado para indicador que não publica esse nível.

## 14. ibge_malhas

```text
ibge_malhas(tipo="municipio", codigo="3509502", formato="geojson")
```

Esperado: geometria administrativa oficial de Campinas.

Erro típico: formato ou nível incompatível.

## 15. ibge_vizinhos

Contiguidade:

```text
ibge_vizinhos(municipio="3518305")
```

Esperado: municípios que tocam a fronteira de Guararema.

Raio:

```text
ibge_vizinhos(municipio="3518305", raio=50)
```

Esperado: municípios filtrados por distância entre centróides, com essa aproximação explicitada.

## 16. ibge_malhas_tema

```text
ibge_malhas_tema(tema="amazonia_legal")
```

Esperado: composição municipal do snapshot oficial versionado.

Filtro:

```text
ibge_malhas_tema(tema="metropolitana", codigo="...")
```

Erro típico: tema inexistente ou código incompatível com o recorte.

## 17. ibge_cnae

```text
ibge_cnae(tipo="buscar", busca="construção")
```

Esperado: itens CNAE correspondentes.

Outro uso:

```text
ibge_cnae(tipo="detalhes", codigo="41")
```

Erro típico: código fora da hierarquia CNAE aceita.

## 18. ibge_nomes

```text
ibge_nomes(tipo="frequencia", nomes="Maria")
```

Esperado: frequência por períodos disponibilizados pela API.

Ranking:

```text
ibge_nomes(tipo="ranking", sexo="F", decada=2000)
```

## 19. ibge_paises

```text
ibge_paises(tipo="detalhes", pais="BR")
```

Esperado: dados do Brasil no catálogo internacional do IBGE.

Erro típico: código de país inválido.

## 20. ibge_noticias

```text
ibge_noticias(busca="censo", quantidade=10)
```

Esperado: itens já publicados, em ordem recente, com links.

Erro típico: intervalo de datas inválido.

## 21. ibge_calendario

```text
ibge_calendario(busca="PNAD")
```

Esperado: eventos/divulgações programadas correspondentes.

## 22. search

```text
search(query="população municipal Campinas")
```

Esperado: lista compacta de documentos do índice IBGE com `id`, `title` e `url`.

Uso correto: descoberta.

Não usar como substituto de uma consulta analítica que já possui ferramenta específica.

## 23. fetch

Após receber, por exemplo, um ID municipal de `search`:

```text
fetch(id="mun:3509502")
```

Esperado: documento gerado pelos adapters reais, incluindo hierarquia e dado populacional, com URL pública e procedência.

Erro típico: ID desconhecido → ausência explícita de documento.

---

# Casos de erro que devem falhar alto

## Parâmetro desconhecido

Exemplo incorreto:

```text
ibge_indicadores(indicador="populacao", periodo="2023")
```

Se o schema usa `periodos`, a chave singular `periodo` deve ser recusada. Ela não pode ser descartada silenciosamente.

## Agrupamento ambíguo

```text
agruparPor="Unidade"
```

Se mais de uma coluna casar, o servidor deve exigir o rótulo completo.

## Cursor inexistente

Enviar `cursor` em uma lista que não emitiu `nextCursor` deve retornar JSON-RPC `-32602`.

## Consulta grande demais

Quando a API de Agregados recusar o volume solicitado, a resposta deve sugerir reduzir períodos/localidades ou usar nível territorial mais agregado.

## Fonte temporariamente indisponível

Erros 429/5xx e falhas transitórias entram no mecanismo de retry. Esgotadas as tentativas, a falha deve ser exposta como falha upstream, sem inventar dado substituto.

---

# Teste manual recomendado para usuário externo

1. conectar ao endpoint;
2. listar ferramentas;
3. resolver um município por nome;
4. consultar um indicador simples;
5. consultar um tema censitário;
6. testar vizinhança;
7. consultar um recorte territorial;
8. testar uma pergunta de ranking com estatísticas;
9. provocar um erro de parâmetro desconhecido;
10. confirmar que cada resposta substantiva apresenta procedência.
