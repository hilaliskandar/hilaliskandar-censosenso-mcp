# CensoSenso MCP

**Servidor MCP para consulta e análise de dados oficiais do IBGE com procedência reproduzível, 23 ferramentas e acesso remoto.**

O CensoSenso MCP é um projeto independente voltado à consulta, comparação e análise de dados públicos oficiais do Instituto Brasileiro de Geografia e Estatística (IBGE) por meio do Model Context Protocol.

O projeto reúne ferramentas para localidades, Censo Demográfico, SIDRA, indicadores municipais, economia, saúde, saneamento, geografia e recortes territoriais, com respostas estruturadas e rastreáveis.

## Protótipo público 1

O primeiro lançamento público é experimental, somente leitura e disponibilizado sem SLA.

**Endpoint MCP remoto:**

```text
https://censosenso.poderdapalavra.org/mcp
```

O protótipo inicial é oferecido pelo transporte Streamable HTTP. O pacote npm ainda não faz parte deste lançamento.

## Princípios

- uso prioritário de fontes oficiais;
- preservação de fonte, período, URL e vintage sempre que aplicável;
- diferenciação entre dados observados, cálculos derivados e limitações da fonte;
- contratos MCP reproduzíveis;
- snapshots oficiais versionados quando uma fonte externa não é operacionalmente confiável;
- testes e gates antes de alterações de superfície.

## Independência e atribuição

O CensoSenso é uma linha independente de desenvolvimento baseada em parte no projeto aberto **IBGE Brasil MCP / ibge-br-mcp**, de **Sidney da Silva Pereira Bissoli**, distribuído sob licença MIT.

O projeto preserva a atribuição e a licença do código de origem. As modificações e contribuições específicas do CensoSenso são de **Carlos Alexandre Gomes**.

Consulte [NOTICE.md](NOTICE.md) para a linhagem técnica e as atribuições de terceiros.

## Licença

Código sob licença MIT.

- Copyright (c) 2026 Carlos Alexandre Gomes <hilaliskandar@gmail.com>
- Portions Copyright (c) 2024 Sidney Bissoli

Os dados consultados permanecem sujeitos aos termos e condições das respectivas fontes oficiais.

## Aviso institucional

O CensoSenso é um projeto independente. Não é um produto oficial do IBGE e não implica endosso do Instituto Brasileiro de Geografia e Estatística.

## Estado do lançamento

A árvore completa homologada do CensoSenso 6.0.0 será publicada neste repositório após a conclusão do gate do release candidate público.
