# ResearchDino Lab API

Local FastAPI backend for the ResearchDino Lab MVP.

## Run

```bash
cd apps/api
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API initializes a local SQLite database at `apps/api/data/researchdino.sqlite3`
and seeds demo workflow data when the database is empty.

PyMuPDF is required for real PDF text extraction. A successful scan stores PDF
metadata, DOI candidates, full text, page-level text offsets, and a Reader queue
card. Rescanning the same file in the same project/lab updates the existing
record instead of duplicating it; another project/lab receives an isolated card.

Paper ingest endpoints:

- `POST /ingest/folder`: register a local folder for one project/lab.
- `POST /ingest/scan`: scan, parse, deduplicate, and queue local PDFs.
- `GET /papers`: list ingested PDF records.
- `GET /papers/{paper_id}`: inspect one PDF record and its extracted metadata.
- `GET /papers/{paper_id}/text`: inspect full parsed text and page offsets.

Run the ingest regression tests from the repository root:

```bash
py -3.11 -m unittest discover -s apps/api/tests -v
```

## Connect The Web App

Create `apps/web/.env.local` with:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then run the web app:

```bash
cd apps/web
npm run dev
```

Without `VITE_API_BASE_URL`, the web app stays in explicit demo mode.

## Agent Action Scaffold

The MVP exposes `POST /agent-actions` for local deterministic workflow actions:

- `run_reader`: move a Paper Card into Reading Bench and create a Debate Room card.
- `run_debate`: consolidate debate outputs, route the card to Leader Office, and create Strategy / Experiment follow-up cards.
- `design_experiment`: create an Experiment Bay protocol skeleton from a hypothesis.
- `draft_manuscript`: create a Writing Studio outline from an approved source card.
- `run_research_pipeline`: advance a Paper or Debate Card through Reader/Debate/Strategy/Experiment handoffs into a Leader review packet. It stops before Library storage; Leader approval is still required.

These actions do not call an LLM yet. They create traceable workflow state so
Ollama or remote model deputies can be wired into the same action boundary later.

## Structured Research Ledger

Pipeline actions also persist normalized research records behind the workflow
cards:

- `GET /claims`
- `GET /evidence`
- `GET /debate-sessions`
- `GET /hypotheses`
- `GET /experiment-plans`
