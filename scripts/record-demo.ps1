param(
  [int]$Seconds = 45,
  [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutFile) {
  $OutFile = Join-Path (Split-Path $PSScriptRoot -Parent) "demo-cctv.mp4"
}

function Resolve-Ffmpeg {
  $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages",
    "$env:ProgramFiles\ffmpeg",
    "${env:ProgramFiles(x86)}\ffmpeg",
    "C:\ffmpeg"
  ) | Where-Object { $_ -and (Test-Path $_) }

  foreach ($root in $candidates) {
    $hit = Get-ChildItem -Path $root -Filter ffmpeg.exe -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  throw "ffmpeg not found. Install with: winget install --id Gyan.FFmpeg -e"
}

$ffmpeg = Resolve-Ffmpeg
$outDir = Split-Path -Parent $OutFile
if ($outDir -and -not (Test-Path $outDir)) {
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

Write-Host "Recording desktop for $Seconds s -> $OutFile"
Write-Host "Using: $ffmpeg"

& $ffmpeg -y -f gdigrab -framerate 15 -i desktop -t $Seconds -c:v libx264 -pix_fmt yuv420p $OutFile
if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $OutFile)) {
  throw "Output file missing: $OutFile"
}

$item = Get-Item $OutFile
Write-Host "Done: $($item.FullName) ($([math]::Round($item.Length / 1MB, 2)) MB)"
