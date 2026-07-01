# ResearchDino Lab Milestones

This document is the project tracker. Update it whenever a milestone starts,
finishes, changes scope, or reveals a blocker.

## Tracking Rules

- Keep demo/mock work clearly labeled.
- Do not mark PDF, agent, DB, or API features complete unless they are actually implemented and verified.
- Record validation commands or screenshots for UI-sensitive work.
- Current MVP target is desktop web. Mobile viewport checks are optional sanity checks, not acceptance criteria.
- Human approval remains mandatory before generated research claims enter the Library.
- Claims without evidence/source trace stay provisional.

## Status Legend

- `[x]` Done and verified.
- `[~]` In progress.
- `[ ]` Not started.
- `[!]` Blocked or needs user decision.

## Milestone Overview

- `[x]` M0: Project Seed
- `[x]` M1: Laboratory UI Foundation
- `[x]` M2: Workflow State Model
- `[x]` M3: Local Backend MVP
- `[~]` M4: Local PDF Ingest MVP
- `[~]` M5: Reader Agent Pipeline
- `[~]` M6: Debate + Leader Gate
- `[ ]` M7: Library + Retrieval
- `[ ]` M8: Strategy / Experiment / Writing Studio
- `[~]` M9: External Metadata / Publisher Integration

## M0: Project Seed

Status: Done.

- `[x]` Create repository.
- `[x]` Add initial concept documentation.
- `[x]` Scaffold Vite + React + TypeScript web app.
- `[x]` Add initial Laboratory Map prototype.
- `[x]` Add demo workflow state.
- `[x]` Verify web build with `npm.cmd run build`.

Verification:

- `npm.cmd install`: passed.
- `npm.cmd run build`: passed.
- Dev server responded with HTTP 200 at `http://127.0.0.1:5173`.

## M1: Laboratory UI Foundation

Status: Done.

Goal: make the laboratory workflow understandable, stable, and visually clean
before attaching real PDF or agent pipelines.

- `[x]` Render Laboratory Map as the primary process visualization.
- `[x]` Render room nodes for Search Dock, Reading Bench, Critic Desk, Leader Office, Coordinator, Library, Strategy Room, Experiment Bay, and Writing Studio.
- `[x]` Render agent Dino avatars for all initial agent roles.
- `[x]` Render workflow cards for paper, claim, hypothesis, experiment, and manuscript items.
- `[x]` Add Detail Panel for selected rooms and cards.
- `[x]` Add Agent Log Panel.
- `[x]` Add Leader Review Panel with approve, reject, re-analysis, and send-to-library actions.
- `[x]` Fix room/card text overflow and footer collision in the map.
- `[x]` Verify desktop map layout by screenshot inspection.
- `[x]` Verify narrow viewport does not catastrophically break the page shell. Not a mobile MVP target.
- `[x]` Improve room visual hierarchy so each room is immediately distinguishable.
- `[x]` Improve flow lines and direction labels.
- `[x]` Rework Laboratory Map from a linear pipeline into a Leader/Coordinator network flow.
- `[x]` Add active-flow highlighting and normalize Library knowledge-line styling.
- `[x]` Add clearer active/waiting/blocked visual states without relying only on text.
- `[x]` Add selected-card highlight that is more visible inside the map.
- `[x]` Add empty-room visual state that does not feel broken.
- `[x]` Add demo-mode banner/control so mock data cannot be confused with real extraction.
- `[x]` Add ResearchDino Lab brand logo, favicon, and app icon assets.
- `[x]` Replace generic Dino avatar with role-specific Dino assets.
- `[x]` Add animated Meeting Room window for active agent collaboration.
- `[x]` Rework Meeting Room from a conveyor-like stage into a readable Coordinator Table layout.
- `[x]` Replace rough Debate Room sketch with the provided line-art Debate Room asset and wire it to live debate card data.
- `[x]` Add three line-art activity scene types each for Reading Bench, Debate Room, Strategy Room, and Experiment Bay.
- `[x]` Reframe the first viewport as a ResearchDino OS dashboard with sidebar navigation, top controls, system health, map legend, and global queue.
- `[x]` Clarify the Debate -> Strategy -> Experiment Bay handoff as an active literature-grounded experiment strategy flow.
- `[x]` Document the UI component contract for backend integration.

Current verification:

- `npm.cmd run build`: passed after layout fixes.
- Chrome headless desktop screenshot inspected at `1600x1000`.
- Chrome headless desktop screenshot inspected at `1500x850` after room hierarchy pass.
- Chrome headless desktop screenshot inspected at `1500x850` after flow label pass.
- Chrome headless desktop screenshot inspected at `1500x850` after state visual pass.
- Chrome headless desktop click screenshot inspected at `1500x850` after selected-card highlight pass.
- Chrome headless desktop screenshot inspected at `1500x850` after empty-room state pass.
- Chrome headless desktop screenshot inspected at `1500x850` after demo-mode banner pass.
- Chrome headless desktop screenshot inspected at `1500x1250` after role-specific Dino and Meeting Room pass.
- Browser animation inspection verified `board-draw`, `paper-slide`, `dot-pulse`, `room-bob`, and `bubble-pop` animations.
- Chrome headless desktop screenshot inspected at `1500x1050` after Leader/Coordinator network flow pass.
- `npm.cmd run build` and `python -m compileall app` passed after Leader/Coordinator network flow pass.
- Chrome headless desktop screenshot inspected at `1500x1650` after Meeting Room table-layout pass.
- Chrome headless desktop screenshot inspected at `1500x1050` after active-flow and room-description cleanup pass.
- Chrome headless desktop screenshot inspected at `1500x2300` after Debate Room reference-asset pass.
- Chrome headless desktop screenshot inspected at `1500x3000` after four-room scene type gallery pass.
- Chrome headless desktop screenshot inspected at `1680x1300` after ResearchDino OS dashboard pass.
- Chrome headless desktop screenshot inspected at `1680x1300` after activating the Experiment Strategy handoff.
- `npm.cmd run build`: passed after room scene type gallery pass.
- `npm.cmd run build`: passed after ResearchDino OS dashboard pass.
- UI component contract documented in `docs/ui-component-contract.md`.

## M2: Workflow State Model

Status: Done.

Goal: define the durable state model that can support UI, backend, approval,
Library storage, and future PDF/agent work.

- `[x]` Define shared fields for `WorkflowCard`.
- `[x]` Define `Paper`.
- `[x]` Define `PaperMetadata`.
- `[x]` Define `PaperSection`.
- `[x]` Define `Claim`.
- `[x]` Define `Evidence`.
- `[x]` Define `AgentRun`.
- `[x]` Define `AgentMessage`.
- `[x]` Define `DebateSession`.
- `[x]` Define `LeaderDecision`.
- `[x]` Define `LibraryEntry`.
- `[x]` Define `ResearchGap`.
- `[x]` Define `Hypothesis`.
- `[x]` Define `ExperimentPlan`.
- `[x]` Define `ManuscriptDraft`.
- `[x]` Mark which entities require user approval before reuse.
- `[x]` Decide which types live in frontend only, backend only, or shared package.
- `[x]` Add Ollama deputy model assignment fields for room-level agent orchestration.
- `[x]` Add paper source records for local PDFs, DOI/metadata sources, and license-gated publishers.

Verification:

- State model documented in `docs/state-model.md`.
- Draft durable domain types added in `apps/web/src/types/domain.ts`.
- UI component contract documented in `docs/ui-component-contract.md`.
- Decision: do not introduce `packages/shared` until FastAPI schemas exist.
- `npm.cmd run build`: passed after domain type additions.
- `npm.cmd run build` and `python -m compileall .\apps\api\app` passed after Ollama deputy assignment additions.
- `npm.cmd run build` and `python -m compileall .\apps\api\app` passed after paper source registry additions.

## M3: Local Backend MVP

Status: Done.

Goal: move demo state into a local API and persist Leader decisions.

- `[x]` Scaffold `apps/api` with FastAPI.
- `[x]` Add local development run instructions.
- `[x]` Choose initial persistence: SQLite for MVP unless user decides otherwise.
- `[x]` Add `/rooms` endpoint.
- `[x]` Add `/cards` endpoint.
- `[x]` Add `/agent-logs` endpoint.
- `[x]` Add `/leader-decisions` endpoint.
- `[x]` Add `/library` endpoint.
- `[x]` Persist approve/reject/re-analysis/send-to-library decisions.
- `[x]` Connect web app to API.
- `[x]` Keep demo mode separate from real API mode.

Verification:

- `python -m compileall app`: passed.
- API smoke test: `/health`, `/rooms`, `/cards`, `/leader-decisions`, and `/library` passed.
- Leader decision persistence verified against SQLite during API smoke test.
- `npm.cmd run build`: passed after API adapter integration.
- Chrome headless desktop screenshot inspected at `1500x850` in API mode.
- Decision: SQLite is the first MVP persistence layer.

## M4: Local PDF Ingest MVP

Status: In progress. Blocked only on PyMuPDF installation for text extraction.

Goal: read user-owned local PDFs and create real Paper Cards.

- `[x]` Add local folder path registration.
- `[x]` Scan PDF files without deleting or moving user files.
- `[x]` Store file path, file name, size, hash, and scan status.
- `[x]` Create Paper Cards in Collection Dock.
- `[!]` Extract text with PyMuPDF.
- `[x]` Capture extraction errors as Error Cards.
- `[x]` Keep raw PDFs local.
- `[x]` Add clear UI distinction between scanned files and parsed papers.

Verification:

- Folder path is provided through the API-mode PDF Ingest panel and `/ingest/folder`.
- `python -m compileall app`: passed after ingest endpoint additions.
- API scan smoke test passed with a temporary local PDF file.
- Scan test verified folder registration, PDF count, paper card creation, and `/papers` persistence.
- Current Python environment does not have `fitz` / PyMuPDF installed, so text extraction reports `parserAvailable=false`.
- `npm.cmd run build`: passed after PDF Ingest panel integration.
- Chrome headless desktop screenshot inspected at `1500x1200` after PDF Ingest panel pass.

Open blocker:

- `[!]` Install or approve adding PyMuPDF before marking text extraction complete.

## M5: Reader Agent Pipeline

Status: In progress. Deterministic local pipeline skeleton is implemented; real LLM/Ollama reading is not wired yet.

Goal: convert a parsed paper into structured, traceable reading outputs.

- `[~]` Define Reader output JSON schema.
- `[~]` Extract abstract, methods, results, limitations.
- `[x]` Extract candidate claims through the local Reader action scaffold.
- `[x]` Extract evidence candidates through the local Reader action scaffold.
- `[ ]` Mark unsupported or weakly supported claims as provisional.
- `[x]` Move Paper Cards from Reading Bench to Debate Room when ready.
- `[x]` Log Reader Agent runs.
- `[x]` Confirm first LLM provider: local Ollama.
- `[x]` Assign the local Ollama model reference to current deputies across Search, Reader, Critic, Librarian, Leader, Coordinator, Strategist, Experiment, and Writer rooms.

Verification:

- `POST /agent-actions` with `run_reader` creates a Debate Room claim card from a Paper Card.
- `npm.cmd run build` and `python -m compileall .\apps\api\app` passed after agent action scaffold additions.
- Temporary SQLite smoke test passed for `run_reader`.

Open decisions:

- `[!]` Register or pull the actual Ollama model locally; `ollama list` currently returned no installed model rows in this environment.

## M6: Debate + Leader Gate

Status: In progress. Debate handoff skeleton is implemented; real multi-agent model calls are not wired yet.

Goal: review Reader outputs through agent discussion and human approval.

- `[~]` Define Debate Session schema.
- `[~]` Add Critic Agent output schema.
- `[~]` Add Strategist Agent discussion output schema.
- `[~]` Add Experiment Designer discussion output schema.
- `[x]` Show unresolved issues in Debate Room card details.
- `[x]` Send review items to Leader Office through `run_debate`.
- `[x]` Store Leader decisions with reason and target object.
- `[x]` Prevent unapproved outputs from entering Library.

Verification:

- `POST /agent-actions` with `run_debate` routes the selected Debate Card to Leader Office and creates Strategy / Experiment follow-up cards.
- Leader Review still controls Library storage through `POST /leader-decisions`.
- Temporary SQLite smoke test passed for `run_reader` -> `run_debate`.

## M7: Library + Retrieval

Status: Not started.

Goal: store only approved, traceable knowledge.

- `[ ]` Store approved paper summaries.
- `[ ]` Store approved claims.
- `[ ]` Store evidence with source paper and page/section trace.
- `[ ]` Store citation context.
- `[ ]` Add Library search.
- `[ ]` Add paper-level view of approved knowledge.
- `[ ]` Add claim-level evidence view.
- `[ ]` Prepare for vector search without requiring it on day one.

## M8: Strategy / Experiment / Writing Studio

Status: Not started.

Goal: turn approved Library knowledge into research outputs.

- `[ ]` Generate Research Gap candidates from Library entries.
- `[ ]` Generate Hypothesis Cards.
- `[ ]` Score novelty, feasibility, and impact.
- `[ ]` Generate Experiment Plan Cards with controls, variables, replicates, readouts, and failure points.
- `[ ]` Generate citation-backed manuscript outlines.
- `[ ]` Mark manuscript sentences as evidence-linked, citation-required, weak-support, unsupported, or needs-user-review.

## M9: External Metadata / Publisher Integration

Status: In progress. Source registry scaffold is done; actual publisher/API ingestion is not implemented yet.

Goal: enrich local paper records using official and license-compliant sources.

- `[ ]` Add Crossref metadata lookup.
- `[ ]` Add OpenAlex metadata lookup.
- `[ ]` Add PubMed metadata lookup where relevant.
- `[ ]` Add arXiv lookup where relevant.
- `[ ]` Add Semantic Scholar lookup where appropriate.
- `[x]` Add source registry scaffold for Local PDFs, DOI/manual metadata, Crossref, OpenAlex, Nature, Science / AAAS, and Elsevier / ScienceDirect.
- `[x]` Mark Nature, Science / AAAS, and Elsevier / ScienceDirect as license-gated until account/API access is configured.
- `[ ]` Document required API keys and rate limits.
- `[ ]` Treat Elsevier, Science, AAAS, Nature, and other full-text integrations as license-gated.
- `[ ]` Never hardcode API keys.

## Next Recommended Work

Finish M4:

1. Add PyMuPDF to the active Python environment or approve package installation.
2. Verify real PDF text extraction and `paper_texts` persistence.
3. Re-run a scan against a real user-owned paper folder.
4. Then start M5 Reader Agent Pipeline.
