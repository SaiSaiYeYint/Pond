$ErrorActionPreference = "Stop"

$node = "C:\Users\saisa\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$server = Join-Path $PSScriptRoot "server.js"

if (-not (Test-Path $node)) {
  throw "Bundled Node was not found at $node"
}

if (-not (Test-Path (Join-Path $PSScriptRoot ".env"))) {
  Write-Host "Missing .env file."
  Write-Host "Copy .env.example to .env, then add OPENAI_API_KEY or ANTHROPIC_API_KEY."
  exit 1
}

& $node $server
