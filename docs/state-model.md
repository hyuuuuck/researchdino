# Workflow State Model

M2 defines the durable research objects behind the Laboratory UI. The current UI
cards are view summaries; they should not become the database model by accident.

## Ownership Decision

Do not introduce `packages/shared` yet.

For the next step, keep:

- UI view models in `apps/web/src/types/research.ts`
- draft durable domain types in `apps/web/src/types/domain.ts`
- backend-owned persistence schemas in `apps/api` when M3 starts

After the FastAPI schema exists, decide whether to generate TypeScript DTOs from
OpenAPI or move hand-written shared types into `packages/shared`.

## Entity Graph

```text
Paper
  -> PaperSection
  -> Claim
       -> Evidence
       -> DebateSession
            -> AgentMessage
       -> LeaderDecision
            -> LibraryEntry
                 -> ResearchGap
                      -> Hypothesis
                           -> ExperimentPlan
                 -> ManuscriptDraft

AgentRun can create or update PaperSection, Claim, Evidence, DebateSession,
ResearchGap, Hypothesis, ExperimentPlan, and ManuscriptDraft.
```

## Workflow Card Summary

`WorkflowCardSummary` is the bridge from durable objects to the map UI.

Shared fields:

- stable `id`
- display `title`
- `type`
- `currentRoom`
- `status`
- `progress`
- `assignedAgent`
- `lastAgent`
- `lastUpdated`
- `requiresUserReview`
- optional `sourceRef`
- `evidenceCount`
- `approvalStatus`
- short `summary`

The backend should not store map coordinates on cards. Rooms and card summaries
are presentation outputs derived from the durable objects.

## Core Entities

`Paper`

- Represents one source document or registered paper.
- Stores local file reference, metadata, parse status, and section ids.
- Raw PDFs remain local and should not be redistributed.

`PaperMetadata`

- Stores title, authors, DOI, journal, publisher, abstract, keywords, and
  external identifiers such as PMID or arXiv id when available.
- Stores source records for local PDFs, DOI/metadata lookups, and
  license-gated publisher sources such as Nature, Science / AAAS, and
  Elsevier / ScienceDirect.

`PaperSection`

- Stores parsed text by section type, order, and optional page range.
- This is the first layer of traceability for later claims and evidence.

`Claim`

- Stores an extracted scientific statement.
- Keeps paper link, claim type, support level, evidence ids, approval status,
  and whether user review is required.

`Evidence`

- Stores source locator, excerpt, interpretation, strength, confidence, and the
  agent run that extracted it.
- Evidence must point back to a paper and preferably a section/page.

`AgentRun`

- Stores execution state for one agent task.
- Tracks provider, model, inputs, outputs, timing, and errors.

`AgentMessage`

- Stores a debate, log, or agent message connected to an agent run or debate
  session.

`DebateSession`

- Stores multi-agent discussion over one or more target entities.
- Tracks participants, messages, unresolved issues, and outcome summary.

`LeaderDecision`

- Stores approval, rejection, re-analysis request, or Library storage decision.
- Every decision must preserve target, reason, actor, timestamp, and resulting
  workflow status.

`LibraryEntry`

- Stores only leader-approved reusable knowledge.
- Links back to source claims, evidence, and approval decision.

`ResearchGap`

- Stores a candidate gap or contradiction derived from approved Library entries.
- Can be scored for novelty, feasibility, and impact.

`Hypothesis`

- Stores a testable research statement with rationale, supporting Library
  entries, risks, and review requirement.

`ExperimentPlan`

- Stores variables, controls, readouts, protocol outline, expected outcomes,
  resources, risks, and approval status.

`ManuscriptDraft`

- Stores manuscript sections linked to approved Library entries and citation
  references. Each section draft has a support status so unsupported text stays
  visible.

## Approval Rules

- Paper parsing can create provisional Paper, Section, Claim, and Evidence data.
- Claims without evidence stay provisional.
- Debate outputs do not enter the Library directly.
- Only Leader decisions can mark reusable knowledge as stored in the Library.
- Library entries must link to an approval decision and source trace.
- Manuscript text should expose whether each section is evidence-linked,
  citation-required, weakly supported, or unsupported.

## Room Mapping

- Collection Dock: `Paper` registered or parsing.
- Reading Bench: `Paper`, `PaperSection`, `Claim`, and `Evidence` extraction.
- Debate Room: `DebateSession`, challenged `Claim`, weak `Evidence`.
- Leader Office: cards with `requiresUserReview` or `waiting_for_user`.
- Library: `LibraryEntry`.
- Strategy Room: `ResearchGap` and `Hypothesis`.
- Experiment Bay: `ExperimentPlan`.
- Writing Studio: `ManuscriptDraft`.

## Backend Boundary For M3

The first API should expose:

- room summaries
- workflow card summaries
- agent logs
- leader decisions
- library entries

The backend should own durable entities and persistence. The frontend should own
map placement, selected card/room state, and visual rendering details.
