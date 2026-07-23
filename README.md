# ResearchDino Lab

ResearchDino Lab is an AI research-orchestration laboratory for collecting papers,
reading and debating evidence, preserving approved knowledge, designing
experiments, and drafting manuscripts.

The product idea is intentionally visual: users should see a living laboratory
where papers, claims, ideas, experiments, and manuscript sections move through
rooms such as Collection Dock, Reading Bench, Debate Room, Leader Office,
Library, Strategy Room, Experiment Bay, and Writing Studio.

## Initial Goal

Build a local-first web app that can:

1. Ingest user-owned paper PDFs from a local folder.
2. Extract metadata, sections, claims, methods, results, and limitations.
3. Run agent discussions over the evidence.
4. Route outputs through a leader approval step.
5. Store approved knowledge in a searchable library.
6. Generate research ideas, experiment designs, and manuscript outlines.
7. Visualize the whole process as a laboratory map.

## Project Tracking

Milestones and active checklists are tracked in
[docs/milestones.md](docs/milestones.md).

## First MVP

- Local PDF folder registration.
- Paper cards moving through a laboratory workflow.
- Room-level status panels.
- Paper summary and claim extraction.
- Debate transcript generation.
- Leader approve/reject queue.
- Library view for approved notes and citations.
- Strategy view for hypothesis generation.
- Writing Studio for outline and draft sections.

## Proposed Stack

- Frontend: React or Next.js.
- Backend: Python FastAPI.
- Workers: Celery/RQ/Temporal-like orchestration, decided after prototype.
- Database: PostgreSQL with pgvector, or SQLite for the earliest local MVP.
- Vector search: pgvector or Qdrant.
- PDF parsing: PyMuPDF, pdfplumber, GROBID, OCR when needed.
- Local models: Ollama-compatible model provider.
- Optional external APIs: Crossref, OpenAlex, PubMed, Semantic Scholar, publisher APIs where licensed.

## Repo Status

This repo now contains the Laboratory Map web app, a local FastAPI/SQLite
backend, real local-PDF parsing with project/lab scoping, structured research
ledger records, and deterministic Reader/Debate/Strategy/Experiment workflow
actions. Writing Studio now stores a LaTeX-first manuscript project
(`main.tex` plus `references.bib`) generated only from Leader-approved Library
records, with guarded local PDF compilation when Tectonic or latexmk is
installed. Ollama-backed model execution and external metadata enrichment
remain in progress.

## Run The Web Prototype

```bash
cd apps/web
npm install
npm run dev
```

Without `VITE_API_BASE_URL` the UI stays in explicit demo mode. In API mode it
can register and parse local PDF folders; external publisher/API ingestion is
still license- and connector-gated.
