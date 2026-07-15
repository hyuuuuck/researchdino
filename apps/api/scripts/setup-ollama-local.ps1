param(
    [string]$Model = "qwen3.5:latest"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    throw "Ollama is not installed or is not available on PATH."
}

Write-Host "Pulling local Ollama model $Model ..."
ollama pull $Model
if ($LASTEXITCODE -ne 0) {
    throw "Failed to pull $Model."
}

Write-Host "ResearchDino local Ollama model is ready."
ollama list
