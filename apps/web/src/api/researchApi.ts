import { agentLogs, initialWorkflowCards, labInstances, laboratoryRooms, researchProjects } from "../data/demoResearchLab";
import type {
  AgentLogEntry,
  CardType,
  LabInstanceData,
  LabMode,
  LaboratoryRoomData,
  ResearchProjectData,
  RoomId,
  WorkflowCardData,
  WorkflowStatus,
} from "../types/research";

export type ResearchDataMode = "demo" | "api";
export type LeaderDecisionValue = "approved" | "rejected" | "needs_revision" | "stored_in_library";
export type AgentActionValue = "run_reader" | "run_debate" | "design_experiment" | "draft_manuscript" | "run_research_pipeline";

export interface ResearchLabState {
  projects: ResearchProjectData[];
  labInstances: LabInstanceData[];
  rooms: LaboratoryRoomData[];
  cards: WorkflowCardData[];
  logs: AgentLogEntry[];
  claims: ResearchClaimRecord[];
  evidence: EvidenceRecord[];
  debateSessions: DebateSessionRecord[];
  hypotheses: HypothesisRecord[];
  experimentPlans: ExperimentPlanRecord[];
  mode: ResearchDataMode;
}

export interface IngestFolderRecord {
  id: string;
  projectId: string;
  labId?: string;
  path: string;
  registeredAt: string;
  exists: boolean;
}

export interface IngestScanResult {
  folderPath: string;
  pdfCount: number;
  paperCardCount: number;
  errorCardCount: number;
  parserAvailable: boolean;
  errors: string[];
}

export interface AgentActionResult {
  action: AgentActionValue;
  sourceCardId: string;
  updatedCardIds: string[];
  createdCardIds: string[];
  message: string;
}

export interface ResearchClaimRecord {
  id: string;
  projectId: string;
  labId?: string;
  paperId?: string;
  sourceCardId: string;
  text: string;
  type: string;
  status: WorkflowStatus;
  approvalStatus: string;
  supportLevel: string;
  evidenceIds: string[];
  debateSessionId?: string;
  requiresUserReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceRecord {
  id: string;
  projectId: string;
  labId?: string;
  claimId: string;
  paperId?: string;
  sourceCardId: string;
  excerpt: string;
  interpretation: string;
  strength: string;
  confidence: number;
  locator: Record<string, string | number | null>;
  createdAt: string;
}

export interface DebateSessionRecord {
  id: string;
  projectId: string;
  labId?: string;
  sourceCardId: string;
  claimId?: string;
  topic: string;
  status: string;
  targetRefs: Array<Record<string, string>>;
  participantAgents: string[];
  supportingEvidenceIds: string[];
  opposingEvidence: string[];
  unresolvedQuestions: string[];
  hypotheses: string[];
  suggestedExperiments: string[];
  outcomeSummary: string;
  librarySaveStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface HypothesisRecord {
  id: string;
  projectId: string;
  labId?: string;
  sourceCardId: string;
  debateSessionId?: string;
  statement: string;
  rationale: string;
  openQuestions: string[];
  validationPlan: string[];
  status: WorkflowStatus;
  requiresUserReview: boolean;
  createdAt: string;
}

export interface ExperimentPlanRecord {
  id: string;
  projectId: string;
  labId?: string;
  sourceCardId: string;
  hypothesisId?: string;
  debateSessionId?: string;
  title: string;
  objective: string;
  controls: string[];
  readouts: string[];
  protocolOutline: string[];
  failureRisks: string[];
  status: WorkflowStatus;
  approvalStatus: string;
  createdAt: string;
}

export interface CreateWorkflowCardInput {
  projectId: string;
  labId?: string;
  title: string;
  type: CardType;
  currentRoom: RoomId;
  summary?: string;
}

export interface UpdateWorkflowCardInput {
  labId?: string;
  status?: WorkflowStatus;
  currentRoom?: RoomId;
  requiresUserReview?: boolean;
  progress?: number;
}

export interface PatchLabInstanceInput {
  projectId?: string;
  mode?: LabMode;
  status?: WorkflowStatus;
  enabled?: boolean;
  label?: string;
  summary?: string;
}

export interface CreateResearchProjectInput {
  title: string;
  shortTitle?: string;
  domain?: string;
  description?: string;
  sourceNote?: string;
  lead?: string;
  status?: ResearchProjectData["status"];
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";

export function getDemoResearchLabState(): ResearchLabState {
  return {
    rooms: laboratoryRooms,
    projects: researchProjects,
    labInstances,
    cards: initialWorkflowCards,
    logs: agentLogs,
    claims: [],
    evidence: [],
    debateSessions: [],
    hypotheses: [],
    experimentPlans: [],
    mode: "demo",
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${configuredApiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API ${path} failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function loadResearchLabState(): Promise<ResearchLabState> {
  if (!configuredApiBaseUrl) {
    return getDemoResearchLabState();
  }

  const [projects, labInstances, rooms, cards, logs, claims, evidence, debateSessions, hypotheses, experimentPlans] = await Promise.all([
    fetchJson<ResearchProjectData[]>("/projects"),
    fetchJson<LabInstanceData[]>("/lab-instances"),
    fetchJson<LaboratoryRoomData[]>("/rooms"),
    fetchJson<WorkflowCardData[]>("/cards"),
    fetchJson<AgentLogEntry[]>("/agent-logs"),
    fetchJson<ResearchClaimRecord[]>("/claims"),
    fetchJson<EvidenceRecord[]>("/evidence"),
    fetchJson<DebateSessionRecord[]>("/debate-sessions"),
    fetchJson<HypothesisRecord[]>("/hypotheses"),
    fetchJson<ExperimentPlanRecord[]>("/experiment-plans"),
  ]);

  return {
    projects,
    labInstances,
    rooms,
    cards,
    logs,
    claims,
    evidence,
    debateSessions,
    hypotheses,
    experimentPlans,
    mode: "api",
  };
}

export async function submitLeaderDecision(
  cardId: string,
  decision: LeaderDecisionValue,
  reason: string,
): Promise<void> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  await fetchJson("/leader-decisions", {
    method: "POST",
    body: JSON.stringify({ cardId, decision, reason }),
  });
}

export async function registerIngestFolder(path: string, projectId: string, labId?: string): Promise<IngestFolderRecord> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  return fetchJson<IngestFolderRecord>("/ingest/folder", {
    method: "POST",
    body: JSON.stringify({ path, projectId, labId }),
  });
}

export async function scanIngestFolder(): Promise<IngestScanResult> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  return fetchJson<IngestScanResult>("/ingest/scan", {
    method: "POST",
  });
}

export async function runAgentAction(
  cardId: string,
  action: AgentActionValue,
): Promise<AgentActionResult> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  return fetchJson<AgentActionResult>("/agent-actions", {
    method: "POST",
    body: JSON.stringify({ cardId, action }),
  });
}

export async function createWorkflowCard(input: CreateWorkflowCardInput): Promise<WorkflowCardData> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  return fetchJson<WorkflowCardData>("/cards", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateWorkflowCard(cardId: string, input: UpdateWorkflowCardInput): Promise<WorkflowCardData> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  return fetchJson<WorkflowCardData>(`/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteWorkflowCard(cardId: string): Promise<void> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  await fetchJson(`/cards/${cardId}`, {
    method: "DELETE",
  });
}

export async function createResearchProject(input: CreateResearchProjectInput): Promise<ResearchProjectData> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  return fetchJson<ResearchProjectData>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function patchLabInstance(labId: string, input: PatchLabInstanceInput): Promise<LabInstanceData> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  return fetchJson<LabInstanceData>(`/lab-instances/${labId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
