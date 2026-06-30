import { agentLogs, initialWorkflowCards, laboratoryRooms } from "../data/demoResearchLab";
import type { AgentLogEntry, LaboratoryRoomData, WorkflowCardData } from "../types/research";

export type ResearchDataMode = "demo" | "api";
export type LeaderDecisionValue = "approved" | "rejected" | "needs_revision" | "stored_in_library";

export interface ResearchLabState {
  rooms: LaboratoryRoomData[];
  cards: WorkflowCardData[];
  logs: AgentLogEntry[];
  mode: ResearchDataMode;
}

export interface IngestFolderRecord {
  id: string;
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

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";

export function getDemoResearchLabState(): ResearchLabState {
  return {
    rooms: laboratoryRooms,
    cards: initialWorkflowCards,
    logs: agentLogs,
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

  const [rooms, cards, logs] = await Promise.all([
    fetchJson<LaboratoryRoomData[]>("/rooms"),
    fetchJson<WorkflowCardData[]>("/cards"),
    fetchJson<AgentLogEntry[]>("/agent-logs"),
  ]);

  return {
    rooms,
    cards,
    logs,
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

export async function registerIngestFolder(path: string): Promise<IngestFolderRecord> {
  if (!configuredApiBaseUrl) {
    throw new Error("No API base URL is configured.");
  }

  return fetchJson<IngestFolderRecord>("/ingest/folder", {
    method: "POST",
    body: JSON.stringify({ path }),
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
