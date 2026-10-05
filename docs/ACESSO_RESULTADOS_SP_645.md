# Como acessar os resultados da validação dos 645 municípios de São Paulo

O CensoSenso mantém um gate específico para validar o universo oficial dos municípios paulistas.

## Onde encontrar

No repositório de desenvolvimento, abra:

```text
Actions → SP 645 gate → execução desejada → Artifacts
```

Cada execução concluída publica um artefato com nome semelhante a:

```text
sp-645-validation-<número-da-execução>
```

Os artefatos ficam disponíveis por **30 dias** a partir da execução.

## Conteúdo do artefato

### `snapshot-candidato.json`

Contém o snapshot completo dos **645 municípios** retornados pela API oficial do IBGE na execução.

É o arquivo mais apropriado para:

- inspecionar município por município;
- conferir códigos e nomes;
- reproduzir o universo validado;
- comparar uma execução com outra;
- recalcular o SHA-256.

### `validacao-645.jsonl`

Contém a validação estrutural registro a registro.

Cada linha corresponde a um município e registra os resultados dos testes estruturais aplicados ao registro.

É o arquivo mais apropriado para auditoria individual.

### `meta.json`

Contém metadados da execução, incluindo:

- fonte consultada;
- instante da execução;
- URL oficial;
- versão/estrutura aplicável;
- hash do snapshot, quando produzido.

### `amostra.json`

Lista a amostra determinística usada para executar chamadas reais às ferramentas do servidor.

A amostra não é aleatória. Ela é construída a partir de:

- São Paulo;
- Guararema;
- extremos por código;
- extremos por nome;
- quantis de código;
- regiões intermediárias;
- nome acentuado;
- nome composto.

### `amostra-resultados.json`

Contém o resultado das chamadas reais realizadas para cada município da amostra:

```text
ibge_geocodigo(codigo=...)
ibge_localidade(codigo=...)
```

É o arquivo indicado para conferir, município por município, se as duas ferramentas retornaram código, nome e UF coerentes com o registro oficial.

### `resumo.json`

Síntese final da execução.

Exemplo de resultado da execução validada em 5 de outubro de 2026:

```json
{
  "total": 645,
  "estrutural_ok": true,
  "divergencias_globais": [],
  "divergencias_municipais": [],
  "amostra_total": 21,
  "amostra_ok": 21,
  "amostra_falhas": [],
  "sha256": "dc6e4eebffb4d755d8899eadae4ce876e565506b0cce5657f08a2835e290acc7"
}
```

## Como interpretar corretamente

O gate combina dois níveis de teste.

### 1. Universo completo

Os **645 municípios** passam por validação estrutural:

- quantidade esperada;
- código de 7 dígitos;
- prefixo de São Paulo;
- unicidade;
- nome;
- UF;
- região.

### 2. Amostra determinística

Uma amostra de municípios executa as ferramentas reais.

Isso significa que a afirmação correta é:

> Os 645 municípios foram validados estruturalmente e uma amostra determinística foi validada por chamadas reais às ferramentas territoriais.

Não significa que todas as 23 ferramentas foram executadas 645 vezes.

## Reproduzir localmente

```bash
npm ci
npm run gate:sp-645
```

Os artefatos serão gravados em:

```text
artifacts/sp-645/
```

Cada execução cria um diretório próprio.

## Fonte oficial

A referência usada pelo gate é:

```text
https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios?orderBy=nome
```

## Evidência consolidada

Consulte também:

- [VALIDACAO_SP_645.md](VALIDACAO_SP_645.md)
- [RELEASE_0_6_0.md](RELEASE_0_6_0.md)
- [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
