Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Import-WorkerEnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()

        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $separatorIndex = $trimmed.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $name = $trimmed.Substring(0, $separatorIndex).Trim()
        $value = $trimmed.Substring($separatorIndex + 1).Trim()

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $existing = (Get-Item "Env:$name" -ErrorAction SilentlyContinue).Value
        if ([string]::IsNullOrWhiteSpace($existing)) {
            Set-Item "Env:$name" $value
        }
    }
}

$workerEnvPath = Join-Path $PSScriptRoot ".env.worker"
Import-WorkerEnvFile -Path $workerEnvPath
$defaultControlPlaneUrl = "https://operations.getaxiom.ca"

if ([string]::IsNullOrWhiteSpace($env:APP_BASE_URL)) {
    $env:APP_BASE_URL = $env:CONTROL_PLANE_URL
}

if ([string]::IsNullOrWhiteSpace($env:APP_BASE_URL)) {
    $env:APP_BASE_URL = $defaultControlPlaneUrl
}

if ([string]::IsNullOrWhiteSpace($env:CONTROL_PLANE_URL)) {
    $env:CONTROL_PLANE_URL = $env:APP_BASE_URL
}

if ([string]::IsNullOrWhiteSpace($env:WORKER_NAME)) {
    $env:WORKER_NAME = "local-worker"
}

if ([string]::IsNullOrWhiteSpace($env:AGENT_NAME)) {
    $env:AGENT_NAME = $env:WORKER_NAME
}

$required = @("APP_BASE_URL", "AGENT_SHARED_SECRET")
foreach ($name in $required) {
    if ([string]::IsNullOrWhiteSpace((Get-Item "Env:$name" -ErrorAction SilentlyContinue).Value)) {
        throw "Missing required environment variable '$name'. Create a local .env.worker file from .env.worker.example or set it in your shell."
    }
}

$workerProcess = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "worker") -PassThru -NoNewWindow
$pidFile = Join-Path $PSScriptRoot ".worker.pid"
Set-Content -LiteralPath $pidFile -Value $workerProcess.Id -NoNewline

try {
    Wait-Process -Id $workerProcess.Id
} finally {
    if (Test-Path -LiteralPath $pidFile) {
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
}
