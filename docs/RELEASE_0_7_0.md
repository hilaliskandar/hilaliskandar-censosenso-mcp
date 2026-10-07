# CensoSenso MCP 0.7.0

Data: 7 de outubro de 2026.

## Síntese

A versão 0.7.0 inaugura a cartografia temática derivada no CensoSenso com a nova ferramenta `ibge_mapa`. A superfície pública passa de 23 para 24 ferramentas, em conformidade com a política de versionamento que reserva incrementos `0.x.0` para expansão funcional material.

## Nova ferramenta `ibge_mapa`

A ferramenta gera mapas coropléticos municipais em SVG combinando:

- valores de indicadores auditados do SIDRA;
- malha municipal oficial da API de Malhas do IBGE;
- classificação por quantis ou intervalos iguais;
- 2 a 7 classes;
- recortes de 2 a 50 municípios da mesma UF.

Indicadores iniciais:

- população estimada;
- população do Censo 2022;
- PIB;
- área;
- densidade;
- alfabetização;
- domicílios.

A resposta estruturada inclui valores por município, classes, cores, `bbox`, URLs das fontes e o SVG completo.

## Procedência

O mapa é explicitamente marcado como produto derivado. Os valores permanecem vinculados ao SIDRA e as geometrias à API oficial de Malhas. A classificação, a transformação para a viewport SVG, a legenda e a composição cartográfica são computadas pelo CensoSenso.

## Contratos e validação

A versão 0.7.0 atualiza:

- contagem pública de ferramentas para 24;
- contratos OpenAI/ChatGPT;
- testes de superfície e segurança;
- catálogo de evals;
- contrato de saída estruturada;
- gate de proveniência;
- testes do Worker;
- manifestos de versão e reprodutibilidade;
- baseline `surface-stdio-0.7.0.json`.

O baseline 0.6.0 permanece preservado como registro histórico da superfície anterior de 23 ferramentas.

## Limites desta primeira versão

Ainda não fazem parte de `ibge_mapa`:

- municípios de UFs diferentes no mesmo mapa;
- tiles;
- PNG;
- projeção cartográfica especializada;
- rotulagem automática de municípios.

Esses itens permanecem como evolução posterior da frente cartográfica.
