# Validação SP 645 — CensoSenso 0.6.0

Esta pasta contém a evidência pública permanente da validação dos **645 municípios do Estado de São Paulo** associada ao primeiro protótipo público do CensoSenso 0.6.0.

## Execução

- data/hora de extração: **2026-10-05T17:34:27.186Z**;
- fonte: **IBGE — API de Localidades**;
- URL: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios?orderBy=nome`;
- workflow: **SP 645 gate**;
- run: **#22**;
- artefato bruto: `sp-645-validation-22`;
- retenção do artefato bruto: 30 dias;
- resultado estrutural: **645/645 aprovados**;
- divergências globais: **0**;
- divergências municipais: **0**;
- amostra real: **21/21 aprovados**.

## Arquivos públicos

### `municipios-sp-645.csv`

Lista permanente dos 645 municípios, com:

- código IBGE;
- nome;
- status da validação estrutural.

Todos os 645 registros desta execução estão marcados como `OK`.

SHA-256 do CSV:

```text
0d0cfcaefa46d260c1b2ec58769d322a718abe87dd0257c9844dcdb3d6de158a
```

### `meta.json`

Metadados da fonte, extração, critérios, gerador e hash do snapshot normalizado.

### `resumo.json`

Resultado compacto da validação, incluindo totais e hashes.

### `amostra-resultados.json`

Resultado das chamadas reais de:

```text
ibge_geocodigo(codigo=...)
ibge_localidade(codigo=...)
```

para os 21 municípios da amostra determinística.

## Amostra determinística

A execução 0.6.0 validou chamadas reais para:

1. Adamantina — 3500105
2. Adolfo — 3500204
3. Aguaí — 3500303
4. Águas da Prata — 3500402
5. Águas de Santa Bárbara — 3500550
6. Agudos — 3500709
7. Altinópolis — 3501004
8. Alto Alegre — 3501103
9. Álvaro de Carvalho — 3501400
10. Américo Brasiliense — 3501707
11. Aparecida — 3502507
12. Arujá — 3503901
13. Barueri — 3505708
14. Dumont — 3514601
15. Guararema — 3518305
16. Marabá Paulista — 3528700
17. Ribeirão do Sul — 3543204
18. São Paulo — 3550308
19. Silveiras — 3552007
20. Zacarias — 3557154
21. Estiva Gerbi — 3557303

Todos os 21 registros retornaram `ok=true`, sem flags de divergência.

## Hashes

Snapshot normalizado validado:

```text
a215de0ed21d5538db07a35e65c8dcd9fb1c201491c1ee1f4d0aaaa757810d86
```

ZIP do artefato GitHub Actions:

```text
48fd0a46d417ec45475d16b2c579931155cb73768f2cf40518e14061ada59021
```

CSV público dos 645 municípios:

```text
0d0cfcaefa46d260c1b2ec58769d322a718abe87dd0257c9844dcdb3d6de158a
```

## O que ficou no artefato bruto

O ZIP do workflow contém seis arquivos:

- `snapshot-candidato.json`;
- `validacao-645.jsonl`;
- `meta.json`;
- `amostra.json`;
- `amostra-resultados.json`;
- `resumo.json`.

O snapshot bruto/normalizado possui todas as informações hierárquicas recebidas e normalizadas para os 645 municípios. O repositório público preserva uma representação mais simples e auditável em CSV, além dos metadados e da amostra real.

## Interpretação

A afirmação suportada por esta evidência é:

> Os 645 municípios paulistas foram validados estruturalmente contra a API oficial do IBGE, sem divergências detectadas, e uma amostra determinística de 21 municípios foi validada por chamadas reais às ferramentas `ibge_geocodigo` e `ibge_localidade`, com 21/21 aprovações.

Esta evidência **não** significa que todas as 23 ferramentas foram executadas para cada um dos 645 municípios.
