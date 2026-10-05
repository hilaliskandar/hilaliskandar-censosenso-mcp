param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Delegating to the cross-platform EOL normalizer..."
node scripts/normalize-eol.mjs src
if ($LASTEXITCODE -ne 0) {
  throw "EOL normalization failed."
}

npm run eol:check
if ($LASTEXITCODE -ne 0) {
  throw "EOL check failed after normalization."
}
