# P0 Implementation Status

Date: 2026-07-14

## Completed

- Evidence excerpts are re-matched against stored PDF page text.
- Exact and whitespace-normalized matches are marked `verified`; paraphrases are `unverified`.
- Claims and debate packets without verified evidence are held for Leader review.
- `ResearchRun` records persist status, phase, errors, checkpoints, and resume counts.
- Background research runs and phase resume are available through the API.
- Crossref and OpenAlex DOI metadata-only adapters are available through `GET /metadata/lookup`.
- Ollama Cloud is the configured runtime with four registered Cloud tags and no missing model tags.

## Important Runtime Boundary

This configuration does not download or require a local research model. Agents use the signed-in local Ollama proxy to reach Ollama Cloud. The account allowance still controls live inference; an exhausted quota is surfaced as a provider error and never replaced with fabricated research output.

## Still Required Before Real Research Operations

- Publisher-specific full-text connectors for permitted Nature, Science/AAAS, and Elsevier access.
- Library full-text search and retrieval with approval and source-locator filters.
- True multi-round debate turns with Reader response/correction turns.
- Experiment result ingestion and hypothesis update loop.
- Manuscript sentence-level citation audit and export.
