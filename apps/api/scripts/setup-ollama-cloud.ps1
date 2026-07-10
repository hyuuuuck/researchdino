param(
    [switch]$SignIn
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    throw "Ollama is not installed or is not available on PATH."
}

if ($SignIn) {
    ollama signin
    if ($LASTEXITCODE -ne 0) {
        throw "Ollama sign-in did not complete."
    }
}

$models = @(
    "gpt-oss:20b-cloud",
    "qwen3.5:cloud",
    "gpt-oss:120b-cloud",
    "nemotron-3-super:cloud"
)

foreach ($model in $models) {
    Write-Host "Registering $model ..."
    ollama pull $model
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to register $model. Run 'ollama signin' and retry."
    }
}

Write-Host "ResearchDino Ollama Cloud models are registered."
ollama list
