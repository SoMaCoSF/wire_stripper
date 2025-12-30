Param(
  [string]$Dest = (Join-Path $PSScriptRoot "..\repos")
)

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$targets = @(
  @{ name = "claude-code-plugin"; url = "https://github.com/browserbase/claude-code-plugin.git" },
  @{ name = "browser-privacy-proxy"; url = "https://github.com/SoMaCoSF/browser-privacy-proxy.git" }
)

foreach ($t in $targets) {
  $path = Join-Path $Dest $t.name
  if (Test-Path $path) {
    Write-Host "Skipping (exists): $path"
    continue
  }
  Write-Host "Cloning $($t.url) -> $path"
  git clone $t.url $path
}

Write-Host "Done. Populate DMBT repo manually if private."