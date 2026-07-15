# ResearchDino Lab Implementation Roadmap

Date: 2026-07-15

## Product Boundary

ResearchDino Lab is a human-gated research orchestration system. It collects
permitted literature, extracts source-backed evidence, coordinates agent
discussion, proposes hypotheses and experiments, and sends approval packets to
the human Leader. It must not present unsupported model output as established
science or run physical experiments without explicit human control.

## Current Baseline

- Local Ollama only: `http://127.0.0.1:11434`.
- One local baseline model: `qwen3.5:latest`.
- All deputies currently use that model; role-specific local models can be
  split after quality and hardware evaluation.
- Local PDF ingest stores page text, offsets, metadata, and scoped paper IDs.
- Evidence excerpts are verified against stored PDF text.
- Unverified evidence blocks claim/debate approval.
- Research runs persist status, phase checkpoints, errors, and resume counts.
- Crossref/OpenAlex DOI metadata lookup is metadata-only.
- Critic/Librarian and Strategist/Experiment fan-out is implemented, followed
  by Coordinator synthesis, Leader pre-review, and human Leader approval.
- Web dashboard, lab map, room detail, agent logs, Leader review, and PDF ingest
  screens exist.

## Milestone Order

### M1. First Real End-to-End Run

Status: human Leader decision pending

Goal: prove one real paper can move through the complete controlled workflow.

- [x] Choose one user-owned PDF and one active project/lab.
- [x] Ingest and inspect DOI, page count, text extraction, and duplicate scope.
- [x] Run Reader with local Ollama and inspect the stored `AgentRun`.
- [x] Verify every selected evidence excerpt against the PDF.
- [x] Run Debate and inspect Critic, Librarian, Strategist, Experiment,
      Coordinator, and Leader pre-review outputs.
- [x] Resolve at least one objection or mark it unresolved for follow-up.
- [x] Submit the packet to human Leader review.
- [ ] Approve or reject with a reason and verify the audit record.
- [x] Confirm only approved knowledge reaches Library.
- [x] Confirm a failed run can resume from its last checkpoint.

Operator note: the real layered-materials paper is waiting at `waiting_for_leader_review`
with one verified and two unverified evidence excerpts. The local deputy pre-review
recommends `needs_more_evidence`; no new Library entry was created.

Definition of done: a real paper produces a traceable claim/evidence/debate
packet and a human decision without fabricated fallback output.

### M2. Project and Lab Scope

Status: in progress, scope guard implemented

Goal: run one, two, or three research topics independently or in parallel.

- [x] Enforce `projectId` and `labId` at new card/ingest boundaries; all
      downstream run, log, claim, evidence, hypothesis, experiment, and
      manuscript records inherit the source card scope. Legacy seed records
      still need a migration pass.
- [x] Add project creation, rename, pause, and resume actions; archive remains.
- [x] Register multiple local ingest roots per project/lab and scan the latest root for that scope.
- [x] Add Same Topic, Split Topics, and Independent Topic modes.
- [ ] Add per-lab queue, concurrency, model, and approval settings.
- [x] Prove that pausing one lab does not stop another lab.

### M3. Functional UI Wiring

Status: visual shell exists, workflow actions are incomplete

- [ ] Make New Project create a real project and select it.
- [ ] Make Import Paper open local folder/file ingest and show scan results.
- [ ] Make Task Board cards draggable or actionable through explicit status
      transitions.
- [ ] Make Lab Map room/card selection update the real Detail Panel.
- [ ] Make Agents show current task, model, run status, and last output.
- [ ] Make Library rows open paper, claim, evidence, and decision details.
- [ ] Make Settings persist local model, local folder, source, autonomy, and
      concurrency controls.
- [ ] Surface errors, queued work, active work, review requests, and completed
      outputs consistently across map, tasks, and logs.

### M4. Library and Retrieval

Status: storage foundation exists, retrieval not started

- [ ] Store approved paper summaries, claims, evidence, decisions, and source
      snapshots as versioned records.
- [ ] Add SQLite FTS search before vector search.
- [ ] Filter by project, lab, DOI, author, year, source, evidence status, and
      approval status.
- [ ] Show the exact PDF page/section/offset for every evidence result.
- [ ] Track published version, preprint, correction, and retraction lineage.
- [ ] Keep provisional and unapproved outputs out of default Library search.

### M5. True Multi-Round Debate

Status: one fan-out/fan-in orchestration exists

- [ ] Persist `rounds[]`, `turns[]`, agent position, source locators, and time.
- [ ] Add Reader response/correction after Critic objections.
- [ ] Let Critic challenge sample size, controls, statistics, limitations, and
      opposing evidence.
- [ ] Let Strategist turn unresolved questions into competing hypotheses.
- [ ] Let Experiment test feasibility, controls, readouts, and failure modes.
- [ ] Add round stop rules: agreement, unresolved evidence, leader request, or
      provider failure.
- [ ] Expose each turn in Debate Room without hiding the source context.

### M6. Strategy and Experiment Result Loop

Status: plan skeleton exists, result loop missing

- [ ] Store hypothesis cards with rationale, novelty, feasibility, impact, and
      falsification conditions.
- [ ] Generate protocol drafts with variables, controls, replicates, readouts,
      risks, and resource requirements.
- [ ] Require human approval before any external or physical execution.
- [ ] Add manual CSV/table result ingest first.
- [ ] Compare expected vs observed results.
- [ ] Classify outcomes as support, weaken, falsify, or inconclusive.
- [ ] Send result packets back to Debate and Leader review.

### M7. Manuscript Studio

Status: outline scaffold exists

- [ ] Draft only from approved Library knowledge.
- [ ] Link every factual sentence to claim/evidence records.
- [ ] Mark unsupported, citation-required, weak-support, and hypothesis text.
- [ ] Add manuscript versions and Leader review.
- [ ] Add Markdown export, then DOCX/PDF export after citation audit works.

### M8. Permitted External Sources

Status: registry plus metadata adapters exist

- [ ] Finish DOI enrichment UI using Crossref/OpenAlex.
- [ ] Add PubMed and arXiv metadata where relevant.
- [ ] Define Elsevier API credentials and rate-limit handling.
- [ ] Add permitted Nature and Science/AAAS access through the user's account or
      institution only.
- [ ] Store credential references in OS/user secret storage, never in the repo.
- [ ] Separate metadata, abstract, full text, and local-PDF capabilities.
- [ ] Record access decision, license boundary, download event, and failure.

## Parallel Work Lanes

These can proceed in parallel after M1 has a reproducible sample paper:

- Lane A: Project/lab scope and queue isolation (M2).
- Lane B: Library FTS and source-locator retrieval (M4).
- Lane C: Functional UI wiring for projects, ingest, tasks, agents, and Library
  (M3).
- Lane D: Debate turn persistence and multi-round UI (M5).
- Lane E: Metadata/source adapters and account-safe connectors (M8).

Do not start vector search, autonomous physical experiment execution, or
publisher full-text scraping before approval gates, source licensing, and the
M1 traceability run are working.

## Verification Gate For Every Milestone

- Automated tests cover the changed API behavior.
- A real or fixture-backed run shows source locators and project/lab scope.
- Provider failures are visible and resumable.
- No unverified evidence enters approved Library state.
- UI state matches persisted API state after reload.
- The milestone has a short operator note and a git commit.
