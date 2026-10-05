param(
  [string]$OutputDir = "docs/gates"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Normaliza a saída do processo nativo para UTF-8 no Windows PowerShell.
try {
  chcp 65001 | Out-Null
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  [Console]::OutputEncoding = $utf8
  $OutputEncoding = $utf8
}
catch {
  # A codificação não deve impedir o gate de executar.
}

if (-not (Test-Path "package.json")) {
  throw "Execute este script na raiz do repositório."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $OutputDir "integration-contracts-$stamp.log"
$reportPath = Join-Path $OutputDir "integration-contracts-$stamp.md"

$head = (git rev-parse HEAD).Trim()
$branchName = (git branch --show-current).Trim()
$nodeVersion = (node --version).Trim()
$npmVersion = (npm --version).Trim()
$startedAt = Get-Date
$runnerVersion = "3.0-runtime-only"

$coreTests = @(
  "tests/fontes-recortes-contract.integration.test.ts",
  "tests/catalog-contract.integration.test.ts",
  "tests/datasaude-contract.integration.test.ts",
  "tests/malhas-contract.integration.test.ts",
  "tests/vizinhos-contract.integration.test.ts",
  "tests/sidra-vazio.integration.test.ts"
)

$env:INTEGRATION_TESTS = "1"
$coreExitCode = 1

try {
  "IBGE Brasil MCP - gate de contratos em rede real" | Tee-Object -FilePath $logPath
  "Runner: $runnerVersion" | Tee-Object -FilePath $logPath -Append
  "Inicio: $($startedAt.ToString("o"))" | Tee-Object -FilePath $logPath -Append
  "Branch: $branchName" | Tee-Object -FilePath $logPath -Append
  "HEAD: $head" | Tee-Object -FilePath $logPath -Append
  "Node: $nodeVersion" | Tee-Object -FilePath $logPath -Append
  "npm: $npmVersion" | Tee-Object -FilePath $logPath -Append
  "" | Tee-Object -FilePath $logPath -Append

  # Executa por cmd.exe para que stderr do Vitest seja combinado com stdout
  # antes de chegar ao Windows PowerShell, evitando NativeCommandError.
  "=== GATE PRINCIPAL: contratos usados pelo runtime ===" |
    Tee-Object -FilePath $logPath -Append
  $coreCommand = "npx vitest run " + ($coreTests -join " ") + " 2>&1"
  & cmd.exe /d /s /c $coreCommand |
    Tee-Object -FilePath $logPath -Append
  $coreExitCode = $LASTEXITCODE

}
finally {
  Remove-Item Env:INTEGRATION_TESTS -ErrorAction SilentlyContinue
}

$finishedAt = Get-Date
$duration = $finishedAt - $startedAt

$coreStatus = if ($coreExitCode -eq 0) { "APROVADO" } else { "REPROVADO" }
$status = if ($coreExitCode -eq 0) { "APROVADO" } else { "REPROVADO" }

$report = @"
# Gate de contratos em rede real

- Data de inicio: $($startedAt.ToString("o"))
- Data de termino: $($finishedAt.ToString("o"))
- Duracao: $([Math]::Round($duration.TotalSeconds, 2)) s
- Branch: $branchName
- HEAD: $head
- Runner: $runnerVersion
- Node: $nodeVersion
- npm: $npmVersion
- Gate principal: **$coreStatus**
- Status operacional: **$status**
- Log integral: $logPath

## Escopo do gate principal

- fontes estaticas dos recortes;
- catalogo SIDRA;
- DataSaude;
- malhas administrativas;
- vizinhanca;
- SIDRA vazio.

## Classificacao obrigatoria de excecoes

1. regressao interna;
2. deriva de contrato da fonte oficial;
3. indisponibilidade externa;
4. bloqueio externo conhecido;
5. problema de ambiente local.

## Observacoes

Preencher apos a leitura do log. O processo retorna o exit code do gate principal.
O monitor experimental de WFS foi isolado na branch lab/wfs-geoservicos-monitor
e nao participa do gate operacional de main.
"@

Set-Content -Path $reportPath -Value $report -Encoding utf8

Write-Host ""
Write-Host "Relatorio: $reportPath"
Write-Host "Log: $logPath"
Write-Host "Status operacional: $status"

exit $coreExitCode
