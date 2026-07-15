# P0 Implementation Status

Date: 2026-07-14

## Completed

- Evidence excerpts are re-matched against stored PDF page text.
- Exact and whitespace-normalized matches are marked `verified`; paraphrases are `unverified`.
- Claims and debate packets without verified evidence are held for Leader review.
- `ResearchRun` records persist status, phase, errors, checkpoints, and resume counts.
- Background research runs and phase resume are available through the API.
- Crossref and OpenAlex DOI metadata-only adapters are available through `GET /metadata/lookup`.
- Local Ollama is the configured runtime. All deputies currently share `qwen3.5:latest` so the first working path needs only one local model.

## Important Runtime Boundary

This configuration does not use remote model endpoints or API keys. Agents call only the local Ollama API at `http://127.0.0.1:11434`. If the local model is missing or Ollama is stopped, the runtime reports that state and never replaces it with fabricated research output.

## Still Required Before Real Research Operations

- Publisher-specific full-text connectors for permitted Nature, Science/AAAS, and Elsevier access.
- Library full-text search and retrieval with approval and source-locator filters.
- True multi-round debate turns with Reader response/correction turns.
- Experiment result ingestion and hypothesis update loop.
- Manuscript sentence-level citation audit and export.
