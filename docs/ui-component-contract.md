# UI Component Contract

This document describes the current web UI contract for backend integration.
It is not the durable research database schema. M2 should turn these UI-facing
shapes into shared or API-owned models.

## Data Inputs

The Laboratory UI currently needs three top-level collections:

- `rooms: LaboratoryRoomData[]`
- `cards: WorkflowCardData[]`
- `logs: AgentLogEntry[]`

For demo mode, these are loaded from `apps/web/src/data/demoResearchLab.ts`.
When the backend is introduced, the UI should receive the same conceptual
collections from API endpoints or a client data adapter.

## Core UI Types

`LaboratoryRoomData`

- `id`: stable room id used for routing cards and map selection.
- `title`: room display name.
- `shortTitle`: compact uppercase label for the map.
- `role`: one-sentence room purpose.
- `status`: current room state.
- `agent`: primary agent avatar variant.
- `modelAssignments`: optional Ollama deputy/model assignment list for agent orchestration.
- `sourceConnectors`: optional paper source registry. Search Dock uses this to show local PDFs, DOI/manual metadata, metadata sources, and license-gated publisher sources such as Nature, Science / AAAS, and Elsevier / ScienceDirect.
- `x`, `y`, `width`, `height`: map placement values. These are UI-owned.
- `metrics.active`, `metrics.waiting`, `metrics.complete`: counts shown in the room and detail panel.

`WorkflowCardData`

- `id`: stable card id used for selection and leader decisions.
- `title`: card display title.
- `type`: paper, claim, hypothesis, experiment, manuscript, review, or error.
- `currentRoom`: room id where the card should render.
- `status`: visual and workflow state.
- `progress`: percentage shown by the card progress track.
- `assignedAgent`: current responsible agent.
- `lastAgent`: most recent agent that modified the card.
- `lastUpdated`: display timestamp.
- `requiresUserReview`: sends the card into the Leader Review queue.
- `errorMessage`: optional failure text.
- `sourcePaperId`: optional source link for derived cards.
- `evidenceCount`: evidence count shown in details.
- `approvalStatus`: human approval state.
- `summary`: short card summary.
- `details`: temporary free-form key/value trace data. M2 should replace this with typed entities.

`AgentLogEntry`

- `id`: stable log id.
- `time`: display timestamp.
- `agent`: agent variant.
- `room`: room id.
- `level`: info, debate, warning, error, or approval.
- `title`: concise event title.
- `message`: event body.
- `relatedCardId`: optional link to a workflow card.

## Components

`LaboratoryMap`

- Owns current UI selection.
- Owns demo card/log state until API integration.
- Routes cards into rooms by `card.currentRoom`.
- Handles leader decisions and updates card/log state in demo mode.

`LaboratoryRoom`

- Receives one room plus cards assigned to that room.
- Emits `onSelectRoom(roomId)` and `onSelectCard(cardId)`.
- Treats map coordinates as UI placement, not backend data.

`WorkflowCard`

- Receives one card.
- Emits `onSelect(cardId)`.
- Uses `status`, `type`, `progress`, and `requiresUserReview` for visual state.

`DetailPanel`

- Receives the selected room or card id through `Selection`.
- Shows room metrics or card trace data.
- Does not mutate data.

`LeaderReviewPanel`

- Filters cards where `requiresUserReview` is true or `status` is `waiting_for_user`.
- Emits `onDecision(cardId, decision, reason)`.
- Supported decisions are `approved`, `rejected`, `needs_revision`, and `stored_in_library`.

`AgentLogPanel`

- Receives ordered log entries.
- Does not mutate data.

`DinoAgentAvatar`

- Receives an agent variant and size.
- Pure display component.

## Backend Adapter Expectations

The first backend integration can expose adapter functions that return:

- rooms for the map and detail panel
- cards for the map, detail panel, and Leader Review queue
- agent logs for the activity panel
- a leader-decision mutation

The UI should not directly know whether the source is demo data, SQLite, local
PDF extraction, Ollama, or an external metadata API. That distinction should
live behind a client adapter.

## Approval Rules

- A card requiring human review must set `requiresUserReview: true`.
- Unapproved research claims must not be marked as Library-ready.
- `stored_in_library` should only be set after a Leader decision.
- The UI may display provisional claims, but the backend must preserve approval
  state and source traceability.

## UI-Owned Fields

The following fields are UI layout or display concerns and should not drive the
research database model:

- room `x`
- room `y`
- room `width`
- room `height`
- avatar `size`
- current `Selection`

## Open Contract Work For M2

- Replace `details: Record<string, string | number | string[]>` with typed trace entities.
- Decide whether shared types live in `packages/shared` or are generated from API schemas.
- Split `WorkflowCardData` into UI summary cards plus full domain objects.
- Define source trace fields for papers, claims, evidence, and manuscript text.
- Define persistence rules for Leader decisions and Library entries.
