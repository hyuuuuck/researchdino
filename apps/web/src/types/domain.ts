import type {
  AgentVariant,
  ApprovalStatus,
  CardType,
  PaperSourceProvider,
  RoomId,
  WorkflowStatus,
} from "./research";

export type EntityId = string;
export type ISODateTime = string;

export type EntityKind =
  | "paper"
  | "paper_section"
  | "claim"
  | "evidence"
  | "agent_run"
  | "agent_message"
  | "debate_session"
  | "leader_decision"
  | "library_entry"
  | "research_gap"
  | "hypothesis"
  | "experiment_plan"
  | "manuscript_draft";

export interface EntityRef {
  kind: EntityKind;
  id: EntityId;
}

export interface LocalFileReference {
  path: string;
  fileName: string;
  sizeBytes: number;
  sha256?: string;
  lastScannedAt?: ISODateTime;
}

export type PaperAccessStatus =
  | "local"
  | "metadata_only"
  | "license_gated"
  | "account_connected"
  | "unavailable";

export interface PaperSourceRecord {
  provider: PaperSourceProvider;
  sourceId?: string;
  url?: string;
  accessStatus: PaperAccessStatus;
  retrievedAt?: ISODateTime;
}

export interface PaperMetadata {
  title: string;
  authors: string[];
  year?: number;
  journal?: string;
  publisher?: string;
  doi?: string;
  pmid?: string;
  arxivId?: string;
  url?: string;
  abstract?: string;
  keywords: string[];
  sources: PaperSourceRecord[];
}

export interface Paper {
  id: EntityId;
  localFile?: LocalFileReference;
  metadata: PaperMetadata;
  status: "registered" | "parsing" | "parsed" | "parse_failed" | "archived";
  sectionIds: EntityId[];
  importedAt: ISODateTime;
  parsedAt?: ISODateTime;
  errorMessage?: string;
}

export type PaperSectionKind =
  | "title"
  | "abstract"
  | "introduction"
  | "methods"
  | "results"
  | "discussion"
  | "limitations"
  | "references"
  | "figure_caption"
  | "table_caption"
  | "unknown";

export interface PaperSection {
  id: EntityId;
  paperId: EntityId;
  kind: PaperSectionKind;
  title?: string;
  text: string;
  pageStart?: number;
  pageEnd?: number;
  order: number;
}

export interface SourceLocator {
  paperId: EntityId;
  sectionId?: EntityId;
  pageStart?: number;
  pageEnd?: number;
  paragraphIndex?: number;
  charStart?: number;
  charEnd?: number;
}

export type EvidenceStrength = "strong" | "moderate" | "weak" | "contradictory" | "unsupported";

export interface Evidence {
  id: EntityId;
  claimId?: EntityId;
  locator: SourceLocator;
  excerpt: string;
  interpretation: string;
  strength: EvidenceStrength;
  confidence: number;
  extractedByRunId?: EntityId;
  createdAt: ISODateTime;
}

export type ClaimType =
  | "finding"
  | "method"
  | "mechanism"
  | "limitation"
  | "contradiction"
  | "research_gap"
  | "background";

export interface Claim {
  id: EntityId;
  paperId?: EntityId;
  text: string;
  normalizedText?: string;
  type: ClaimType;
  status: WorkflowStatus;
  approvalStatus: ApprovalStatus;
  supportLevel: EvidenceStrength;
  evidenceIds: EntityId[];
  createdByRunId?: EntityId;
  requiresUserReview: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AgentRun {
  id: EntityId;
  agent: AgentVariant;
  room: RoomId;
  task: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  provider?: "ollama" | "openai" | "manual" | "tool";
  model?: string;
  inputRefs: EntityRef[];
  outputRefs: EntityRef[];
  startedAt: ISODateTime;
  completedAt?: ISODateTime;
  errorMessage?: string;
}

export interface AgentMessage {
  id: EntityId;
  agent: AgentVariant;
  runId?: EntityId;
  debateSessionId?: EntityId;
  role: "system" | "agent" | "critic" | "leader" | "user" | "tool";
  content: string;
  relatedRefs: EntityRef[];
  createdAt: ISODateTime;
}

export interface DebateSession {
  id: EntityId;
  topic: string;
  status: "queued" | "active" | "needs_leader_review" | "resolved" | "failed";
  targetRefs: EntityRef[];
  participantAgents: AgentVariant[];
  messageIds: EntityId[];
  unresolvedIssueIds: EntityId[];
  outcomeSummary?: string;
  createdAt: ISODateTime;
  closedAt?: ISODateTime;
}

export type LeaderDecisionValue =
  | "approved"
  | "rejected"
  | "needs_revision"
  | "stored_in_library";

export interface LeaderDecision {
  id: EntityId;
  targetRef: EntityRef;
  decision: LeaderDecisionValue;
  reason: string;
  decidedBy: "user" | "leader_agent";
  decidedAt: ISODateTime;
  resultingStatus: WorkflowStatus;
}

export interface LibraryEntry {
  id: EntityId;
  sourceRef: EntityRef;
  title: string;
  summary: string;
  claimIds: EntityId[];
  evidenceIds: EntityId[];
  approvalDecisionId: EntityId;
  tags: string[];
  reusableFor: Array<"search" | "strategy" | "experiment" | "writing">;
  storedAt: ISODateTime;
}

export interface ResearchGap {
  id: EntityId;
  title: string;
  description: string;
  sourceLibraryEntryIds: EntityId[];
  relatedClaimIds: EntityId[];
  noveltyScore?: number;
  feasibilityScore?: number;
  impactScore?: number;
  createdByRunId?: EntityId;
  createdAt: ISODateTime;
}

export interface Hypothesis {
  id: EntityId;
  statement: string;
  rationale: string;
  sourceGapIds: EntityId[];
  supportingLibraryEntryIds: EntityId[];
  riskNotes: string[];
  status: WorkflowStatus;
  requiresUserReview: boolean;
  createdByRunId?: EntityId;
  createdAt: ISODateTime;
}

export interface ExperimentVariable {
  name: string;
  role: "independent" | "dependent" | "control" | "covariate";
  description: string;
}

export interface ExperimentPlan {
  id: EntityId;
  hypothesisId: EntityId;
  title: string;
  objective: string;
  variables: ExperimentVariable[];
  controls: string[];
  readouts: string[];
  replicates?: string;
  protocolOutline: string[];
  expectedOutcomes: string[];
  failureRisks: string[];
  requiredResources: string[];
  status: WorkflowStatus;
  approvalStatus: ApprovalStatus;
  createdByRunId?: EntityId;
  createdAt: ISODateTime;
}

export interface ManuscriptSectionDraft {
  id: EntityId;
  heading: string;
  body: string;
  citationRefs: EntityRef[];
  supportStatus: "evidence_linked" | "citation_required" | "weak_support" | "unsupported";
  order: number;
}

export interface ManuscriptDraft {
  id: EntityId;
  title: string;
  targetJournal?: string;
  sourceLibraryEntryIds: EntityId[];
  sectionDrafts: ManuscriptSectionDraft[];
  status: WorkflowStatus;
  createdByRunId?: EntityId;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WorkflowCardSummary {
  id: EntityId;
  title: string;
  type: CardType;
  currentRoom: RoomId;
  status: WorkflowStatus;
  progress: number;
  assignedAgent: AgentVariant;
  lastAgent: AgentVariant;
  lastUpdated: ISODateTime;
  requiresUserReview: boolean;
  sourceRef?: EntityRef;
  evidenceCount: number;
  approvalStatus: ApprovalStatus;
  summary: string;
}
