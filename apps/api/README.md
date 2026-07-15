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

The default runtime is now local Ollama through the local Ollama API. It does
not silently fall back to template output when Ollama is unavailable. Every
model call is persisted as an `AgentRun` and every validated response as an
`AgentMessage`.

Default deputy placement:

- All deputies currently use the local `qwen3.5:latest` model.
- Each role has its own environment variable so roles can be split across installed local models later.

The Debate action executes these handoffs:

1. Critic and Librarian run in parallel over Reader evidence.
2. Strategist and Experiment run in parallel over both round-one outputs.
3. Coordinator merges all disagreements and proposals.
4. Leader deputy performs a non-binding pre-review.
5. The human Leader remains the only approval and Library-storage authority.

### Local Ollama Setup

Install Ollama locally, then pull the configured model on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-ollama-local.ps1
```

The app calls only `http://127.0.0.1:11434/api/chat`. Remote Ollama endpoints
and API keys are disabled by the runtime.

Runtime inspection endpoints:

- `GET /model-runtime`
- `GET /agent-runs`
- `GET /agent-messages`
- `GET /research-runs`
- `POST /research-runs`
- `POST /research-runs/{run_id}/resume`
- `GET /metadata/lookup?doi=...&provider=crossref|openalex|both`

P0 reliability behavior:

- Reader evidence is re-checked against stored PDF text. Exact or whitespace-normalized matches are `verified`; paraphrases are `unverified`.
- A claim or debate without verified evidence is held for Leader review.
- Research runs persist phase checkpoints so completed phases can be reused after a provider failure or process restart.
- Crossref and OpenAlex adapters return DOI metadata only. Publisher full text still requires the user's permitted account or institutional access.

`RESEARCHDINO_AGENT_RUNTIME=deterministic` exists only for offline regression
tests. It should not be used for real research runs.

If a model call returns HTTP 429, the signed-in Ollama account has exhausted its
current usage allowance. Model registration can still appear healthy in
`/model-runtime`; the failed invocation is stored in `/agent-runs` with the
provider error instead of generating fallback research content.

## Structured Research Ledger

Pipeline actions also persist normalized research records behind the workflow
cards:

- `GET /claims`
- `GET /evidence`
- `GET /debate-sessions`
- `GET /hypotheses`
- `GET /experiment-plans`
