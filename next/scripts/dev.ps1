[CmdletBinding()]
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$agentRoot = Join-Path $repoRoot 'next\agent'
$homeRoot = Join-Path $env:LOCALAPPDATA 'TradingBuddy\hermes'
$desktopData = Join-Path $env:LOCALAPPDATA 'TradingBuddy\desktop'
$companionWorkspace = Join-Path $env:LOCALAPPDATA 'TradingBuddy\workspace'
$petSource = Join-Path $repoRoot 'next\pets\trading-buddy-default'
$petTarget = Join-Path $homeRoot 'pets\trading-buddy-default'
$soulSource = Join-Path $repoRoot 'next\packages\trading-buddy-soul\SOUL.md'
$soulTarget = Join-Path $homeRoot 'SOUL.md'
$skillSource = Join-Path $repoRoot 'next\skills\trader-companion'
$skillTarget = Join-Path $homeRoot 'skills\trader-companion'
$configPath = Join-Path $homeRoot 'config.yaml'
$envPath = Join-Path $homeRoot '.env'

if (-not $env:LOCALAPPDATA) {
  throw 'LOCALAPPDATA is required for the isolated Trading Buddy development profile.'
}

Push-Location $repoRoot
try {
  corepack pnpm next:pet:build
} finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $homeRoot, $desktopData, $companionWorkspace, $petTarget, $skillTarget | Out-Null
Copy-Item -Force -Path (Join-Path $petSource '*') -Destination $petTarget -Recurse
Copy-Item -Force -Path (Join-Path $skillSource '*') -Destination $skillTarget -Recurse

if (-not (Test-Path -LiteralPath $soulTarget)) {
  Copy-Item -LiteralPath $soulSource -Destination $soulTarget
}

if (-not (Test-Path -LiteralPath $envPath)) {
  @'
# Trading Buddy stores provider credentials here only after explicit user configuration.
'@ | Set-Content -LiteralPath $envPath -Encoding utf8
}

if (-not (Test-Path -LiteralPath $configPath)) {
  $preferredModels = @('qwen3:8b', 'qwen3.5:9b', 'llama3.1:8b-instruct-q4_K_M', 'llama3.1:8b')
  $installedModels = @()
  if (Get-Command ollama -ErrorAction SilentlyContinue) {
    $installedModels = @(ollama list 2>$null | Select-Object -Skip 1 | ForEach-Object {
      ($_ -split '\s+')[0]
    })
  }
  $localModel = $preferredModels | Where-Object { $installedModels -contains $_ } | Select-Object -First 1
  $modelConfig = if ($localModel) {
    @"
model:
  default: $localModel
  provider: custom
  base_url: http://localhost:11434/v1
  context_length: 65536
  ollama_num_ctx: 65536
"@
  } else {
    ''
  }

  @"
_config_version: 32
$modelConfig
fallback_providers: []
toolsets:
  - trading-buddy-companion
display:
  pet:
    enabled: true
    slug: trading-buddy-default
    render_mode: auto
    scale: 0.5
"@ | Set-Content -LiteralPath $configPath -Encoding utf8
}

if (-not $SkipInstall) {
  if (-not (Test-Path -LiteralPath (Join-Path $agentRoot 'node_modules'))) {
    Push-Location $agentRoot
    try {
      npm install
    } finally {
      Pop-Location
    }
  }

  $venvPython = Join-Path $agentRoot 'venv\Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $venvPython)) {
    Push-Location $agentRoot
    try {
      uv venv venv --python 3.12
      uv pip install --python $venvPython -e '.[all,dev]'
    } finally {
      Pop-Location
    }
  }
}

$env:HERMES_HOME = $homeRoot
$env:HERMES_DESKTOP_USER_DATA_DIR = $desktopData
$env:HERMES_DESKTOP_HERMES_ROOT = $agentRoot
$env:HERMES_DESKTOP_CWD = $companionWorkspace
$env:HERMES_TUI_TOOLSETS = 'trading-buddy-companion'
$env:TRADING_BUDDY_COMPANION = '1'

Write-Host "Trading Buddy home: $homeRoot"
Write-Host 'Companion Safe Mode: ordinary conversation exposes no callable tools.'
Write-Host 'Press Ctrl+Shift+Space to show or hide the main window.'

Push-Location $agentRoot
try {
  npm run dev --workspace apps/desktop
} finally {
  Pop-Location
}
