# Architecture Sketch

## System Shape

ResearchDino Lab should be built as a workflow-driven research system rather than a
single chat interface.

```text
Local PDFs / DOI / Web sources
        |
        v
Collection Dock
        |
        v
Parsing + Metadata Enrichment
        |
        v
Reading Bench
        |
        v
Debate Room
        |
        v
Leader Office
        |
        v
Library
        |
        +--> Strategy Room
        |        |
        |        v
        |   Experiment Bay
        |
        v
Writing Studio
```

## Ollama Deputy Runtime

The implemented model handoff is card-scoped by `projectId` and `labId`:

```text
Reader (qwen3.5:cloud)
        |
        +--> Critic (gpt-oss:120b-cloud) --------+
        |                                         |
        +--> Librarian (gpt-oss:20b-cloud) -------+--> shared round-one packet
                                                   |
                         +-------------------------+------------------------+
                         |                                                  |
                         v                                                  v
              Strategist (nemotron-3-super:cloud)              Experiment (qwen3.5:cloud)
                         |                                                  |
                         +-------------------------+------------------------+
                                                   v
                                  Coordinator (nemotron-3-super:cloud)
                                                   |
                                                   v
                                  Leader pre-review (gpt-oss:120b-cloud)
                                                   |
                                                   v
                                           Human Leader gate
```

Parallel deputies exchange state through validated JSON outputs. Each invocation
creates an `AgentRun`; each validated deputy result creates an `AgentMessage`.
No model may store knowledge in the Library without the human Leader decision.

## Core Entities

- Paper: source document with metadata, parsed text, figures, tables, and sections.
- Claim: a statement extracted from evidence, linked to source pages and passages.
- Evidence: quoted or paraphrased support with paper, page, section, and confidence.
- Debate: multi-agent discussion over papers, claims, methods, and contradictions.
- Decision: leader approval, rejection, or request for more evidence.
- Knowledge Item: leader-approved claim, method note, contradiction, or research gap.
- Hypothesis: research idea derived from approved knowledge.
- Experiment Plan: variables, controls, readouts, replicates, and failure risks.
- Manuscript Section: draft text linked back to evidence and citations.

## Agent Roles

- Collector: imports PDFs and fetches metadata.
- Reader: extracts structured summaries and claims.
- Critic: challenges evidence quality, limitations, controls, and statistics.
- Librarian: stores approved knowledge and maintains retrieval structure.
- Strategist: turns gaps and contradictions into research ideas.
- Experiment Designer: proposes experiments and validation plans.
- Writer: drafts manuscript sections with evidence traceability.
- Leader: approves, rejects, or sends work back for more investigation.

## Data Principles

- Every generated claim should keep source traceability.
- Raw licensed documents stay local and are not redistributed.
- Approved knowledge is separate from provisional agent output.
- The UI should expose process state, not just final text.
