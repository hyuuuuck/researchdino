from typing import Any, Literal

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


class AgentRunRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    sourceCardId: str
    agent: AgentVariant
    phase: str
    provider: ModelProvider
    model: str
    status: Literal["running", "completed", "failed"]
    inputSummary: str
    output: dict[str, Any] | None = None
    metrics: dict[str, int | str | None] = Field(default_factory=dict)
    errorMessage: str | None = None
    startedAt: str
    completedAt: str | None = None


class AgentMessageRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    sourceCardId: str
    runId: str
    agent: AgentVariant
    room: RoomId
    phase: str
    content: dict[str, Any]
    createdAt: str


class ModelRuntimeStatus(BaseModel):
    mode: str
    provider: str
    baseUrl: str
    authMode: str
    apiKeyConfigured: bool
    reachable: bool
    configured: bool
    roleModels: dict[str, str]
    availableModels: list[str]
    missingModels: list[str]
    error: str | None = None


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


class ResearchClaim(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    paperId: str | None = None
    sourceCardId: str
    text: str
    type: Literal["finding", "method", "mechanism", "limitation", "contradiction", "research_gap", "background"] = "finding"
    status: WorkflowStatus
    approvalStatus: ApprovalStatus
    supportLevel: Literal["strong", "moderate", "weak", "contradictory", "unsupported"] = "moderate"
    evidenceIds: list[str] = Field(default_factory=list)
    debateSessionId: str | None = None
    requiresUserReview: bool
    createdAt: str
    updatedAt: str


class EvidenceRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    claimId: str
    paperId: str | None = None
    sourceCardId: str
    excerpt: str
    interpretation: str
    strength: Literal["strong", "moderate", "weak", "contradictory", "unsupported"] = "moderate"
    confidence: int = Field(ge=0, le=100)
    locator: dict[str, str | int | None] = Field(default_factory=dict)
    createdAt: str


class DebateSessionRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    sourceCardId: str
    claimId: str | None = None
    topic: str
    status: Literal["queued", "active", "needs_leader_review", "resolved", "failed"]
    targetRefs: list[dict[str, str]] = Field(default_factory=list)
    participantAgents: list[AgentVariant] = Field(default_factory=list)
    supportingEvidenceIds: list[str] = Field(default_factory=list)
    opposingEvidence: list[str] = Field(default_factory=list)
    unresolvedQuestions: list[str] = Field(default_factory=list)
    hypotheses: list[str] = Field(default_factory=list)
    suggestedExperiments: list[str] = Field(default_factory=list)
    outcomeSummary: str
    librarySaveStatus: str
    createdAt: str
    updatedAt: str


class HypothesisRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    sourceCardId: str
    debateSessionId: str | None = None
    statement: str
    rationale: str
    openQuestions: list[str] = Field(default_factory=list)
    validationPlan: list[str] = Field(default_factory=list)
    status: WorkflowStatus
    requiresUserReview: bool
    createdAt: str


class ExperimentPlanRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    sourceCardId: str
    hypothesisId: str | None = None
    debateSessionId: str | None = None
    title: str
    objective: str
    controls: list[str] = Field(default_factory=list)
    readouts: list[str] = Field(default_factory=list)
    protocolOutline: list[str] = Field(default_factory=list)
    failureRisks: list[str] = Field(default_factory=list)
    status: WorkflowStatus
    approvalStatus: ApprovalStatus
    createdAt: str


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
    title: str = ""
    authors: list[str] = Field(default_factory=list)
    doi: str | None = None
    subject: str | None = None
    keywords: list[str] = Field(default_factory=list)
    metadataSource: Literal["embedded_pdf", "filename"] = "filename"
    pdfMetadata: dict[str, str] = Field(default_factory=dict)
    sizeBytes: int
    sha256: str | None = None
    scanStatus: Literal["scanned", "error"]
    textExtractionStatus: Literal["not_attempted", "parsed", "parser_unavailable", "failed"]
    pageCount: int | None = None
    textLength: int = 0
    textPreview: str | None = None
    errorMessage: str | None = None
    scannedAt: str


class PaperTextPage(BaseModel):
    pageNumber: int
    text: str
    charStart: int
    charEnd: int


class PaperTextRecord(BaseModel):
    id: str
    projectId: str = "project-autophagy"
    labId: str | None = None
    paperFileId: str
    text: str
    pages: list[PaperTextPage] = Field(default_factory=list)
    pageCount: int
    textLength: int
    extractedAt: str


class IngestScanResult(BaseModel):
    folderPath: str
    pdfCount: int
    paperCardCount: int
    errorCardCount: int
    newPaperCount: int = 0
    duplicatePaperCount: int = 0
    parsedPaperCount: int = 0
    readerQueueCount: int = 0
    parserAvailable: bool
    errors: list[str]
