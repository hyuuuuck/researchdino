from typing import Literal

from pydantic import BaseModel, Field


RoomId = Literal[
    "coordinator",
    "collection",
    "reading",
    "debate",
    "leader",
    "library",
    "strategy",
    "experiment",
    "writing",
]

AgentVariant = Literal[
    "coordinator",
    "search",
    "reader",
    "critic",
    "librarian",
    "leader",
    "strategist",
    "experiment",
    "writer",
    "collector",
]

CardType = Literal[
    "paper",
    "claim",
    "claim_debate",
    "paper_review",
    "contradiction_review",
    "hypothesis_debate",
    "experiment_feasibility",
    "hypothesis",
    "experiment",
    "manuscript",
    "review",
    "error",
]

WorkflowStatus = Literal[
    "idle",
    "waiting_for_claim",
    "debating",
    "queued",
    "running",
    "waiting_for_user",
    "waiting_for_leader_review",
    "needs_more_evidence",
    "approved",
    "rejected",
    "failed",
    "archived",
    "stored_in_library",
]

LabMode = Literal["full", "literature", "debate", "strategy", "experiment", "writing"]

ApprovalStatus = Literal[
    "draft",
    "pending_review",
    "needs_revision",
    "approved",
    "rejected",
    "stored_in_library",
    "usable_for_writing",
]

AgentLogLevel = Literal["info", "debate", "warning", "error", "approval"]
LeaderDecisionValue = Literal["approved", "rejected", "needs_revision", "stored_in_library"]
AgentActionValue = Literal["run_reader", "run_debate", "design_experiment", "draft_manuscript", "run_research_pipeline"]
ModelProvider = Literal["ollama", "claude", "manual"]
DeputyModelMode = Literal["primary", "cross_check", "fallback", "tool"]
PaperSourceProvider = Literal[
    "local_pdf",
    "doi",
    "crossref",
    "openalex",
    "pubmed",
    "arxiv",
    "semantic_scholar",
    "nature",
    "science",
    "elsevier",
]
PaperSourceAccess = Literal["available", "metadata_only", "needs_account", "license_gated"]


class RoomMetrics(BaseModel):
    active: int
    waiting: int
    complete: int


class DeputyModelAssignment(BaseModel):
    id: str
    deputy: AgentVariant
    label: str
    provider: ModelProvider
    model: str
    modelRef: str
    mode: DeputyModelMode
    responsibility: str
    local: bool


class PaperSourceConnector(BaseModel):
    id: str
    label: str
    provider: PaperSourceProvider
    access: PaperSourceAccess
    scope: str
    notes: str
    enabled: bool


class ResearchProject(BaseModel):
    id: str
    title: str
    shortTitle: str
    domain: str
    description: str
    status: Literal["active", "paused", "completed"]
    sourceNote: str
    lead: str
    createdAt: str


class ResearchProjectCreateRequest(BaseModel):
    title: str
    shortTitle: str = ""
    domain: str = "Research"
    description: str = ""
    sourceNote: str = "Source pending"
    lead: str = "ResearchDino Lab"
    status: Literal["active", "paused", "completed"] = "active"


class LabInstance(BaseModel):
    id: str
    name: str
    label: str
    projectId: str
    mode: LabMode
    status: WorkflowStatus
    summary: str
    enabled: bool
    createdAt: str


class LabInstancePatchRequest(BaseModel):
    projectId: str | None = None
    mode: LabMode | None = None
    status: WorkflowStatus | None = None
    enabled: bool | None = None
    label: str | None = None
    summary: str | None = None


class LaboratoryRoom(BaseModel):
    id: RoomId
    title: str
    shortTitle: str
    role: str
    status: WorkflowStatus
    agent: AgentVariant
    modelAssignments: list[DeputyModelAssignment] = Field(default_factory=list)
    sourceConnectors: list[PaperSourceConnector] = Field(default_factory=list)
    x: int
    y: int
    width: int
    height: int
    metrics: RoomMetrics


class WorkflowCard(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    title: str
    type: CardType
    currentRoom: RoomId
    status: WorkflowStatus
    progress: int = Field(ge=0, le=100)
    assignedAgent: AgentVariant
    lastAgent: AgentVariant
    lastUpdated: str
    requiresUserReview: bool
    errorMessage: str | None = None
    sourcePaperId: str | None = None
    evidenceCount: int
    approvalStatus: ApprovalStatus
    summary: str
    details: dict[str, str | int | list[str]]


class WorkflowCardCreateRequest(BaseModel):
    projectId: str = "project-autophagy"
    labId: str | None = None
    title: str
    type: CardType = "review"
    currentRoom: RoomId = "coordinator"
    summary: str = ""
    details: dict[str, str | int | list[str]] = Field(default_factory=dict)


class WorkflowCardPatchRequest(BaseModel):
    labId: str | None = None
    title: str | None = None
    type: CardType | None = None
    currentRoom: RoomId | None = None
    status: WorkflowStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    assignedAgent: AgentVariant | None = None
    lastAgent: AgentVariant | None = None
    requiresUserReview: bool | None = None
    approvalStatus: ApprovalStatus | None = None
    summary: str | None = None
    details: dict[str, str | int | list[str]] | None = None


class AgentLogEntry(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    time: str
    agent: AgentVariant
    room: RoomId
    level: AgentLogLevel
    title: str
    message: str
    relatedCardId: str | None = None


class LeaderDecisionRequest(BaseModel):
    cardId: str
    decision: LeaderDecisionValue
    reason: str = ""


class LeaderDecisionRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    cardId: str
    decision: LeaderDecisionValue
    reason: str
    createdAt: str
    resultingStatus: WorkflowStatus


class AgentActionRequest(BaseModel):
    cardId: str
    action: AgentActionValue


class AgentActionResult(BaseModel):
    action: AgentActionValue
    sourceCardId: str
    updatedCardIds: list[str]
    createdCardIds: list[str]
    message: str


class LibraryEntry(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    title: str
    summary: str
    sourceCardId: str
    decisionId: str
    evidenceCount: int
    storedAt: str


class ApiMode(BaseModel):
    mode: Literal["api"]
    source: Literal["sqlite"]
    databasePath: str
    demoSeed: bool


class IngestFolderRequest(BaseModel):
    path: str
    projectId: str = "project-autophagy"
    labId: str | None = None


class IngestFolderRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    path: str
    registeredAt: str
    exists: bool


class PaperFileRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    path: str
    fileName: str
    sizeBytes: int
    sha256: str | None = None
    scanStatus: Literal["scanned", "error"]
    textExtractionStatus: Literal["not_attempted", "parsed", "parser_unavailable", "failed"]
    pageCount: int | None = None
    textPreview: str | None = None
    errorMessage: str | None = None
    scannedAt: str


class IngestScanResult(BaseModel):
    folderPath: str
    pdfCount: int
    paperCardCount: int
    errorCardCount: int
    parserAvailable: bool
    errors: list[str]
