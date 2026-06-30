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

PyMuPDF is required for real PDF text extraction. Without it, folder scanning
still registers PDFs, hashes files, and creates Paper Cards, but reports text
extraction as unavailable.

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
