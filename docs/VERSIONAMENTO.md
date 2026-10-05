# Política de versionamento do CensoSenso

## Regra geral antes da versão 1.0

O CensoSenso usa a família `0.x.y` durante o estágio de protótipo e beta.

### `0.x.0` — incremento funcional

O segundo componente (`x`) aumenta quando há acréscimo material de funcionalidade ou expansão deliberada da superfície do produto.

Exemplos:

- nova ferramenta MCP;
- novo grupo de dados ou fonte;
- novo modo de análise;
- novo transporte suportado;
- novo pipeline de extração que passa a compor a superfície operacional;
- nova capacidade de autenticação/controle que altera o uso externo;
- expansão relevante de recortes ou contratos.

Exemplo:

```text
0.6.4 → 0.7.0
```

### `0.x.y` — ajuste ou melhoria de funcionalidade existente

O terceiro componente (`y`) aumenta quando a mudança corrige, endurece ou melhora uma funcionalidade já existente sem introduzir uma nova classe funcional.

Exemplos:

- correção de bug;
- melhoria de tratamento de erro;
- melhoria de desempenho;
- ajuste de cache/retry;
- refinamento de schema;
- melhoria de documentação;
- reforço de segurança sem mudança de modo de uso;
- atualização de snapshot ou fonte mantendo o mesmo contrato;
- testes adicionais;
- melhoria de algoritmo já existente.

Exemplo:

```text
0.6.0 → 0.6.1 → 0.6.2
```

## Beta

A família **0.9.x** é reservada ao beta público.

Ao entrar em `0.9.0`, a prioridade muda de expansão funcional para estabilização:

- compatibilidade;
- segurança;
- documentação;
- experiência de instalação;
- observabilidade;
- testes externos;
- desempenho;
- correções de contratos.

Novas funcionalidades relevantes durante o beta devem ser excepcionais e justificadas.

## Versão estável

A primeira versão considerada lançamento definitivo será:

```text
1.0.0
```

A família `1.x` corresponde ao produto estável público.

A política pós-1.0 poderá adotar SemVer convencional de forma explícita, com definição de compatibilidade e mudanças incompatíveis antes do primeiro release estável.

## Versão pública inicial

A versão pública inicial do protótipo é:

```text
0.6.0
```

Ela corresponde ao estado funcional anteriormente identificado internamente no laboratório como `6.0.0`.

Os números `4.x`, `5.x` e `6.x` encontrados no histórico do laboratório são **marcos internos anteriores à política pública de versionamento**. Eles não representam uma sequência pública de releases do CensoSenso.

## Fonte da verdade

A fonte principal da versão é:

```text
package.json
```

O hook:

```text
npm version <versão>
```

executa `scripts/sync-version.mjs` para sincronizar os manifestos que não conseguem derivar a versão automaticamente.

## Checklist de incremento

Antes de publicar uma nova versão:

1. classificar a mudança como funcional (`0.x.0`) ou melhoria/correção (`0.x.y`);
2. atualizar `package.json` por `npm version`;
3. sincronizar manifestos;
4. atualizar CHANGELOG;
5. executar `npm run gate:deploy`;
6. executar o gate territorial aplicável;
7. gerar/atualizar baseline de superfície quando houver mudança de contrato;
8. executar smoke STDIO e HTTP;
9. confirmar `/health` e `/status`;
10. criar tag/release somente depois dos gates verdes.

## Exemplos

| Situação | Antes | Depois |
|---|---:|---:|
| corrigir mensagem de erro | 0.6.0 | 0.6.1 |
| melhorar algoritmo de vizinhança sem mudar o contrato | 0.6.1 | 0.6.2 |
| adicionar nova ferramenta de dados | 0.6.2 | 0.7.0 |
| adicionar OAuth como nova capacidade pública | 0.7.3 | 0.8.0 |
| iniciar beta | 0.8.x | 0.9.0 |
| correção durante beta | 0.9.0 | 0.9.1 |
| primeiro lançamento estável | 0.9.x | 1.0.0 |
