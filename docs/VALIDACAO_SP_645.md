# Validação dos 645 municípios paulistas

Data da execução validada: **5 de outubro de 2026**

Workflow: **SP 645 gate**

Job: `validate`

Resultado do job: **success**

## Objetivo

Validar de forma reproduzível o universo oficial dos municípios do Estado de São Paulo usado pelo CensoSenso e testar uma amostra determinística contra as ferramentas reais do servidor.

## Fonte

```text
https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios?orderBy=nome
```

Fonte declarada: **IBGE — API de Localidades**.

## Resultado

```json
{
  "total": 645,
  "estrutural_ok": true,
  "divergencias_globais": [],
  "divergencias_municipais": [],
  "amostra_total": 21,
  "amostra_ok": 21,
  "amostra_falhas": [],
  "sha256": "a215de0ed21d5538db07a35e65c8dcd9fb1c201491c1ee1f4d0aaaa757810d86",
  "promote": false
}
```

## Critérios estruturais

Cada registro deve atender a:

- código municipal com 7 dígitos;
- prefixo `35`;
- código único;
- nome não vazio;
- nome único na comparação normalizada em pt-BR;
- UF código 35, quando o campo está presente;
- UF sigla SP, quando o campo está presente;
- região código 3, Sudeste, quando o campo está presente.

O conjunto deve conter exatamente **645 registros**.

## Amostra determinística

A amostra inclui:

- São Paulo;
- Guararema;
- primeiro e último código;
- primeiro e último nome em ordenação alfabética;
- municípios nos quantis de código 10%, 25%, 50%, 75% e 90%;
- primeiro município de cada região intermediária observada;
- um município com nome acentuado;
- um município com nome composto.

Duplicidades são removidas por código e a amostra final é ordenada.

Na execução validada, a amostra final continha **21 municípios**.

## Validação das ferramentas reais

Para cada município da amostra foram executadas, em paralelo:

```text
ibge_geocodigo(codigo=...)
ibge_localidade(codigo=...)
```

As seguintes condições foram testadas:

- ausência de erro em `ibge_geocodigo`;
- ausência de erro em `ibge_localidade`;
- código devolvido por `ibge_geocodigo` igual ao código oficial;
- nome, quando retornado, igual ao nome oficial;
- código devolvido por `ibge_localidade` igual ao código oficial;
- nome, quando retornado, igual ao nome oficial;
- UF, quando retornada, igual a SP.

Resultado: **21/21 aprovados**.

## Artefatos gerados

O script `scripts/gate-sp-645.mjs` produz:

- `snapshot-candidato.json`;
- `meta.json`;
- `validacao-645.jsonl`;
- `amostra.json`;
- `amostra-resultados.json`;
- `resumo.json`.

## SHA-256

O snapshot da execução validada recebeu:

```text
a215de0ed21d5538db07a35e65c8dcd9fb1c201491c1ee1f4d0aaaa757810d86
```

Esse hash permite verificar que uma cópia do snapshot corresponde exatamente ao artefato validado.

## Interpretação

O gate demonstra que, na execução registrada:

1. a API oficial retornou os 645 municípios esperados;
2. não houve inconsistência estrutural detectada no universo paulista;
3. a amostra determinística passou integralmente pelas duas ferramentas territoriais reais;
4. não houve divergência de código, nome ou UF na amostra.

A validação não afirma que todas as 23 ferramentas foram executadas contra todos os 645 municípios. O gate combina validação estrutural integral do universo com execução real das ferramentas territoriais sobre uma amostra determinística, complementada pelos demais testes e gates do projeto.


## Evidência pública permanente

A execução 0.6.0 foi promovida para [`validation/sp/0.6.0/`](../validation/sp/0.6.0/), com CSV dos 645 municípios, metadados, resumo e resultados da amostra real.
