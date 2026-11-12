param(
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
)

$ErrorActionPreference = 'Stop'
$serviceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = [System.IO.Path]::GetFullPath($DestinationPath)

if (-not (Test-Path -LiteralPath $destination -PathType Container)) {
    throw 'DestinationPath must be an existing, empty directory for an isolated Space checkout.'
}
if ((Get-ChildItem -LiteralPath $destination -Force | Select-Object -First 1) -ne $null) {
    throw 'DestinationPath must be empty; no files were copied.'
}

$files = @(
    @{ Source = 'Dockerfile.onnx'; Target = 'Dockerfile' },
    @{ Source = '.dockerignore'; Target = '.dockerignore' },
    @{ Source = 'requirements-onnx.txt'; Target = 'requirements-onnx.txt' },
    @{ Source = 'requirements-export.txt'; Target = 'requirements-export.txt' },
    @{ Source = 'LICENSE_REVIEW.md'; Target = 'LICENSE_REVIEW.md' },
    @{ Source = 'spaces/README.md'; Target = 'README.md' },
    @{ Source = 'app/__init__.py'; Target = 'app/__init__.py' },
    @{ Source = 'app/main.py'; Target = 'app/main.py' },
    @{ Source = 'app/model.py'; Target = 'app/model.py' },
    @{ Source = 'app/onnx_model.py'; Target = 'app/onnx_model.py' },
    @{ Source = 'scripts/download_model.py'; Target = 'scripts/download_model.py' },
    @{ Source = 'scripts/export_onnx.py'; Target = 'scripts/export_onnx.py' },
    @{ Source = 'scripts/validate_artifacts.py'; Target = 'scripts/validate_artifacts.py' },
    @{ Source = 'third_party/AGPL-3.0.txt'; Target = 'third_party/AGPL-3.0.txt' }
)

foreach ($file in $files) {
    $sourcePath = Join-Path $serviceRoot $file.Source
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Required source file is missing: $($file.Source)"
    }
}

foreach ($file in $files) {
    $targetPath = Join-Path $destination $file.Target
    $targetDirectory = Split-Path -Parent $targetPath
    if (-not (Test-Path -LiteralPath $targetDirectory -PathType Container)) {
        New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    }
    Copy-Item -LiteralPath (Join-Path $serviceRoot $file.Source) -Destination $targetPath
}

Write-Output "Prepared $($files.Count) allowlisted files in $destination"
