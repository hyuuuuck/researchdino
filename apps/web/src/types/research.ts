export type RoomId =
  | "coordinator"
  | "collection"
  | "reading"
  | "debate"
  | "leader"
  | "library"
  | "strategy"
  | "experiment"
  | "writing";

export type AgentVariant =
  | "coordinator"
  | "search"
  | "reader"
  | "critic"
  | "librarian"
  | "leader"
  | "strategist"
  | "experiment"
  | "writer"
  | "collector";

export type CardType =
  | "paper"
  | "claim"
  | "claim_debate"
  | "paper_review"
  | "contradiction_review"
  | "hypothesis_debate"
  | "experiment_feasibility"
  | "hypothesis"
  | "experiment"
  | "manuscript"
  | "review"
  | "error";

export type WorkflowStatus =
  | "idle"
  | "waiting_for_claim"
  | "debating"
  | "queued"
  | "running"
  | "waiting_for_user"
  | "waiting_for_leader_review"
  | "needs_more_evidence"
  | "paused"
  | "approved"
  | "rejected"
  | "failed"
  | "archived"
  | "stored_in_library";

export type LabMode = "full" | "literature" | "debate" | "strategy" | "experiment" | "writing";
export type LabParallelMode = "same_topic" | "split_topics" | "independent_topics";

export type ApprovalStatus =
  | "draft"
  | "pending_review"
  | "needs_revision"
  | "approved"
  | "rejected"
  | "stored_in_library"
  | "usable_for_writing";

export type ModelProvider = "ollama" | "claude" | "manual";
export type DeputyModelMode = "primary" | "cross_check" | "fallback" | "tool";
export type PaperSourceProvider =
  | "local_pdf"
  | "doi"
  | "crossref"
  | "openalex"
  | "pubmed"
  | "arxiv"
  | "semantic_scholar"
  | "nature"
  | "science"
  | "elsevier";
export type PaperSourceAccess = "available" | "metadata_only" | "needs_account" | "license_gated";

export interface DeputyModelAssignment {
  id: string;
  deputy: AgentVariant;
  label: string;
  provider: ModelProvider;
  model: string;
  modelRef: string;
  mode: DeputyModelMode;
  responsibility: string;
  local: boolean;
}

export interface PaperSourceConnector {
  id: string;
  label: string;
  provider: PaperSourceProvider;
  access: PaperSourceAccess;
  scope: string;
  notes: string;
  enabled: boolean;
}

export interface ResearchProjectData {
  id: string;
  title: string;
  shortTitle: string;
  domain: string;
  description: string;
  status: "active" | "paused" | "completed";
  sourceNote: string;
  lead: string;
  createdAt: string;
}

export interface LabInstanceData {
  id: string;
  name: string;
  label: string;
  projectId: string;
  mode: LabMode;
  status: WorkflowStatus;
  summary: string;
  enabled: boolean;
  createdAt: string;
}

export interface LaboratoryRoomData {
  id: RoomId;
  title: string;
  shortTitle: string;
  role: string;
  status: WorkflowStatus;
  agent: AgentVariant;
  modelAssignments?: DeputyModelAssignment[];
  sourceConnectors?: PaperSourceConnector[];
  x: number;
  y: number;
  width: number;
  height: number;
  metrics: {
    active: number;
    waiting: number;
    complete: number;
  };
}

export interface WorkflowCardData {
  id: string;
  projectId: string;
  labId?: string;
  title: string;
  type: CardType;
  currentRoom: RoomId;
  status: WorkflowStatus;
  progress: number;
  assignedAgent: AgentVariant;
  lastAgent: AgentVariant;
  lastUpdated: string;
  requiresUserReview: boolean;
  errorMessage?: string;
  sourcePaperId?: string;
  evidenceCount: number;
  approvalStatus: ApprovalStatus;
  summary: string;
  details: Record<string, unknown>;
}

export interface AgentLogEntry {
  id: string;
  projectId: string;
  labId?: string;
  time: string;
  agent: AgentVariant;
  room: RoomId;
  level: "info" | "debate" | "warning" | "error" | "approval";
  title: string;
  message: string;
  relatedCardId?: string;
}

export type Selection =
  | { kind: "room"; id: RoomId }
  | { kind: "card"; id: string };
