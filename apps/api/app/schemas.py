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
ModelProvider = Literal["ollama", "manual"]
DeputyModelMode = Literal["primary", "cross_check", "fallback", "tool"]


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


class LaboratoryRoom(BaseModel):
    id: RoomId
    title: str
    shortTitle: str
    role: str
    status: WorkflowStatus
    agent: AgentVariant
    modelAssignments: list[DeputyModelAssignment] = Field(default_factory=list)
    x: int
    y: int
    width: int
    height: int
    metrics: RoomMetrics


class WorkflowCard(BaseModel):
    id: str
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


class AgentLogEntry(BaseModel):
    id: str
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
    cardId: str
    decision: LeaderDecisionValue
    reason: str
    createdAt: str
    resultingStatus: WorkflowStatus


class LibraryEntry(BaseModel):
    id: str
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


class IngestFolderRecord(BaseModel):
    id: str
    path: str
    registeredAt: str
    exists: bool


class PaperFileRecord(BaseModel):
    id: str
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
