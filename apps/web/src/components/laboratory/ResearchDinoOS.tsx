import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  createResearchProject,
  createWorkflowCard,
  deleteWorkflowCard,
  getDemoResearchLabState,
  loadResearchLabState,
  patchLabInstance,
  registerIngestFolder,
  runAgentAction,
  scanIngestFolder,
  submitLeaderDecision,
  updateWorkflowCard,
  type AgentActionValue,
  type AgentRunRecord,
  type CreateResearchProjectInput,
  type CreateWorkflowCardInput,
  type DebateSessionRecord,
  type EvidenceRecord,
  type ExperimentPlanRecord,
  type HypothesisRecord,
  type IngestScanResult,
  type LeaderDecisionValue,
  type ModelRuntimeStatus,
  type PatchLabInstanceInput,
  type ResearchClaimRecord,
  type ResearchDataMode,
  type ResearchLabState,
  type ResearchRunRecord,
  type UpdateWorkflowCardInput,
} from "../../api/researchApi";
import type {
  AgentLogEntry,
  AgentVariant,
  CardType,
  LabInstanceData,
  LabMode,
  LabParallelMode,
  LaboratoryRoomData,
  PaperSourceConnector,
  ResearchProjectData,
  RoomId,
  WorkflowCardData,
  WorkflowStatus,
} from "../../types/research";

type ScreenId = "map" | "debate" | "reader" | "report" | "agents" | "library" | "reports" | "projects" | "tasks" | "settings";

const initialResearchLabState = getDemoResearchLabState();
const defaultProjectId = "project-autophagy";

const sidebarItems: Array<{ id: ScreenId; label: string; icon: IconName }> = [
  { id: "map", label: "Lab Map", icon: "grid" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "tasks", label: "Tasks", icon: "list" },
  { id: "agents", label: "Agents", icon: "agents" },
  { id: "library", label: "Library", icon: "book" },
  { id: "reports", label: "Reports", icon: "doc" },
  { id: "settings", label: "Settings", icon: "sliders" },
];

const topTabs: Array<{ id: ScreenId; label: string; icon: IconName }> = [
  { id: "map", label: "Lab Map", icon: "grid" },
  { id: "debate", label: "Debate Room", icon: "chat" },
  { id: "reader", label: "Paper Reader", icon: "book" },
  { id: "report", label: "Manuscript", icon: "pen" },
  { id: "agents", label: "Agents", icon: "agents" },
];

const agentAssets: Record<AgentVariant, string> = {
  collector: "/brand/agents/search-dino.png",
  coordinator: "/brand/agents/explorer-dino.png",
  search: "/brand/agents/search-dino.png",
  reader: "/brand/agents/reader-dino.png",
  critic: "/brand/agents/critic-dino.png",
  librarian: "/brand/agents/librarian-dino.png",
  leader: "/brand/agents/leader-dino.png",
  strategist: "/brand/agents/strategist-dino.png",
  experiment: "/brand/agents/experiment-dino.png",
  writer: "/brand/agents/writer-dino.png",
};

const roomLayout: Array<{
  id: RoomId;
  x: number;
  y: number;
  w: number;
  h: number;
  icon: IconName;
  clickScreen?: ScreenId;
}> = [
  { id: "leader", x: 430, y: 18, w: 300, h: 180, icon: "crown" },
  { id: "coordinator", x: 420, y: 252, w: 330, h: 182, icon: "nodes" },
  { id: "collection", x: 16, y: 226, w: 255, h: 190, icon: "search" },
  { id: "library", x: 1015, y: 222, w: 285, h: 200, icon: "shelf", clickScreen: "library" },
  { id: "reading", x: 14, y: 494, w: 260, h: 172, icon: "book", clickScreen: "reader" },
  { id: "debate", x: 315, y: 494, w: 245, h: 172, icon: "chat", clickScreen: "debate" },
  { id: "strategy", x: 580, y: 494, w: 245, h: 172, icon: "chart" },
  { id: "experiment", x: 845, y: 494, w: 245, h: 172, icon: "flask" },
  { id: "writing", x: 1110, y: 494, w: 190, h: 172, icon: "pen", clickScreen: "report" },
];

const roomPurpose: Record<RoomId, string> = {
  leader: "Final decisions & oversight",
  coordinator: "Triage, assign, & coordinate",
  collection: "Discover & collect papers",
  library: "Store & organize knowledge",
  reading: "Deep read & summarize",
  debate: "Critique & discuss claims",
  strategy: "Identify gaps & hypotheses",
  experiment: "Design & validate experiments",
  writing: "Draft & refine manuscripts",
};

const roomAgentMap: Record<RoomId, AgentVariant> = {
  coordinator: "coordinator",
  collection: "search",
  reading: "reader",
  debate: "critic",
  leader: "leader",
  library: "librarian",
  strategy: "strategist",
  experiment: "experiment",
  writing: "writer",
};

const taskTypeOptions: Array<{ value: CardType; label: string }> = [
  { value: "review", label: "Review" },
  { value: "paper", label: "Paper" },
  { value: "claim", label: "Claim" },
  { value: "claim_debate", label: "Claim Debate" },
  { value: "hypothesis", label: "Hypothesis" },
  { value: "experiment", label: "Experiment" },
  { value: "manuscript", label: "Manuscript" },
];

const taskRoomOptions: Array<{ value: RoomId; label: string }> = [
  { value: "coordinator", label: "Coordinator" },
  { value: "collection", label: "Search Dock" },
  { value: "reading", label: "Reading Bench" },
  { value: "debate", label: "Debate Room" },
  { value: "strategy", label: "Strategy Room" },
  { value: "experiment", label: "Experiment Bay" },
  { value: "leader", label: "Leader Office" },
  { value: "library", label: "Library" },
  { value: "writing", label: "Writing Studio" },
];

type AutonomyMode = "manual" | "assisted" | "auto";
type SourceAccessMethod = "api_key" | "browser_session" | "institution_sso" | "manual_entitlement";
type SourceAccountStatus = "connected" | "needs_reauth" | "not_configured";

type SourceAccountConnection = {
  status: SourceAccountStatus;
  method: SourceAccessMethod;
  accountLabel: string;
  institution: string;
  credentialRef: string;
  secretFingerprint: string;
  lastCheckedAt: string;
};

type ControlSettings = {
  sourceEnabled: Record<string, boolean>;
  sourceAccounts: Record<string, SourceAccountConnection>;
  autonomyMode: AutonomyMode;
  autoApproveLowRisk: boolean;
  maxParallelTasks: number;
  localInference: boolean;
  reasoningModel: string;
  readingModel: string;
};

const controlSettingsStorageKey = "researchdino-control-settings";

const sourceAccessMethodLabels: Record<SourceAccessMethod, string> = {
  api_key: "API key",
  browser_session: "Browser session",
  institution_sso: "Institution SSO",
  manual_entitlement: "Manual entitlement",
};

function sourceAccessMethodsFor(connector: PaperSourceConnector): SourceAccessMethod[] {
  if (connector.provider === "elsevier") return ["api_key", "institution_sso", "browser_session", "manual_entitlement"];
  if (connector.provider === "nature" || connector.provider === "science") {
    return ["institution_sso", "browser_session", "manual_entitlement"];
  }
  return ["manual_entitlement"];
}

function defaultSourceAccount(connector: PaperSourceConnector): SourceAccountConnection {
  const method = sourceAccessMethodsFor(connector)[0] ?? "manual_entitlement";
  return {
    status: "not_configured",
    method,
    accountLabel: "",
    institution: "",
    credentialRef: "",
    secretFingerprint: "",
    lastCheckedAt: "",
  };
}

function fingerprintSecret(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) return "";
  const visible = trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
  return `saved ref ending ${visible.padStart(4, "*")}`;
}

type AgentProfile = {
  mission: string;
  inputs: string[];
  method: string[];
  outputs: string[];
  handoffs: string[];
  qualityGate: string;
};

const agentProfiles: Record<AgentVariant, AgentProfile> = {
  leader: {
    mission: "Owns final scientific judgment. The Leader approves, rejects, or sends work back for re-analysis.",
    inputs: ["Coordinator briefs", "debate conclusions", "critic objections", "experiment feasibility", "library trace status"],
    method: ["Checks whether claims are source-backed.", "Looks for unresolved objections or missing controls.", "Decides whether the output can move forward."],
    outputs: ["approval decision", "rejection reason", "more-evidence request", "library storage gate"],
    handoffs: ["Coordinator", "Library", "Strategy Room", "Experiment Bay"],
    qualityGate: "Nothing becomes reusable knowledge until the Leader can trace claim, evidence, objection, and decision criteria.",
  },
  coordinator: {
    mission: "Turns messy department work into one clean packet for the Leader.",
    inputs: ["Search leads", "Reader extraction", "Critic comments", "Strategy hypotheses", "Experiment risks"],
    method: ["Collects department outputs.", "Removes duplicates and unresolved handoff gaps.", "Builds a short decision brief for review."],
    outputs: ["leader brief", "handoff summary", "blocked issue list", "next-room routing"],
    handoffs: ["Leader Office", "Search Dock", "Debate Room", "Strategy Room", "Experiment Bay"],
    qualityGate: "The brief must show who said what, what evidence supports it, and what still needs a decision.",
  },
  search: {
    mission: "Finds and imports candidate literature from local PDFs, DOI inputs, and publisher metadata sources.",
    inputs: ["local PDF folder", "DOI list", "Nature / Science / Elsevier metadata", "project research question"],
    method: ["Expands search terms.", "Deduplicates candidate papers.", "Tags source availability and access state."],
    outputs: ["paper cards", "metadata records", "source candidates", "missing-access notes"],
    handoffs: ["Reading Bench", "Library", "Coordinator"],
    qualityGate: "Every paper candidate needs source provenance before Reader treats it as evidence.",
  },
  collector: {
    mission: "Collects raw research material and prepares it for Search and Reader processing.",
    inputs: ["PDF folder", "manual files", "metadata exports", "DOI batches"],
    method: ["Validates file paths.", "Groups files by project.", "Creates ingestion tasks."],
    outputs: ["ingest queue", "file inventory", "parse error cards"],
    handoffs: ["Search Dock", "Reading Bench"],
    qualityGate: "No raw file should enter the workflow without project ownership and source metadata.",
  },
  reader: {
    mission: "Reads papers deeply and extracts claims, methods, evidence, limitations, and citation traces.",
    inputs: ["paper cards", "PDF text", "metadata", "project questions"],
    method: ["Segments the paper.", "Extracts claims and evidence spans.", "Separates result, method, limitation, and speculation."],
    outputs: ["claim candidates", "evidence spans", "method notes", "limitation notes"],
    handoffs: ["Debate Room", "Critic Dino", "Strategy Room", "Library"],
    qualityGate: "A claim is not usable unless it points back to source text, figure, table, or metadata trace.",
  },
  critic: {
    mission: "Attacks weak reasoning before it can become strategy, experiment design, or manuscript text.",
    inputs: ["Reader claims", "evidence spans", "methods", "statistics", "conflicting papers"],
    method: ["Challenges controls and sample size.", "Searches for contradictions.", "Marks unsupported jumps and missing evidence."],
    outputs: ["critic comments", "unresolved questions", "counter-evidence list", "revision request"],
    handoffs: ["Debate Room", "Coordinator", "Strategy Room", "Leader Office"],
    qualityGate: "Every criticism must identify the exact claim or evidence gap it is challenging.",
  },
  strategist: {
    mission: "Converts approved knowledge and unresolved debate into research gaps, hypotheses, and study direction.",
    inputs: ["Library records", "debate conclusions", "critic objections", "project goals"],
    method: ["Scores novelty and feasibility.", "Builds competing hypotheses.", "Routes testable ideas to Experiment Bay."],
    outputs: ["research gaps", "hypothesis cards", "strategy scores", "experiment strategy inputs"],
    handoffs: ["Experiment Bay", "Writing Studio", "Coordinator", "Leader Office"],
    qualityGate: "A strategy must be literature-grounded and experimentally or analytically testable.",
  },
  experiment: {
    mission: "Turns hypotheses and debate outcomes into variables, controls, readouts, protocols, and risk checks.",
    inputs: ["hypothesis cards", "strategy scores", "critic objections", "source methods", "feasibility constraints"],
    method: ["Defines variables and controls.", "Checks readouts and failure criteria.", "Flags protocol and resource risks."],
    outputs: ["experiment plan", "control matrix", "readout list", "risk register"],
    handoffs: ["Strategy Room", "Leader Office", "Writing Studio", "Library"],
    qualityGate: "An experiment plan must be falsifiable and tied back to the debate or literature gap that motivated it.",
  },
  librarian: {
    mission: "Stores only approved, traceable research knowledge for later search, strategy, and writing reuse.",
    inputs: ["Leader-approved cards", "source traces", "evidence links", "decision records"],
    method: ["Normalizes metadata.", "Links claims to evidence and decisions.", "Blocks unsupported material from reuse."],
    outputs: ["library records", "metadata entries", "evidence indexes", "citation-ready traces"],
    handoffs: ["Search Dock", "Strategy Room", "Writing Studio", "Leader Office"],
    qualityGate: "Library records must preserve provenance: source, claim, evidence, critic status, and approval decision.",
  },
  writer: {
    mission: "Drafts citation-backed manuscript sections from Library-approved evidence and strategy outputs.",
    inputs: ["library records", "approved claims", "strategy outline", "experiment plans"],
    method: ["Builds section outlines.", "Writes only traceable claims.", "Flags missing citations or weak evidence."],
    outputs: ["manuscript outline", "draft sections", "citation TODOs", "coherence checks"],
    handoffs: ["Leader Office", "Library", "Strategy Room"],
    qualityGate: "No manuscript sentence should claim more than the approved evidence can support.",
  },
};

const quickActions = ["New Claim", "Import Paper", "Create Task"] as const;
const runningStatuses = new Set(["running", "debating"]);
const waitingStatuses = new Set(["queued", "waiting_for_user", "waiting_for_leader_review", "waiting_for_claim"]);
const completeStatuses = new Set(["approved", "stored_in_library", "archived"]);

type IconName =
  | "agents"
  | "book"
  | "chart"
  | "chat"
  | "crown"
  | "doc"
  | "flask"
  | "folder"
  | "grid"
  | "list"
  | "nodes"
  | "pen"
  | "search"
  | "send"
  | "shelf"
  | "sliders";

function priorityLabel(card: WorkflowCardData, index: number) {
  if (card.requiresUserReview || card.status === "waiting_for_user") return "High";
  if (card.status === "running" || card.status === "debating") return "Medium";
  return index % 2 === 0 ? "Medium" : "Low";
}

function displayStatus(status: string) {
  return status.replace(/_/g, " ");
}

function currentDisplayTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function progressForStatus(status: WorkflowStatus) {
  if (status === "queued" || status === "idle" || status === "waiting_for_claim") return 18;
  if (status === "running") return 48;
  if (status === "debating") return 62;
  if (status === "waiting_for_user" || status === "waiting_for_leader_review" || status === "needs_more_evidence") return 82;
  return 100;
}

function approvalForStatus(status: WorkflowStatus): WorkflowCardData["approvalStatus"] {
  if (status === "approved") return "approved";
  if (status === "stored_in_library") return "stored_in_library";
  if (status === "rejected") return "rejected";
  if (status === "waiting_for_user" || status === "waiting_for_leader_review") return "pending_review";
  if (status === "needs_more_evidence") return "needs_revision";
  return "draft";
}

function defaultControlSettings(sourceConnectors: PaperSourceConnector[]): ControlSettings {
  return {
    sourceEnabled: Object.fromEntries(sourceConnectors.map((connector) => [connector.id, connector.enabled])),
    sourceAccounts: Object.fromEntries(sourceConnectors.map((connector) => [connector.id, defaultSourceAccount(connector)])),
    autonomyMode: "assisted",
    autoApproveLowRisk: false,
    maxParallelTasks: 6,
    localInference: true,
    reasoningModel: "qwen3.5:latest",
    readingModel: "qwen3.5:latest",
  };
}

function mergeControlSettings(base: ControlSettings, sourceConnectors: PaperSourceConnector[]): ControlSettings {
  return {
    ...base,
    sourceEnabled: {
      ...Object.fromEntries(sourceConnectors.map((connector) => [connector.id, connector.enabled])),
      ...base.sourceEnabled,
    },
    sourceAccounts: {
      ...Object.fromEntries(sourceConnectors.map((connector) => [connector.id, defaultSourceAccount(connector)])),
      ...(base.sourceAccounts ?? {}),
    },
  };
}

function loadControlSettings(sourceConnectors: PaperSourceConnector[]): ControlSettings {
  const fallback = defaultControlSettings(sourceConnectors);
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(controlSettingsStorageKey);
    if (!stored) return fallback;
    return mergeControlSettings({ ...fallback, ...JSON.parse(stored) }, sourceConnectors);
  } catch {
    return fallback;
  }
}

function firstCard(cards: WorkflowCardData[], predicate: (card: WorkflowCardData) => boolean) {
  return cards.find(predicate);
}

function belongsToProject(item: { projectId?: string }, projectId: string) {
  return (item.projectId ?? defaultProjectId) === projectId;
}

function defaultLabIdForProject(projectId?: string) {
  if (projectId === "project-layered-materials") return "lab-beta";
  if (projectId === "project-orbital-systems") return "lab-gamma";
  return "lab-alpha";
}

function labIdForItem(item: { projectId?: string; labId?: string }) {
  return item.labId ?? defaultLabIdForProject(item.projectId);
}

function belongsToLab(item: { projectId?: string; labId?: string }, labId: string) {
  return labIdForItem(item) === labId;
}

function belongsToLabInstance(item: { projectId?: string; labId?: string }, lab: LabInstanceData | undefined) {
  if (!lab) return belongsToLab(item, "lab-alpha");
  if (item.labId) return item.labId === lab.id;
  return belongsToProject(item, lab.projectId);
}

function nextProjectId(projects: ResearchProjectData[], currentProjectId: string, offset = 1) {
  if (projects.length === 0) return defaultProjectId;
  const currentIndex = Math.max(0, projects.findIndex((project) => project.id === currentProjectId));
  return projects[(currentIndex + offset) % projects.length]?.id ?? projects[0].id;
}

function labModeForIndex(index: number): LabMode {
  return index === 0 ? "full" : index === 1 ? "strategy" : "experiment";
}

export function ResearchDinoOS() {
  const [screen, setScreen] = useState<ScreenId>("map");
  const [projects, setProjects] = useState<ResearchProjectData[]>(initialResearchLabState.projects);
  const [activeProjectId, setActiveProjectId] = useState(initialResearchLabState.projects[0]?.id ?? defaultProjectId);
  const [labInstances, setLabInstances] = useState<LabInstanceData[]>(initialResearchLabState.labInstances);
  const [activeLabId, setActiveLabId] = useState(initialResearchLabState.labInstances.find((lab) => lab.enabled)?.id ?? "lab-alpha");
  const [parallelMode, setParallelModeState] = useState<LabParallelMode>(() => {
    const saved = window.localStorage.getItem("researchdino-parallel-mode");
    return saved === "same_topic" || saved === "split_topics" || saved === "independent_topics"
      ? saved
      : "independent_topics";
  });
  const [rooms, setRooms] = useState<LaboratoryRoomData[]>(initialResearchLabState.rooms);
  const [cards, setCards] = useState<WorkflowCardData[]>(initialResearchLabState.cards);
  const [logs, setLogs] = useState<AgentLogEntry[]>(initialResearchLabState.logs);
  const [agentRuns, setAgentRuns] = useState<AgentRunRecord[]>(initialResearchLabState.agentRuns);
  const [researchRuns, setResearchRuns] = useState<ResearchRunRecord[]>(initialResearchLabState.researchRuns);
  const [modelRuntime, setModelRuntime] = useState<ModelRuntimeStatus>(initialResearchLabState.modelRuntime);
  const [claims, setClaims] = useState<ResearchClaimRecord[]>(initialResearchLabState.claims);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>(initialResearchLabState.evidence);
  const [debateSessions, setDebateSessions] = useState<DebateSessionRecord[]>(initialResearchLabState.debateSessions);
  const [hypotheses, setHypotheses] = useState<HypothesisRecord[]>(initialResearchLabState.hypotheses);
  const [experimentPlans, setExperimentPlans] = useState<ExperimentPlanRecord[]>(initialResearchLabState.experimentPlans);
  const [dataMode, setDataMode] = useState<ResearchDataMode>(initialResearchLabState.mode);
  const [loadError, setLoadError] = useState<string>();
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string>();
  const [ingestPath, setIngestPath] = useState("");
  const [ingestResult, setIngestResult] = useState<IngestScanResult>();

  function applyResearchLabState(nextState: ResearchLabState) {
    setProjects(nextState.projects);
    setLabInstances(nextState.labInstances);
    setActiveLabId((current) =>
      nextState.labInstances.some((lab) => lab.id === current && lab.enabled)
        ? current
        : nextState.labInstances.find((lab) => lab.enabled)?.id ?? nextState.labInstances[0]?.id ?? "lab-alpha",
    );
    setRooms(nextState.rooms);
    setCards(nextState.cards);
    setLogs(nextState.logs);
    setAgentRuns(nextState.agentRuns);
    setResearchRuns(nextState.researchRuns);
    setModelRuntime(nextState.modelRuntime);
    setClaims(nextState.claims);
    setEvidence(nextState.evidence);
    setDebateSessions(nextState.debateSessions);
    setHypotheses(nextState.hypotheses);
    setExperimentPlans(nextState.experimentPlans);
    setDataMode(nextState.mode);
  }

  async function refreshState() {
    const state = await loadResearchLabState();
    applyResearchLabState(state);
  }

  useEffect(() => {
    let cancelled = false;
    loadResearchLabState()
      .then((nextState) => {
        if (cancelled) return;
        applyResearchLabState(nextState);
        setLoadError(undefined);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setDataMode("demo");
        setLoadError(`API unavailable: ${message}. Showing demo data.`);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roomLookup = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const enabledLabs = useMemo(() => labInstances.filter((lab) => lab.enabled), [labInstances]);
  const activeLab = labInstances.find((lab) => lab.id === activeLabId && lab.enabled) ?? enabledLabs[0] ?? labInstances[0];
  const activeProject = projects.find((project) => project.id === (activeLab?.projectId ?? activeProjectId)) ?? projects.find((project) => project.id === activeProjectId) ?? projects[0];

  useEffect(() => {
    if (activeLab?.projectId && activeLab.projectId !== activeProjectId) {
      setActiveProjectId(activeLab.projectId);
    }
  }, [activeLab?.projectId, activeProjectId]);

  const projectCards = useMemo(
    () => cards.filter((card) => belongsToProject(card, activeProject?.id ?? defaultProjectId) && belongsToLabInstance(card, activeLab)),
    [activeLab?.id, activeProject?.id, cards],
  );
  const projectLogCount = useMemo(
    () => logs.filter((log) => belongsToProject(log, activeProject?.id ?? defaultProjectId) && belongsToLabInstance(log, activeLab)).length,
    [activeLab?.id, activeProject?.id, logs],
  );
  const projectAgentRuns = useMemo(
    () => agentRuns.filter((run) => belongsToProject(run, activeProject?.id ?? defaultProjectId) && belongsToLabInstance(run, activeLab)),
    [activeLab?.id, activeProject?.id, agentRuns],
  );
  const projectResearchRuns = useMemo(
    () => researchRuns.filter((run) => belongsToProject(run, activeProject?.id ?? defaultProjectId) && belongsToLabInstance(run, activeLab)),
    [activeLab?.id, activeProject?.id, researchRuns],
  );
  const activePaper = firstCard(projectCards, (card) => card.type === "paper" && card.status !== "failed");
  const activeDebate =
    firstCard(projectCards, (card) => card.type === "claim_debate" && card.status !== "stored_in_library") ??
    firstCard(projectCards, (card) => card.type === "claim_debate");
  const reviewCards = projectCards.filter((card) => card.requiresUserReview || card.status === "waiting_for_user" || card.status === "waiting_for_leader_review");
  const libraryCards = projectCards.filter((card) => card.currentRoom === "library" || card.status === "stored_in_library");

  const stats = useMemo(() => {
    const inProgress = projectCards.filter((card) => runningStatuses.has(card.status)).length;
    const waiting = projectCards.filter((card) => waitingStatuses.has(card.status)).length;
    const completed = projectCards.filter((card) => completeStatuses.has(card.status)).length;
    return {
      totalTasks: projectCards.length,
      inProgress,
      waiting,
      completed,
      running: inProgress,
      online: new Set(rooms.map((room) => room.agent)).size,
      successRate: 98,
    };
  }, [projectCards, rooms]);

  const ledgerStats = useMemo(() => {
    const projectId = activeProject?.id ?? defaultProjectId;
    const inScope = (item: { projectId?: string; labId?: string }) => belongsToProject(item, projectId) && belongsToLabInstance(item, activeLab);
    return {
      claims: claims.filter(inScope).length,
      evidence: evidence.filter(inScope).length,
      debateSessions: debateSessions.filter(inScope).length,
      hypotheses: hypotheses.filter(inScope).length,
      experimentPlans: experimentPlans.filter(inScope).length,
    };
  }, [activeLab?.id, activeProject?.id, claims, debateSessions, evidence, experimentPlans, hypotheses]);

  function setParallelMode(mode: LabParallelMode) {
    setParallelModeState(mode);
    window.localStorage.setItem("researchdino-parallel-mode", mode);
  }

  async function persistLabPatches(patches: Array<{ id: string; patch: PatchLabInstanceInput }>) {
    setLabInstances((current) =>
      current.map((lab) => {
        const update = patches.find((item) => item.id === lab.id);
        return update ? { ...lab, ...update.patch } : lab;
      }),
    );

    if (dataMode !== "api") return;

    setBusyAction("labs-update");
    try {
      await Promise.all(patches.map((item) => patchLabInstance(item.id, item.patch)));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(message);
      await refreshState();
    } finally {
      setBusyAction(undefined);
    }
  }

  function handleSelectLab(labId: string) {
    const lab = labInstances.find((item) => item.id === labId);
    setActiveLabId(labId);
    if (lab?.projectId) setActiveProjectId(lab.projectId);
  }

  function handleAssignLabProject(labId: string, projectId: string) {
    void persistLabPatches([{ id: labId, patch: { projectId } }]);
    if (labId === activeLab?.id) setActiveProjectId(projectId);
    setActionMessage(`Lab assigned to ${projects.find((project) => project.id === projectId)?.title ?? "project"}.`);
  }

  function handleSetLabCount(count: number) {
    const patches = labInstances.map((lab, index) => ({
      id: lab.id,
      patch: {
        enabled: index < count,
        status: index < count ? (lab.status === "idle" ? "queued" : lab.status) : "idle",
      } satisfies PatchLabInstanceInput,
    }));
    const nextActive = labInstances.find((_, index) => index < count)?.id ?? labInstances[0]?.id ?? "lab-alpha";
    if (!labInstances.find((lab, index) => lab.id === activeLab?.id && index < count)) {
      handleSelectLab(nextActive);
    }
    void persistLabPatches(patches);
    setActionMessage(`${count} lab${count > 1 ? "s" : ""} active.`);
  }

  function handleSetParallelMode(mode: LabParallelMode) {
    setParallelMode(mode);
    const currentProjectId = activeProject?.id ?? defaultProjectId;
    const enabled = labInstances.filter((lab) => lab.enabled);
    const patches = labInstances.map((lab, index) => {
      if (!lab.enabled) return { id: lab.id, patch: {} };
      let projectId = currentProjectId;
      if (mode === "independent_topics") {
        projectId = projects[index]?.id ?? currentProjectId;
      }
      if (mode === "split_topics") {
        projectId = enabled.length >= 3 && index < 2 ? currentProjectId : nextProjectId(projects, currentProjectId, index);
      }
      return {
        id: lab.id,
        patch: {
          projectId,
          mode: labModeForIndex(index),
          status: lab.status === "idle" ? "queued" : lab.status,
        } satisfies PatchLabInstanceInput,
      };
    });
    void persistLabPatches(patches);
    setActionMessage(
      mode === "same_topic"
        ? "All active labs are assigned to the same research topic."
        : mode === "split_topics"
          ? "Labs are split across the active topic and adjacent topics."
          : "Labs are assigned to independent research topics.",
    );
  }

  async function handleAgentAction(card: WorkflowCardData | undefined, action: AgentActionValue, nextScreen?: ScreenId) {
    if (!card) {
      setActionMessage("No card is available for that action yet.");
      return;
    }
    if (dataMode !== "api") {
      setActionMessage("API mode is required. Run the local API and open the API-connected app URL.");
      return;
    }
    setBusyAction(`${action}:${card.id}`);
    setActionMessage("");
    try {
      const result = await runAgentAction(card.id, action);
      await refreshState();
      setActionMessage(result.message);
      if (nextScreen) setScreen(nextScreen);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(message);
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleLeaderDecision(card: WorkflowCardData | undefined, decision: LeaderDecisionValue) {
    if (!card) {
      setActionMessage("No Leader review item is available.");
      return;
    }
    if (dataMode !== "api") {
      setActionMessage("API mode is required for Leader decisions.");
      return;
    }
    setBusyAction(`${decision}:${card.id}`);
    setActionMessage("");
    try {
      await submitLeaderDecision(card.id, decision, `Decision recorded from ${screen} screen.`);
      await refreshState();
      setActionMessage(`Leader decision recorded: ${displayStatus(decision)}.`);
      if (decision === "stored_in_library") setScreen("library");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(message);
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleIngestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ingestPath.trim()) {
      setActionMessage("Enter a local paper folder path first.");
      return;
    }
    if (dataMode !== "api") {
      setActionMessage("API mode is required for local PDF ingest.");
      return;
    }
    setBusyAction("ingest");
    setActionMessage("");
    setIngestResult(undefined);
    try {
      const folder = await registerIngestFolder(ingestPath.trim(), activeProject?.id ?? defaultProjectId, activeLab?.id);
      if (!folder.exists) {
        setActionMessage("Folder was registered, but it does not exist on this machine.");
        return;
      }
      const result = await scanIngestFolder();
      setIngestResult(result);
      await refreshState();
      setActionMessage(
        `Scanned ${result.pdfCount} PDFs: ${result.newPaperCount} new, ${result.duplicatePaperCount} existing, ` +
        `${result.parsedPaperCount} parsed, ${result.readerQueueCount} queued for Reader.`,
      );
      setScreen("reader");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(message);
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleCreateTask(input: CreateWorkflowCardInput) {
    const title = input.title.trim();
    if (!title) {
      setActionMessage("Task title is required.");
      return;
    }
    setBusyAction("task-create");
    setActionMessage("");
    try {
      if (dataMode === "api") {
        await createWorkflowCard({ ...input, title, labId: input.labId ?? activeLab?.id });
        await refreshState();
      } else {
        const agent = roomAgentMap[input.currentRoom];
        const card: WorkflowCardData = {
          id: `task-${Date.now()}`,
          projectId: input.projectId,
          labId: input.labId ?? activeLab?.id,
          title,
          type: input.type,
          currentRoom: input.currentRoom,
          status: "queued",
          progress: progressForStatus("queued"),
          assignedAgent: agent,
          lastAgent: agent,
          lastUpdated: currentDisplayTime(),
          requiresUserReview: false,
          evidenceCount: 0,
          approvalStatus: "draft",
          summary: input.summary?.trim() || `Manual task created for ${input.currentRoom}.`,
          details: { "Created from": "Task Board" },
        };
        setCards((current) => [card, ...current]);
      }
      setActionMessage(`Task added: ${title}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(message);
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleCreateProject(input: CreateResearchProjectInput) {
    const title = input.title.trim();
    if (!title) {
      setActionMessage("Project title is required.");
      return;
    }
    setBusyAction("project-create");
    setActionMessage("");
    try {
      const targetLabId = activeLab?.id ?? "lab-alpha";
      if (dataMode === "api") {
        const project = await createResearchProject({ ...input, title });
        setActiveProjectId(project.id);
        setActiveLabId(targetLabId);
        await persistLabPatches([{ id: targetLabId, patch: { projectId: project.id } }]);
        await refreshState();
      } else {
        const project: ResearchProjectData = {
          id: `project-${Date.now()}`,
          title,
          shortTitle: input.shortTitle?.trim() || title,
          domain: input.domain?.trim() || "Research",
          description: input.description?.trim() || `Research workspace for ${title}.`,
          status: input.status ?? "active",
          sourceNote: input.sourceNote?.trim() || "Source pending",
          lead: input.lead?.trim() || "ResearchDino Lab",
          createdAt: new Date().toISOString(),
        };
        setProjects((current) => [...current, project]);
        setActiveProjectId(project.id);
        setActiveLabId(targetLabId);
        void persistLabPatches([{ id: targetLabId, patch: { projectId: project.id } }]);
      }
      setActionMessage(`Project created: ${title}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(message);
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handlePatchTask(card: WorkflowCardData, patch: UpdateWorkflowCardInput) {
    setBusyAction(`task-update:${card.id}`);
    setActionMessage("");
    try {
      if (dataMode === "api") {
        await updateWorkflowCard(card.id, patch);
        await refreshState();
      } else {
        setCards((current) =>
          current.map((item) => {
            if (item.id !== card.id) return item;
            const nextStatus = patch.status ?? item.status;
            const nextRoom = patch.currentRoom ?? item.currentRoom;
            return {
              ...item,
              ...patch,
              currentRoom: nextRoom,
              status: nextStatus,
              assignedAgent: roomAgentMap[nextRoom],
              lastAgent: roomAgentMap[nextRoom],
              progress: patch.progress ?? progressForStatus(nextStatus),
              requiresUserReview:
                patch.requiresUserReview ??
                ["waiting_for_user", "waiting_for_leader_review", "needs_more_evidence"].includes(nextStatus),
              approvalStatus: approvalForStatus(nextStatus),
              lastUpdated: currentDisplayTime(),
            };
          }),
        );
      }
      setActionMessage(`Task updated: ${card.title}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(message);
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleDeleteTask(card: WorkflowCardData) {
    if (!window.confirm(`Delete task "${card.title}"?`)) return;
    setBusyAction(`task-delete:${card.id}`);
    setActionMessage("");
    try {
      if (dataMode === "api") {
        await deleteWorkflowCard(card.id);
        await refreshState();
      } else {
        setCards((current) => current.filter((item) => item.id !== card.id));
      }
      setActionMessage(`Task removed: ${card.title}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setActionMessage(message);
    } finally {
      setBusyAction(undefined);
    }
  }

  return (
    <main className="rdos-canvas">
      <div className="rdos-shell">
        <aside className="rdos-sidebar">
          <button className="rdos-brand" type="button" onClick={() => setScreen("map")}>
            <img src="/brand/researchdino-mark.png" alt="" />
            <strong>ResearchDino Lab</strong>
          </button>

          <nav className="rdos-nav" aria-label="Primary navigation">
            {sidebarItems.map((item) => (
              <button
                className={screen === item.id ? "is-active" : ""}
                type="button"
                key={item.id}
                onClick={() => setScreen(item.id)}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
          </nav>

          <section className="rdos-sidebar-block">
            <span>Active Lab</span>
            <em>{activeLab?.name ?? "Lab"} - {activeLab?.label ?? "Parallel lab"}</em>
            <strong>{activeProject?.title ?? "Research Project"}</strong>
            <em>{activeProject?.sourceNote ?? "Project source pending"}</em>
            <em>{activeProject?.domain ?? "Domain pending"}</em>
          </section>

          <section className="rdos-stat-list" aria-label="Task summary">
            <StatRow label="Total Tasks" value={stats.totalTasks} />
            <StatRow label="In Progress" value={stats.inProgress} />
            <StatRow label="Waiting" value={stats.waiting} />
            <StatRow label="Completed" value={stats.completed} />
            <StatRow label="Lab Events" value={projectLogCount} />
          </section>

          <section className="rdos-quick-actions">
            <span>Quick Actions</span>
            {quickActions.map((action) => (
              <button
                type="button"
                key={action}
                onClick={() => setScreen(action === "Import Paper" ? "settings" : action === "Create Task" ? "tasks" : "debate")}
              >
                <Icon name={action === "Import Paper" ? "doc" : action === "Create Task" ? "list" : "chat"} />
                {action}
              </button>
            ))}
          </section>
        </aside>

        <section className="rdos-workspace">
          <header className="rdos-topbar">
            <div>
              <span>{screen === "map" ? "Lab Map" : screen}</span>
              <h1>ResearchDino OS</h1>
              <p>AI Research Workflow Overview</p>
            </div>
            <div className="rdos-top-actions">
              <label className="rdos-project-select">
                <small>Active Project</small>
                <select
                  aria-label="Active project"
                  value={activeProject?.id ?? defaultProjectId}
                  onChange={(event) => handleAssignLabProject(activeLab?.id ?? "lab-alpha", event.target.value)}
                >
                  {projects.map((project) => (
                    <option value={project.id} key={project.id}>{project.title}</option>
                  ))}
                </select>
              </label>
              <div className="rdos-system-status">
                <small>System Status</small>
                <strong><i />{dataMode === "api" ? "Local API Connected" : "Mock Workflow Data"}</strong>
              </div>
              <button className="rdos-pill-button" type="button">Filters</button>
              <button className="rdos-icon-button" type="button" aria-label="View settings">
                <Icon name="sliders" />
              </button>
            </div>
            {(loadError || actionMessage) && (
              <p className={loadError ? "rdos-alert" : "rdos-action-message"}>{loadError ?? actionMessage}</p>
            )}
          </header>

          <nav className="rdos-tabs" aria-label="Workspace tabs">
            {topTabs.map((tab) => (
              <button className={screen === tab.id ? "is-active" : ""} type="button" key={tab.id} onClick={() => setScreen(tab.id)}>
                <Icon name={tab.icon} />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="rdos-screen" key={screen}>
            {screen === "map" && (
              <MapScreen
                rooms={rooms}
                cards={projectCards}
                roomLookup={roomLookup}
                stats={stats}
                projects={projects}
                labs={labInstances}
                activeLabId={activeLab?.id ?? activeLabId}
                parallelMode={parallelMode}
                allCards={cards}
                onSelectLab={handleSelectLab}
                onSetLabCount={handleSetLabCount}
                onSetParallelMode={handleSetParallelMode}
                onAssignLabProject={handleAssignLabProject}
                onNavigate={setScreen}
              />
            )}
            {screen === "debate" && (
              <DebateScreen
                card={activeDebate}
                onRunDebate={() => handleAgentAction(activeDebate, "run_debate", "reports")}
                onRunPipeline={() => handleAgentAction(activeDebate, "run_research_pipeline", "reports")}
                onRequestEvidence={() => setScreen("reader")}
                busy={Boolean(busyAction)}
              />
            )}
            {screen === "reader" && (
              <ReaderScreen
                card={activePaper}
                project={activeProject}
                onRunReader={() => handleAgentAction(activePaper, "run_reader", "debate")}
                onRunPipeline={() => handleAgentAction(activePaper, "run_research_pipeline", "reports")}
                busy={Boolean(busyAction)}
              />
            )}
            {screen === "report" && <ManuscriptScreen card={firstCard(projectCards, (card) => card.type === "manuscript")} project={activeProject} />}
            {screen === "agents" && <AgentsScreen rooms={rooms} cards={projectCards} runs={projectAgentRuns} researchRuns={projectResearchRuns} />}
            {screen === "library" && <LibraryScreen project={activeProject} cards={libraryCards} allCards={projectCards} />}
            {screen === "reports" && (
              <ReportsScreen
                project={activeProject}
                reviewCard={reviewCards[0]}
                ledgerStats={ledgerStats}
                onStore={() => handleLeaderDecision(reviewCards[0], "stored_in_library")}
                onRevise={() => handleLeaderDecision(reviewCards[0], "needs_revision")}
                onOpenStudio={() => setScreen("report")}
                busy={Boolean(busyAction)}
              />
            )}
            {screen === "projects" && (
              <ProjectsScreen
                projects={projects}
                cards={cards}
                activeProjectId={activeProject?.id ?? defaultProjectId}
                busy={busyAction === "project-create"}
                onSelectProject={(projectId) => {
                  handleAssignLabProject(activeLab?.id ?? "lab-alpha", projectId);
                  setScreen("map");
                }}
                onOpenMap={() => setScreen("map")}
                onCreateProject={handleCreateProject}
              />
            )}
            {screen === "tasks" && (
              <TasksScreen
                cards={projectCards}
                project={activeProject}
                busy={Boolean(busyAction)}
                onCreate={handleCreateTask}
                onPatch={handlePatchTask}
                onDelete={handleDeleteTask}
              />
            )}
            {screen === "settings" && (
              <SettingsScreen
                dataMode={dataMode}
                modelRuntime={modelRuntime}
                sourceConnectors={rooms.find((room) => room.id === "collection")?.sourceConnectors ?? []}
                ingestPath={ingestPath}
                ingestResult={ingestResult}
                busy={busyAction === "ingest"}
                onPathChange={setIngestPath}
                onSubmit={handleIngestSubmit}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MapScreen({
  rooms,
  cards,
  roomLookup,
  stats,
  projects,
  labs,
  activeLabId,
  parallelMode,
  allCards,
  onSelectLab,
  onSetLabCount,
  onSetParallelMode,
  onAssignLabProject,
  onNavigate,
}: {
  rooms: LaboratoryRoomData[];
  cards: WorkflowCardData[];
  roomLookup: Map<RoomId, LaboratoryRoomData>;
  stats: { online: number; running: number; waiting: number; successRate: number };
  projects: ResearchProjectData[];
  labs: LabInstanceData[];
  activeLabId: string;
  parallelMode: LabParallelMode;
  allCards: WorkflowCardData[];
  onSelectLab: (labId: string) => void;
  onSetLabCount: (count: number) => void;
  onSetParallelMode: (mode: LabParallelMode) => void;
  onAssignLabProject: (labId: string, projectId: string) => void;
  onNavigate: (screen: ScreenId) => void;
}) {
  const queueCards = cards.filter((card) => !completeStatuses.has(card.status)).slice(0, 4);
  const layoutLookup = new Map(roomLayout.map((room) => [room.id, room]));

  return (
    <section className="rdos-map-screen">
      <ParallelLabsPanel
        projects={projects}
        labs={labs}
        activeLabId={activeLabId}
        parallelMode={parallelMode}
        cards={allCards}
        onSelectLab={onSelectLab}
        onSetLabCount={onSetLabCount}
        onSetParallelMode={onSetParallelMode}
        onAssignLabProject={onAssignLabProject}
      />
      <div className="rdos-map-stage">
        <svg className="rdos-map-flow" viewBox="0 0 1300 685" aria-hidden="true">
          <defs>
            <marker id="rdos-arrow-directive" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path className="rdos-arrow-shape" d="M0 0L9 4.5L0 9" fill="#1a1719" />
            </marker>
            <marker id="rdos-arrow-review" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path className="rdos-arrow-shape" d="M0 0L9 4.5L0 9" fill="#8d8d8d" />
            </marker>
            <marker id="rdos-arrow-evidence" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path className="rdos-arrow-shape" d="M0 0L9 4.5L0 9" fill="#2f7d5f" />
            </marker>
            <marker id="rdos-arrow-store" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path className="rdos-arrow-shape" d="M0 0L9 4.5L0 9" fill="#a6a6a6" />
            </marker>
          </defs>
          <ManualFlow d="M580 198V252" live kind="directive" />
          <ManualFlow d="M650 252V198" kind="brief" />
          <ManualFlow d="M420 343H271" live kind="task" />

          <ManualFlow d="M144 416V494" live kind="data" />
          <ManualFlow d="M274 580H315" live kind="data" />
          <ManualFlow d="M560 580H580" live kind="data" />
          <ManualFlow d="M825 580H845" live kind="data" />
          <ManualFlow d="M1090 580H1110" live kind="data" />

          <ManualFlow d="M438 494V462H585V434" kind="brief" />
          <ManualFlow d="M703 494V452H615V434" kind="brief" />
          <ManualFlow d="M968 494V452H660V434" kind="brief" />

          <ManualFlow d="M730 198V218H1015V306" kind="store" />
          <ManualFlow d="M1050 422V460H703V494" kind="store" />
          <ManualFlow d="M1185 422V460H1205V494" kind="store" />
        </svg>

        <MapInfoCards stats={stats} />

        {rooms.map((room) => {
          const layout = layoutLookup.get(room.id);
          if (!layout) return null;
          return (
            <RoomNode
              key={room.id}
              room={room}
              cards={cards.filter((card) => card.currentRoom === room.id)}
              layout={layout}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>

      <section className="rdos-global-queue">
        <div>
          <span>Global Queue</span>
          <button type="button" onClick={() => onNavigate("tasks")}>View All Queue <Icon name="send" /></button>
        </div>
        <div className="rdos-queue-grid">
          {queueCards.map((card, index) => (
            <button type="button" key={card.id} onClick={() => onNavigate(card.currentRoom === "debate" ? "debate" : card.currentRoom === "reading" ? "reader" : "tasks")}>
              <Icon name={card.type === "experiment" ? "flask" : card.type === "manuscript" ? "pen" : card.type === "hypothesis" ? "chart" : "chat"} />
              <strong>{card.title}</strong>
              <small>{displayStatus(card.currentRoom)}</small>
              <em className={`priority-${priorityLabel(card, index).toLowerCase()}`}>{priorityLabel(card, index)}</em>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

const parallelModeLabels: Record<LabParallelMode, string> = {
  same_topic: "Same Topic",
  split_topics: "Split Topics",
  independent_topics: "Independent",
};

const labModeLabels: Record<LabMode, string> = {
  full: "Full Workflow",
  literature: "Literature",
  debate: "Debate",
  strategy: "Strategy",
  experiment: "Experiment",
  writing: "Writing",
};

function ParallelLabsPanel({
  projects,
  labs,
  activeLabId,
  parallelMode,
  cards,
  onSelectLab,
  onSetLabCount,
  onSetParallelMode,
  onAssignLabProject,
}: {
  projects: ResearchProjectData[];
  labs: LabInstanceData[];
  activeLabId: string;
  parallelMode: LabParallelMode;
  cards: WorkflowCardData[];
  onSelectLab: (labId: string) => void;
  onSetLabCount: (count: number) => void;
  onSetParallelMode: (mode: LabParallelMode) => void;
  onAssignLabProject: (labId: string, projectId: string) => void;
}) {
  const enabledCount = labs.filter((lab) => lab.enabled).length;

  return (
    <section className="rdos-parallel-panel" aria-label="Parallel lab orchestration">
      <header>
        <div>
          <span>Parallel Labs</span>
          <h2>{enabledCount} Research Labs Running</h2>
        </div>
        <div className="rdos-parallel-controls">
          <div className="rdos-mini-segment" aria-label="Lab count">
            {[1, 2, 3].map((count) => (
              <button className={enabledCount === count ? "is-active" : ""} type="button" key={count} onClick={() => onSetLabCount(count)}>
                {count} Lab{count > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          <div className="rdos-mini-segment" aria-label="Lab topic mode">
            {(Object.keys(parallelModeLabels) as LabParallelMode[]).map((mode) => (
              <button className={parallelMode === mode ? "is-active" : ""} type="button" key={mode} onClick={() => onSetParallelMode(mode)}>
                {parallelModeLabels[mode]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="rdos-lab-strip">
        {labs.map((lab) => {
          const project = projects.find((item) => item.id === lab.projectId) ?? projects[0];
          const labCards = cards.filter((card) => belongsToProject(card, lab.projectId) && belongsToLabInstance(card, lab));
          const running = labCards.filter((card) => runningStatuses.has(card.status)).length;
          const waiting = labCards.filter((card) => waitingStatuses.has(card.status)).length;
          const complete = labCards.filter((card) => completeStatuses.has(card.status)).length;
          return (
            <article
              className={`rdos-lab-card${lab.id === activeLabId ? " is-active" : ""}${lab.enabled ? "" : " is-disabled"}`}
              key={lab.id}
            >
              <button className="rdos-lab-card-main" type="button" disabled={!lab.enabled} onClick={() => onSelectLab(lab.id)}>
                <div>
                  <span>{lab.name}</span>
                  <strong>{project?.shortTitle ?? project?.title ?? "Project"}</strong>
                  <em>{labModeLabels[lab.mode]} / {displayStatus(lab.status)}</em>
                </div>
                <MiniLabMap active={lab.enabled} />
              </button>
              <label className="rdos-lab-project-picker">
                <span>Topic</span>
                <select value={lab.projectId} disabled={!lab.enabled} onChange={(event) => onAssignLabProject(lab.id, event.target.value)}>
                  {projects.map((option) => (
                    <option value={option.id} key={option.id}>{option.title}</option>
                  ))}
                </select>
              </label>
              <footer>
                <span>{labCards.length} Cards</span>
                <span>{running} Running</span>
                <span>{waiting} Waiting</span>
                <span>{complete} Done</span>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MiniLabMap({ active }: { active: boolean }) {
  return (
    <div className={`rdos-lab-mini-map${active ? " is-active" : ""}`} aria-hidden="true">
      {roomLayout.map((room) => (
        <i
          key={room.id}
          style={{
            left: `${(room.x / 1300) * 100}%`,
            top: `${(room.y / 685) * 100}%`,
            width: `${Math.max(6, (room.w / 1300) * 100)}%`,
            height: `${Math.max(5, (room.h / 685) * 100)}%`,
          }}
        />
      ))}
    </div>
  );
}

function RoomNode({
  room,
  cards,
  layout,
  onNavigate,
}: {
  room: LaboratoryRoomData;
  cards: WorkflowCardData[];
  layout: (typeof roomLayout)[number];
  onNavigate: (screen: ScreenId) => void;
}) {
  const activeCard = cards[0];
  const clickable = Boolean(layout.clickScreen);
  return (
    <button
      className={`rdos-room-node${clickable ? " is-clickable" : ""}`}
      style={{ left: layout.x, top: layout.y, width: layout.w, height: layout.h }}
      type="button"
      onClick={() => layout.clickScreen && onNavigate(layout.clickScreen)}
    >
      <header>
        <div>
          <strong>{room.title}</strong>
          <span>{roomPurpose[room.id]}</span>
        </div>
        <Icon name={layout.icon} />
      </header>
      <div className="rdos-room-dino">
        <img src={agentAssets[room.agent]} alt="" />
      </div>
      <div className="rdos-room-status">
        {activeCard ? (
          <>
            <b>{activeCard.type.replace(/_/g, " ")}</b>
            <span>{activeCard.title}</span>
            <em>{displayStatus(activeCard.status)}</em>
          </>
        ) : (
          <span className="rdos-empty-slot"><i />Drop a paper here</span>
        )}
      </div>
      <footer>
        <span>{cards.length} Cards</span>
        <span>{room.metrics.waiting} Waiting</span>
        <span>{displayStatus(room.status)}</span>
      </footer>
    </button>
  );
}

function ManualFlow({
  d,
  live = false,
  kind,
}: {
  d: string;
  live?: boolean;
  kind: "brief" | "data" | "directive" | "store" | "task";
}) {
  const markerId = live || kind === "directive" || kind === "task" || kind === "data"
    ? "rdos-arrow-evidence"
    : undefined;
  return (
    <g className={`rdos-flow-group rdos-flow-group--${kind}${live ? " is-live" : ""}`}>
      <path
        className={`rdos-flow-line rdos-flow-line--${kind}${live ? " is-live" : ""}`}
        d={d}
        markerEnd={markerId ? `url(#${markerId})` : undefined}
      />
    </g>
  );
}

function MapInfoCards({ stats }: { stats: { online: number; running: number; waiting: number; successRate: number } }) {
  return (
    <>
      <aside className="rdos-map-card rdos-flow-guide-card">
        <strong>Workflow Path</strong>
        <span><b>1</b> Leader gives direction; Coordinator routes work.</span>
        <span><b>2</b> Search collects papers; Reader extracts evidence.</span>
        <span><b>3</b> Debate tests claims; Strategy turns gaps into hypotheses.</span>
        <span><b>4</b> Experiment designs validation; Writer drafts from approved evidence.</span>
        <span><b>5</b> Leader approval moves reusable knowledge into Library.</span>
      </aside>
      <aside className="rdos-map-card rdos-legend-card">
        <strong>Legend</strong>
        <span><i className="solid" />Directive</span>
        <span><i className="dash" />Brief / Review</span>
        <span><i className="long" />Evidence Flow</span>
        <span><i className="dot" />Library Reuse</span>
      </aside>
      <aside className="rdos-map-card rdos-health-card">
        <strong>System Health</strong>
        <StatRow label="Agents Online" value={`${stats.online} / ${stats.online}`} />
        <StatRow label="Tasks Running" value={stats.running} />
        <StatRow label="Queue Length" value={stats.waiting} />
        <div className="rdos-health-bar-row">
          <span>Success Rate</span>
          <b><i style={{ width: `${stats.successRate}%` }} />{stats.successRate}%</b>
        </div>
        <StatRow label="Last Updated" value="2 min ago" />
      </aside>
    </>
  );
}

function DebateScreen({
  card,
  onRunDebate,
  onRunPipeline,
  onRequestEvidence,
  busy,
}: {
  card?: WorkflowCardData;
  onRunDebate: () => void;
  onRunPipeline: () => void;
  onRequestEvidence: () => void;
  busy: boolean;
}) {
  const claimText = detailText(card, "claim_text", card?.title ?? "No active debate card yet");
  const sourcePaper = detailText(card, "source_paper", "Source paper pending");
  const support = detailList(card, "supporting_evidence", ["Reader has not submitted supporting evidence yet."]);
  const opposition = detailList(card, "opposing_evidence", ["Critic has not submitted objections yet."]);
  const criticComments = detailList(card, "critic_comments", opposition);
  const hypotheses = detailList(card, "strategist_hypotheses", ["Strategist hypothesis is pending."]);
  const experiments = detailList(card, "experiment_strategy_outputs", detailList(card, "suggested_experiments", ["Experiment feasibility is pending."]));
  const protocol = detailList(card, "debate_protocol", [
    "Reader presents source-backed claims and evidence traces.",
    "Critic attacks controls, statistics, contradictions, and missing evidence.",
    "Strategist converts unresolved conflict into competing hypotheses.",
    "Experiment deputy checks whether hypotheses can be falsified.",
    "Librarian blocks unsupported knowledge from storage.",
    "Coordinator sends a conclusion packet to Leader.",
  ]);
  const positions = detailList(card, "agent_positions", [
    "Reader: defend only source-backed claims.",
    "Critic: find weak evidence, missing controls, and contradictions.",
    "Strategist: turn conflict into useful research gaps.",
    "Experiment: test whether hypotheses are feasible and falsifiable.",
    "Librarian: store only approved, traceable conclusions.",
    "Leader: approve, reject, or request more evidence.",
  ]);
  const crossExam = detailList(card, "cross_examination", [
    `Critic challenges: ${criticComments[0]}`,
    `Reader answers with source trace: ${support[0]}`,
    `Strategist reframes as hypothesis: ${hypotheses[0]}`,
  ]);
  const hypothesisTests = detailList(card, "hypothesis_tests", [
    "Can the claim survive the strongest opposing evidence?",
    "Can the mechanism be separated from technical artifact?",
    "Can Experiment Bay define controls before the claim enters Library?",
  ]);
  const researchStrategy = detailList(card, "research_strategy_outputs", [
    "Expand literature around contradictions, replication, and missing controls.",
    "Rank gaps by novelty, feasibility, and manuscript value.",
  ]);
  const decisionCriteria = detailList(card, "decision_criteria", [
    "Approve only if source traces, controls, and objections are resolved.",
    "Request more evidence if any core assumption remains untested.",
  ]);
  const conclusion = detailText(
    card,
    "debate_conclusion",
    detailText(
      card,
      "meeting_summary",
      "No final conclusion yet. The debate must synthesize evidence, objections, hypotheses, and feasibility checks first.",
    ),
  );
  const confidence = Math.max(40, Math.min(92, card?.progress ?? 60));

  return (
    <section className="rdos-debate-grid">
      <aside className="rdos-panel">
        <span className="rdos-eyebrow">Claim Under Debate</span>
        <h2>{claimText}</h2>
        <div className="rdos-chip-row">
          <b>{displayStatus(card?.status ?? "waiting_for_claim")}</b><b>{card?.evidenceCount ?? 0} Evidence</b><b>{sourcePaper}</b>
        </div>
        <span className="rdos-live-pill">Debating</span>
        <h3>Debate Protocol</h3>
        <ol className="rdos-debate-protocol">
          {protocol.map((item) => <li key={item}>{item}</li>)}
        </ol>
        <h3>Agent Positions</h3>
        {positions.slice(0, 6).map((position, index) => (
          <DebatePosition key={position} agent={["reader", "critic", "strategist", "experiment", "librarian", "leader"][index] as AgentVariant} text={position} />
        ))}
      </aside>
      <section className="rdos-panel rdos-thread">
        <span className="rdos-eyebrow">Evidence Debate</span>
        <div className="rdos-evidence-grid">
          <EvidenceBox title="Supporting Evidence" items={support} tone="good" />
          <EvidenceBox title="Opposing Evidence" items={opposition} tone="bad" />
        </div>
        <ThreadMessage agent="reader" name="Reader Dino" tag="Evidence" text={support[0]} />
        <ThreadMessage agent="critic" name="Critic Dino" tag="Cross-Exam" text={crossExam[0]} />
        <ThreadMessage agent="strategist" name="Strategist Dino" tag="Hypothesis" text={hypotheses[0]} />
        <ThreadMessage agent="experiment" name="Experiment Dino" tag="Falsify" text={experiments[0]} />
        <ThreadMessage agent="librarian" name="Librarian Dino" tag="Trace" text="Conclusion cannot enter Library until evidence, objections, and decision criteria are traceable." />
        <div className="rdos-composer">
          <img src={agentAssets.leader} alt="" />
          <span>Leader waits for a decision-ready conclusion packet...</span>
          <button type="button"><Icon name="send" /></button>
        </div>
      </section>
      <aside className="rdos-panel">
        <span className="rdos-eyebrow">Synthesis</span>
        <div className="rdos-score-grid"><b>{support.length} Support</b><b>{opposition.length} Objections</b><b>{hypothesisTests.length} Tests</b><b>{experiments.length} Protocols</b></div>
        <div className="rdos-confidence"><span>Conclusion Readiness</span><i><b style={{ width: `${confidence}%` }} /></i><em>{confidence}%</em></div>
        <div className="rdos-conclusion-box">
          <strong>Current Conclusion</strong>
          <p>{conclusion}</p>
        </div>
        <MiniList title="Hypothesis Tests" items={hypothesisTests} />
        <MiniList title="Research Strategy" items={researchStrategy} />
        <MiniList title="Experiment Strategy" items={experiments} />
        <MiniList title="Decision Criteria" items={decisionCriteria} />
        <button className="rdos-primary-action" type="button" disabled={busy || !card} onClick={onRunDebate}>Run Structured Debate</button>
        <button className="rdos-secondary-action" type="button" disabled={busy || !card} onClick={onRunPipeline}>Send Full Packet To Leader</button>
        <button className="rdos-secondary-action" type="button" onClick={onRequestEvidence}>Request More Evidence</button>
      </aside>
    </section>
  );
}

function ReaderScreen({
  card,
  project,
  onRunReader,
  onRunPipeline,
  busy,
}: {
  card?: WorkflowCardData;
  project?: ResearchProjectData;
  onRunReader: () => void;
  onRunPipeline: () => void;
  busy: boolean;
}) {
  const sections = detailList(card, "Sections", ["Abstract", "Methods", "Results", "Limitations"]);
  return (
    <section className="rdos-reader-grid">
      <aside className="rdos-panel rdos-now-reading">
        <span className="rdos-eyebrow">Now Reading</span>
        <img src={agentAssets.reader} alt="" />
        <h2>{card?.title ?? "No paper selected"}</h2>
        <p>{project?.sourceNote ?? detailText(card, "Source type", "Source pending")}</p>
        <div className="rdos-chip-row"><b>{project?.domain ?? "Research"}</b><b>{detailText(card, "Source type", "Paper")}</b></div>
        <div className="rdos-progress"><span>Progress</span><i><b style={{ width: `${card?.progress ?? 24}%` }} /></i></div>
      </aside>
      <article className="rdos-panel rdos-reading-pane">
        <h2>{detailText(card, "Title", project?.title ?? "Research Reading")}</h2>
        <p>{card?.summary ?? project?.description ?? "Select or import a paper to begin project-specific reading."}</p>
        <p>
          Reader Dino highlights <mark>claim candidates, evidence spans, limitations, and missing controls</mark> for this research project before Debate Room review.
        </p>
        <div className="rdos-reader-note">
          <img src={agentAssets.reader} alt="" />
          <span>Reader Note</span>
          <p>Run Reader to create a traceable Debate Room claim card inside {project?.shortTitle ?? "this project"}.</p>
        </div>
      </article>
      <aside className="rdos-panel">
        <span className="rdos-eyebrow">AI Summary</span>
        <h3>Reading Targets</h3>
        <ul>
          {sections.slice(0, 4).map((section) => <li key={section}>{section}</li>)}
          <li>Evidence candidates remain traceable to the source card.</li>
          <li>Weak or unsupported claims stay provisional.</li>
        </ul>
        <h3>Extracted Claims</h3>
        {[1, 2, 3].map((item) => (
          <div className="rdos-claim-card" key={item}>
            <strong>Claim candidate {item}</strong>
            <span>{item === 1 ? "74%" : item === 2 ? "62%" : "51%"} confidence</span>
            <button type="button" disabled={busy || !card} onClick={onRunReader}>Send to Debate</button>
          </div>
        ))}
        <button className="rdos-primary-action" type="button" disabled={busy || !card} onClick={onRunPipeline}>Run To Leader Review</button>
      </aside>
    </section>
  );
}

function ManuscriptScreen({ card, project }: { card?: WorkflowCardData; project?: ResearchProjectData }) {
  return (
    <section className="rdos-report-grid">
      <aside className="rdos-panel">
        <span className="rdos-eyebrow">Sections</span>
        {["Abstract", "1 Introduction", "2 Mechanisms", "3 Evidence Synthesis", "4 Discussion", "References"].map((item, index) => (
          <div className={`rdos-section-row${index === 2 ? " is-active" : ""}`} key={item}>{item}</div>
        ))}
      </aside>
      <article className="rdos-panel rdos-editor">
        <div className="rdos-toolbar"><b>B</b><b>I</b><b>H2</b><b>•</b><span><i />Writer drafting</span></div>
        <h2>{card?.title ?? `${project?.shortTitle ?? "Research"} Manuscript`}</h2>
        <em>ResearchDino Lab - {project?.title ?? "Research Project"}</em>
        <h3>Abstract</h3>
        <p>{project?.description ?? "This manuscript draft is assembled from project-specific, leader-approved evidence."}</p>
        <h3>1 Introduction</h3>
        <p>The manuscript writer only promotes claims that have passed Leader review and Library storage.<span className="rdos-caret" /></p>
      </article>
      <aside className="rdos-panel">
        <span className="rdos-eyebrow">Draft Stats</span>
        <StatRow label="Words" value="1,240" />
        <StatRow label="Citations" value="18" />
        <StatRow label="Grade" value="13" />
        <h3>Coherence Check</h3>
        <ul className="rdos-keypoints">
          <li className="good">Claims are linked to Library records.</li>
          <li className="good">Citation placeholders are present.</li>
          <li className="warn">Two claims still need stronger source traces.</li>
        </ul>
        <button className="rdos-secondary-action" type="button">Export DOCX</button>
        <button className="rdos-secondary-action" type="button">Export PDF</button>
      </aside>
    </section>
  );
}

function AgentsScreen({ rooms, cards, runs, researchRuns }: { rooms: LaboratoryRoomData[]; cards: WorkflowCardData[]; runs: AgentRunRecord[]; researchRuns: ResearchRunRecord[] }) {
  const [selectedRoomId, setSelectedRoomId] = useState<RoomId>("leader");
  const agents = rooms.map((room) => ({
    roomId: room.id,
    agent: room.agent,
    name: `${room.agent[0].toUpperCase()}${room.agent.slice(1)} Dino`,
    role: room.role,
    status: displayStatus(room.status),
    room: room.title,
    activeCards: cards.filter((card) => card.currentRoom === room.id),
    assignments: room.modelAssignments ?? [],
  }));
  const selectedAgent = agents.find((agent) => agent.roomId === selectedRoomId) ?? agents[0];
  const profile = selectedAgent ? agentProfiles[selectedAgent.agent] : undefined;
  const selectedRuns = selectedAgent
    ? runs.filter((run) => run.agent === selectedAgent.agent || selectedAgent.assignments.some((assignment) => assignment.deputy === run.agent))
    : [];

  return (
    <section>
      <ScreenHeader eyebrow="Agents" title="9 Autonomous Agents" meta={<><span className="rdos-online-dot" />6 Online <b>3 Idle</b></>} />
      <div className="rdos-agent-workspace">
        <div className="rdos-agent-grid">
          {agents.map((agent) => (
            <button
              className={`rdos-agent-card${selectedAgent?.roomId === agent.roomId ? " is-selected" : ""}`}
              key={`${agent.agent}-${agent.room}`}
              type="button"
              onClick={() => setSelectedRoomId(agent.roomId)}
            >
              <img src={agentAssets[agent.agent]} alt="" />
              <div>
                <strong>{agent.name}</strong>
                <span>{agent.role}</span>
              </div>
              <em className={agent.status.includes("debating") ? "is-live" : ""}>{agent.status}</em>
              <p>Current Task: {agent.room}</p>
              <footer><span>{agent.room}</span><b>{runs.filter((run) => run.agent === agent.agent).length} Model Runs</b></footer>
            </button>
          ))}
        </div>

        {selectedAgent && profile && (
          <aside className="rdos-agent-detail">
            <header>
              <img src={agentAssets[selectedAgent.agent]} alt="" />
              <div>
                <span>Agent Detail</span>
                <h3>{selectedAgent.name}</h3>
                <p>{profile.mission}</p>
              </div>
            </header>

            <div className="rdos-agent-detail-stats">
              <div><span>Room</span><b>{selectedAgent.room}</b></div>
              <div><span>Status</span><b>{selectedAgent.status}</b></div>
              <div><span>Cards</span><b>{selectedAgent.activeCards.length}</b></div>
              <div><span>Model Runs</span><b>{selectedRuns.length}</b></div>
            </div>

            <section className="rdos-agent-section">
              <h4>How This Agent Works</h4>
              <ol>
                {profile.method.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </section>

            <div className="rdos-agent-profile-grid">
              <section className="rdos-agent-section">
                <h4>Inputs</h4>
                <ul>{profile.inputs.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section className="rdos-agent-section">
                <h4>Outputs</h4>
                <ul>{profile.outputs.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            </div>

            <section className="rdos-agent-section">
              <h4>Handoffs</h4>
              <div className="rdos-agent-chip-row">
                {profile.handoffs.map((handoff) => <span key={handoff}>{handoff}</span>)}
              </div>
            </section>

            <section className="rdos-agent-section">
              <h4>Quality Gate</h4>
              <p>{profile.qualityGate}</p>
            </section>

            <section className="rdos-agent-section">
              <h4>Model Deputies</h4>
              <div className="rdos-agent-model-list">
                {selectedAgent.assignments.map((assignment) => (
                  <div className="rdos-agent-model" key={assignment.id}>
                    <b>{assignment.label}</b>
                    <span>{assignment.provider} / {assignment.model} / {assignment.mode}</span>
                    <p>{assignment.responsibility}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rdos-agent-section">
              <h4>Current Cards</h4>
              {selectedAgent.activeCards.length > 0 ? (
                <div className="rdos-agent-card-list">
                  {selectedAgent.activeCards.slice(0, 4).map((card) => (
                    <div key={card.id}>
                      <b>{card.title}</b>
                      <span>{card.type.replace(/_/g, " ")} / {displayStatus(card.status)} / {card.evidenceCount} evidence</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No active cards in this room for the selected project.</p>
              )}
            </section>

            <section className="rdos-agent-section">
              <h4>Recent Model Runs</h4>
              {selectedRuns.length > 0 ? (
                <div className="rdos-agent-model-list">
                  {selectedRuns.slice(0, 6).map((run) => (
                    <div className="rdos-agent-model" key={run.id}>
                      <b>{run.phase.replace(/_/g, " ")}</b>
                      <span>{run.model} / {run.status}</span>
                      <p>{run.errorMessage ?? run.inputSummary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No Ollama model run has been recorded for this project/lab yet.</p>
              )}
            </section>

            <section className="rdos-agent-section">
              <h4>Research Runs</h4>
              {researchRuns.length > 0 ? (
                <div className="rdos-agent-model-list">
                  {researchRuns.slice(0, 5).map((researchRun) => (
                    <div className="rdos-agent-model" key={researchRun.id}>
                      <b>{researchRun.action.replace(/_/g, " ")}</b>
                      <span>{researchRun.phase.replace(/_/g, " ")} / {researchRun.status}</span>
                      <p>{researchRun.errorMessage ?? `${Object.keys(researchRun.checkpoint).length} checkpoints saved`}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No durable ResearchRun has been recorded for this project/lab yet.</p>
              )}
            </section>
          </aside>
        )}
      </div>
    </section>
  );
}

function detailValueText(value: WorkflowCardData["details"][string]): string {
  if (Array.isArray(value)) return value.map(detailValueText).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value === undefined || value === null ? "" : String(value);
}

function detailSourceValue(card: WorkflowCardData | undefined, key: string) {
  const value = card?.details[key];
  return value === undefined ? undefined : detailValueText(value);
}

function LibraryScreen({
  project,
  cards,
  allCards,
}: {
  project?: ResearchProjectData;
  cards: WorkflowCardData[];
  allCards: WorkflowCardData[];
}) {
  const [query, setQuery] = useState("");
  const baseRows = cards.length > 0 ? cards : allCards.filter((card) => completeStatuses.has(card.status)).slice(0, 7);
  const rows = baseRows.filter((card) => {
    const sourceCard = card.sourcePaperId ? allCards.find((candidate) => candidate.id === card.sourcePaperId) : undefined;
    const haystack = [
      card.title,
      card.summary,
      card.type,
      card.status,
      card.approvalStatus,
      sourceCard?.title,
      ...Object.values(card.details).map(detailValueText),
      ...Object.values(sourceCard?.details ?? {}).map(detailValueText),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const [selectedId, setSelectedId] = useState<string>();
  const selectedCard = rows.find((card) => card.id === selectedId) ?? rows[0];
  const sourceCard = selectedCard?.sourcePaperId
    ? allCards.find((card) => card.id === selectedCard.sourcePaperId)
    : undefined;
  const sourceType = detailSourceValue(sourceCard, "Source type") ?? detailSourceValue(selectedCard, "Source type") ?? "Workflow card";
  const doi = detailSourceValue(sourceCard, "DOI") ?? detailSourceValue(selectedCard, "DOI") ?? "not recorded";
  const publisherCandidates =
    detailSourceValue(sourceCard, "Publisher source candidates") ??
    detailSourceValue(selectedCard, "Publisher source candidates") ??
    "not mapped";
  const storedCount = baseRows.filter((card) => card.status === "stored_in_library").length;
  const evidenceCount = baseRows.reduce((total, card) => total + card.evidenceCount, 0);
  const reviewCount = baseRows.filter((card) => card.requiresUserReview).length;

  return (
    <section>
      <ScreenHeader
        eyebrow="Library"
        title="Knowledge Library"
        meta={
          <input
            className="rdos-search-input"
            placeholder="Search approved papers, claims, evidence..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        }
      />
      <div className="rdos-filter-row">
        <b>All {baseRows.length}</b>
        <span>Stored {storedCount}</span>
        <span>Evidence {evidenceCount}</span>
        <span>Review {reviewCount}</span>
      </div>
      <div className="rdos-library-workspace">
        <div className="rdos-library-list">
          {rows.map((card) => {
            const rowSource = card.sourcePaperId ? allCards.find((candidate) => candidate.id === card.sourcePaperId) : undefined;
            const rowSourceType = detailSourceValue(rowSource, "Source type") ?? detailSourceValue(card, "Source type") ?? "Workflow card";
            return (
              <button
                className={`rdos-library-row${selectedCard?.id === card.id ? " is-selected" : ""}`}
                key={card.id}
                type="button"
                onClick={() => setSelectedId(card.id)}
              >
                <Icon name="book" />
                <div>
                  <strong>{card.title}</strong>
                  <span>{rowSource?.title ?? project?.sourceNote ?? "No source linked"} | {rowSourceType} | {card.evidenceCount} evidence</span>
                </div>
                <b>{card.type.replace(/_/g, " ")}</b>
                <em className={card.status === "running" ? "is-live" : ""}>{displayStatus(card.status)}</em>
              </button>
            );
          })}
          {rows.length === 0 && (
            <article className="rdos-library-empty">
              <strong>No matching library records</strong>
              <span>Try another title, claim, source, DOI, or evidence term.</span>
            </article>
          )}
        </div>

        <aside className="rdos-library-detail">
          {selectedCard ? (
            <>
              <header>
                <span>Metadata</span>
                <h3>{selectedCard.title}</h3>
                <p>{selectedCard.summary}</p>
              </header>
              <dl className="rdos-metadata-grid">
                <div><dt>Project</dt><dd>{project?.title ?? selectedCard.projectId}</dd></div>
                <div><dt>Record ID</dt><dd>{selectedCard.id}</dd></div>
                <div><dt>Source Paper</dt><dd>{sourceCard?.title ?? selectedCard.sourcePaperId ?? "not linked"}</dd></div>
                <div><dt>Source Type</dt><dd>{sourceType}</dd></div>
                <div><dt>DOI</dt><dd>{doi}</dd></div>
                <div><dt>Publisher Sources</dt><dd>{publisherCandidates}</dd></div>
                <div><dt>Evidence Links</dt><dd>{selectedCard.evidenceCount}</dd></div>
                <div><dt>Approval</dt><dd>{displayStatus(selectedCard.approvalStatus)}</dd></div>
                <div><dt>Status</dt><dd>{displayStatus(selectedCard.status)}</dd></div>
                <div><dt>Last Updated</dt><dd>{selectedCard.lastUpdated}</dd></div>
              </dl>

              <section className="rdos-library-detail-block">
                <h4>Stored Details</h4>
                {Object.entries(selectedCard.details).length > 0 ? (
                  <dl>
                    {Object.entries(selectedCard.details).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>
                          {Array.isArray(value) ? (
                            <ul>
                              {value.map((item, index) => <li key={`${key}-${index}`}>{detailValueText(item)}</li>)}
                            </ul>
                          ) : (
                            detailValueText(value)
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p>No stored detail fields yet.</p>
                )}
              </section>

              {sourceCard && sourceCard.id !== selectedCard.id && (
                <section className="rdos-library-detail-block">
                  <h4>Source Trace</h4>
                  <p>{sourceCard.summary}</p>
                  <dl>
                    {Object.entries(sourceCard.details).slice(0, 6).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{detailValueText(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </>
          ) : (
            <p>Select a stored card to inspect metadata.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function ReportsScreen({
  project,
  reviewCard,
  ledgerStats,
  onStore,
  onRevise,
  onOpenStudio,
  busy,
}: {
  project?: ResearchProjectData;
  reviewCard?: WorkflowCardData;
  ledgerStats: {
    claims: number;
    evidence: number;
    debateSessions: number;
    hypotheses: number;
    experimentPlans: number;
  };
  onStore: () => void;
  onRevise: () => void;
  onOpenStudio: () => void;
  busy: boolean;
}) {
  return (
    <section>
      <ScreenHeader eyebrow="Reports" title="Research Reports" />
      <article className="rdos-feature-card">
        <Icon name="doc" />
        <div>
          <span>Latest Manuscript</span>
          <h2>Evidence-backed {project?.shortTitle ?? "Research"} Draft</h2>
          <p>Writing Studio - {project?.domain ?? "Research"} - 18 citations</p>
        </div>
        <button type="button" onClick={onOpenStudio}>Open in Studio</button>
        <button type="button">Export</button>
      </article>
      <section className="rdos-panel rdos-leader-gate">
        <span className="rdos-eyebrow">Leader Review Queue</span>
        <h2>{reviewCard?.title ?? "No Leader review item"}</h2>
        <p>{reviewCard?.summary ?? "Debate outputs that require user approval will appear here."}</p>
        <div className="rdos-action-row">
          <button className="rdos-primary-action" type="button" disabled={busy || !reviewCard} onClick={onStore}>Send to Library</button>
        <button className="rdos-secondary-action" type="button" disabled={busy || !reviewCard} onClick={onRevise}>Request Revision</button>
      </div>
    </section>
      <section className="rdos-panel rdos-ledger-panel">
        <span className="rdos-eyebrow">Structured Ledger</span>
        <h2>Traceable Research Records</h2>
        <p>Cards are now backed by normalized records for claim, evidence, debate, strategy, and experiment tracking.</p>
        <div className="rdos-ledger-grid">
          <div><span>Claims</span><b>{ledgerStats.claims}</b></div>
          <div><span>Evidence</span><b>{ledgerStats.evidence}</b></div>
          <div><span>Debates</span><b>{ledgerStats.debateSessions}</b></div>
          <div><span>Hypotheses</span><b>{ledgerStats.hypotheses}</b></div>
          <div><span>Experiments</span><b>{ledgerStats.experimentPlans}</b></div>
        </div>
      </section>
      <div className="rdos-card-grid">
        {["Weekly Research Brief", "Debate Summary", "Experiment Plan v2", "Literature Gap Analysis", "Reading Digest", "Leader Decision Log"].map((title, index) => (
          <article className="rdos-small-report" key={title}>
            <Icon name={index === 2 ? "flask" : "doc"} />
            <em>{index % 3 === 0 ? "Final" : index % 3 === 1 ? "Draft" : "Pending"}</em>
            <strong>{title}</strong>
            <span>{project?.shortTitle ?? "ResearchDino"} - Today</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectsScreen({
  projects,
  cards,
  activeProjectId,
  busy,
  onSelectProject,
  onOpenMap,
  onCreateProject,
}: {
  projects: ResearchProjectData[];
  cards: WorkflowCardData[];
  activeProjectId: string;
  busy: boolean;
  onSelectProject: (projectId: string) => void;
  onOpenMap: () => void;
  onCreateProject: (input: CreateResearchProjectInput) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [lead, setLead] = useState("");
  const [description, setDescription] = useState("");
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const activeCards = cards.filter((card) => belongsToProject(card, activeProject?.id ?? defaultProjectId));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreateProject({
      title,
      shortTitle: title,
      domain,
      sourceNote,
      lead,
      description,
      status: "active",
    });
    setTitle("");
    setDomain("");
    setSourceNote("");
    setLead("");
    setDescription("");
    setShowCreate(false);
  }

  return (
    <section>
      <ScreenHeader
        eyebrow="Projects"
        title="Research Programs"
        meta={
          <button className="rdos-secondary-action" type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Close" : "New Project"}
          </button>
        }
      />
      {showCreate && (
        <form className="rdos-project-create" onSubmit={handleSubmit}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Project title, e.g. Layered Materials" disabled={busy} />
          <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="Domain, e.g. Materials Science" disabled={busy} />
          <input value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} placeholder="Primary source note" disabled={busy} />
          <input value={lead} onChange={(event) => setLead(event.target.value)} placeholder="Lead / owner" disabled={busy} />
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Research goal or program description" disabled={busy} />
          <button type="submit" disabled={busy || !title.trim()}>Create Project</button>
        </form>
      )}
      <article className="rdos-feature-card">
        <Icon name="folder" />
        <div>
          <span className="rdos-live-pill">Active</span>
          <h2>{activeProject?.title ?? "Research Project"}</h2>
          <p>{activeProject?.domain ?? "Research"} - {activeProject?.sourceNote ?? "Source pending"}</p>
          <div className="rdos-project-stats">
            <b>{activeCards.length} Tasks</b>
            <b>{activeCards.filter((card) => runningStatuses.has(card.status)).length} Running</b>
            <b>{activeCards.filter((card) => completeStatuses.has(card.status)).length} Outputs</b>
          </div>
        </div>
        <button type="button" onClick={onOpenMap}>Open Lab Map</button>
      </article>
      <div className="rdos-project-grid">
        {projects.map((project) => {
          const projectCards = cards.filter((card) => belongsToProject(card, project.id));
          const running = projectCards.filter((card) => runningStatuses.has(card.status)).length;
          const waiting = projectCards.filter((card) => waitingStatuses.has(card.status)).length;
          const progress = Math.min(100, Math.max(18, projectCards.reduce((total, card) => total + card.progress, 0) / Math.max(projectCards.length, 1)));
          return (
            <button
              className={`rdos-project-card${project.id === activeProjectId ? " is-active" : ""}`}
              type="button"
              key={project.id}
              onClick={() => onSelectProject(project.id)}
            >
              <span className="rdos-eyebrow">{project.status}</span>
              <h2>{project.title}</h2>
              <p>{project.description}</p>
              <div className="rdos-project-stats"><b>{projectCards.length} Tasks</b><b>{running} Running</b><b>{waiting} Waiting</b></div>
              <div className="rdos-progress"><i><b style={{ width: `${progress}%` }} /></i></div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

type TaskColumnId = "waiting" | "progress" | "review" | "done";

const taskColumnOrder: TaskColumnId[] = ["waiting", "progress", "review", "done"];

function taskColumnForCard(card: WorkflowCardData): TaskColumnId {
  if (completeStatuses.has(card.status)) return "done";
  if (card.requiresUserReview || ["waiting_for_user", "waiting_for_leader_review", "needs_more_evidence"].includes(card.status)) return "review";
  if (runningStatuses.has(card.status)) return "progress";
  return "waiting";
}

function patchForTaskColumn(card: WorkflowCardData, column: TaskColumnId): UpdateWorkflowCardInput {
  if (column === "waiting") {
    return { status: "queued", requiresUserReview: false, progress: progressForStatus("queued") };
  }
  if (column === "progress") {
    const status = card.currentRoom === "debate" ? "debating" : "running";
    return { status, requiresUserReview: false, progress: progressForStatus(status) };
  }
  if (column === "review") {
    return { status: "waiting_for_user", requiresUserReview: true, progress: progressForStatus("waiting_for_user") };
  }
  return { status: "approved", requiresUserReview: false, progress: progressForStatus("approved") };
}

function TasksScreen({
  cards,
  project,
  busy,
  onCreate,
  onPatch,
  onDelete,
}: {
  cards: WorkflowCardData[];
  project?: ResearchProjectData;
  busy: boolean;
  onCreate: (input: CreateWorkflowCardInput) => void;
  onPatch: (card: WorkflowCardData, patch: UpdateWorkflowCardInput) => void;
  onDelete: (card: WorkflowCardData) => void;
}) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftRoom, setDraftRoom] = useState<RoomId>("coordinator");
  const [draftType, setDraftType] = useState<CardType>("review");
  const [draftSummary, setDraftSummary] = useState("");
  const columns = [
    { id: "waiting" as const, title: "Waiting", cards: cards.filter((card) => taskColumnForCard(card) === "waiting") },
    { id: "progress" as const, title: "In Progress", cards: cards.filter((card) => taskColumnForCard(card) === "progress") },
    { id: "review" as const, title: "Review", cards: cards.filter((card) => taskColumnForCard(card) === "review") },
    { id: "done" as const, title: "Done", cards: cards.filter((card) => taskColumnForCard(card) === "done") },
  ];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      projectId: project?.id ?? defaultProjectId,
      title: draftTitle,
      type: draftType,
      currentRoom: draftRoom,
      summary: draftSummary,
    });
    setDraftTitle("");
    setDraftSummary("");
  }

  function moveCard(card: WorkflowCardData, direction: -1 | 1) {
    const currentIndex = taskColumnOrder.indexOf(taskColumnForCard(card));
    const nextColumn = taskColumnOrder[currentIndex + direction];
    if (!nextColumn) return;
    onPatch(card, patchForTaskColumn(card, nextColumn));
  }

  return (
    <section>
      <ScreenHeader eyebrow="Tasks" title="Task Board" meta={<span>{project?.title ?? "Research Project"} - {cards.length} tasks</span>} />
      <form className="rdos-task-create" onSubmit={handleSubmit}>
        <input
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          placeholder="Add task title..."
          disabled={busy}
        />
        <select value={draftRoom} onChange={(event) => setDraftRoom(event.target.value as RoomId)} disabled={busy}>
          {taskRoomOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={draftType} onChange={(event) => setDraftType(event.target.value as CardType)} disabled={busy}>
          {taskTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <input
          value={draftSummary}
          onChange={(event) => setDraftSummary(event.target.value)}
          placeholder="Short note..."
          disabled={busy}
        />
        <button type="submit" disabled={busy || !draftTitle.trim()}>Add Task</button>
      </form>
      <div className="rdos-kanban">
        {columns.map((column) => (
          <section className="rdos-kanban-column" key={column.id}>
            <h3>{column.title} <span>{column.cards.length}</span></h3>
            {column.cards.map((card, index) => (
              <article className={`rdos-task-card${column.id === "done" ? " is-done" : ""}`} key={card.id}>
                <div><b>{card.currentRoom}</b><em className={`priority-${priorityLabel(card, index).toLowerCase()}`}>{priorityLabel(card, index)}</em></div>
                <strong>{card.title}</strong>
                <footer><img src={agentAssets[card.assignedAgent]} alt="" />{card.assignedAgent}<span>{card.status === "debating" ? "Live" : card.requiresUserReview ? "User" : ""}</span></footer>
                <div className="rdos-task-actions">
                  <button type="button" disabled={busy || column.id === "waiting"} onClick={() => moveCard(card, -1)}>Back</button>
                  <button type="button" disabled={busy || column.id === "done"} onClick={() => moveCard(card, 1)}>Next</button>
                  <button className="is-danger" type="button" disabled={busy} onClick={() => onDelete(card)}>Delete</button>
                </div>
              </article>
            ))}
            {column.cards.length === 0 && <p className="rdos-kanban-empty">No tasks here.</p>}
          </section>
        ))}
      </div>
    </section>
  );
}

function SettingsScreen({
  dataMode,
  modelRuntime,
  sourceConnectors,
  ingestPath,
  ingestResult,
  busy,
  onPathChange,
  onSubmit,
}: {
  dataMode: ResearchDataMode;
  modelRuntime: ModelRuntimeStatus;
  sourceConnectors: PaperSourceConnector[];
  ingestPath: string;
  ingestResult?: IngestScanResult;
  busy: boolean;
  onPathChange: (path: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [settings, setSettings] = useState(() => loadControlSettings(sourceConnectors));
  const [savedSettings, setSavedSettings] = useState(settings);
  const [savedAt, setSavedAt] = useState("");
  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    const loaded = loadControlSettings(sourceConnectors);
    setSettings(loaded);
    setSavedSettings(loaded);
  }, [sourceConnectors]);

  function updateSettings(patch: Partial<ControlSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function toggleSource(sourceId: string) {
    setSettings((current) => ({
      ...current,
      sourceEnabled: {
        ...current.sourceEnabled,
        [sourceId]: !current.sourceEnabled[sourceId],
      },
    }));
  }

  function updateSourceAccount(sourceId: string, account: SourceAccountConnection) {
    setSettings((current) => ({
      ...current,
      sourceEnabled: {
        ...current.sourceEnabled,
        [sourceId]: account.status === "connected",
      },
      sourceAccounts: {
        ...current.sourceAccounts,
        [sourceId]: account,
      },
    }));
  }

  function disconnectSourceAccount(connector: PaperSourceConnector) {
    setSettings((current) => ({
      ...current,
      sourceEnabled: {
        ...current.sourceEnabled,
        [connector.id]: false,
      },
      sourceAccounts: {
        ...current.sourceAccounts,
        [connector.id]: defaultSourceAccount(connector),
      },
    }));
  }

  function handleSave() {
    window.localStorage.setItem(controlSettingsStorageKey, JSON.stringify(settings));
    setSavedSettings(settings);
    setSavedAt(currentDisplayTime());
  }

  return (
    <section>
      <ScreenHeader
        eyebrow="Settings"
        title="ResearchDino Controls"
        meta={
          <div className="rdos-settings-save">
            <span>{isDirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt}` : "Saved"}</span>
            <button className="rdos-primary-action" type="button" disabled={!isDirty} onClick={handleSave}>
              Save Changes
            </button>
          </div>
        }
      />
      <div className="rdos-settings-grid">
        <article className="rdos-panel rdos-source-panel">
          <span className="rdos-eyebrow">Paper Sources</span>
          <div className="rdos-source-list">
            {sourceConnectors.map((connector) => (
              <SourceConnectorRow
                connector={connector}
                enabled={Boolean(settings.sourceEnabled[connector.id])}
                account={settings.sourceAccounts[connector.id] ?? defaultSourceAccount(connector)}
                key={connector.id}
                onToggle={() => toggleSource(connector.id)}
                onUpdateAccount={(account) => updateSourceAccount(connector.id, account)}
                onDisconnect={() => disconnectSourceAccount(connector)}
              />
            ))}
          </div>
        </article>
        <article className="rdos-panel">
          <span className="rdos-eyebrow">Autonomy</span>
          <div className="rdos-segment">
            {(["manual", "assisted", "auto"] as const).map((mode) => (
              <button
                className={settings.autonomyMode === mode ? "is-active" : ""}
                type="button"
                key={mode}
                onClick={() => updateSettings({ autonomyMode: mode })}
              >
                {mode[0].toUpperCase()}{mode.slice(1)}
              </button>
            ))}
          </div>
          <Toggle
            label="Auto-approve low-risk claims"
            active={settings.autoApproveLowRisk}
            onToggle={() => updateSettings({ autoApproveLowRisk: !settings.autoApproveLowRisk })}
          />
          <label className="rdos-range">
            Max parallel tasks <b>{settings.maxParallelTasks}</b>
            <input
              type="range"
              min="1"
              max="9"
              value={settings.maxParallelTasks}
              onChange={(event) => updateSettings({ maxParallelTasks: Number(event.target.value) })}
            />
          </label>
        </article>
        <article className="rdos-panel">
          <span className="rdos-eyebrow">Local Ollama Runtime</span>
          <div className="rdos-runtime-status">
            <StatRow label="Connection" value={modelRuntime.configured ? "Models registered" : modelRuntime.reachable ? "Models missing" : "Offline"} />
            <StatRow label="Endpoint" value={modelRuntime.baseUrl} />
            <StatRow label="Authentication" value={modelRuntime.authMode === "none" ? "Not required" : modelRuntime.apiKeyConfigured ? "API key set" : "API key missing"} />
            <StatRow label="Runtime" value={modelRuntime.mode} />
          </div>
          <div className="rdos-agent-model-list rdos-runtime-models">
            {Object.entries(modelRuntime.roleModels).map(([role, model]) => (
              <div className="rdos-agent-model" key={role}>
                <b>{role}</b>
                <span>{model}</span>
              </div>
            ))}
          </div>
          {modelRuntime.missingModels.length > 0 && (
            <p className="rdos-runtime-warning">Pull required: {modelRuntime.missingModels.join(", ")}</p>
          )}
          {modelRuntime.error && <p className="rdos-runtime-warning">{modelRuntime.error}</p>}
          <p className="rdos-runtime-note">Inference usage and quota are checked on each AgentRun. A registered model can still be rejected by the Ollama account limit.</p>
        </article>
        <article className="rdos-panel">
          <span className="rdos-eyebrow">Local PDF Ingest</span>
          <form className="rdos-ingest-form" onSubmit={onSubmit}>
            <label>
              Folder path
              <input value={ingestPath} onChange={(event) => onPathChange(event.target.value)} placeholder="C:\\Users\\SH\\Documents\\Papers" />
            </label>
            <button className="rdos-primary-action" type="submit" disabled={busy || dataMode !== "api"}>{busy ? "Scanning..." : "Register & Scan"}</button>
          </form>
          {ingestResult && (
            <div className="rdos-ingest-result">
              <StatRow label="PDFs" value={ingestResult.pdfCount} />
              <StatRow label="New" value={ingestResult.newPaperCount} />
              <StatRow label="Existing" value={ingestResult.duplicatePaperCount} />
              <StatRow label="Parsed" value={ingestResult.parsedPaperCount} />
              <StatRow label="Reader Queue" value={ingestResult.readerQueueCount} />
              <StatRow label="Errors" value={ingestResult.errorCardCount} />
              <StatRow label="Parser" value={ingestResult.parserAvailable ? "PyMuPDF" : "Missing"} />
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function SourceConnectorRow({
  connector,
  enabled,
  account,
  onToggle,
  onUpdateAccount,
  onDisconnect,
}: {
  connector: PaperSourceConnector;
  enabled: boolean;
  account: SourceAccountConnection;
  onToggle: () => void;
  onUpdateAccount: (account: SourceAccountConnection) => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<SourceAccessMethod>(account.method);
  const [accountLabel, setAccountLabel] = useState(account.accountLabel);
  const [institution, setInstitution] = useState(account.institution);
  const [credentialRef, setCredentialRef] = useState(account.credentialRef);
  const [secretDraft, setSecretDraft] = useState("");
  const gated = connector.access === "license_gated";
  const configured = gated ? account.status === "connected" : enabled;
  const status = gated
    ? configured
      ? `Connected via ${sourceAccessMethodLabels[account.method]}`
      : "Needs account connection"
    : enabled
      ? "Enabled"
      : "Disabled";
  const methods = sourceAccessMethodsFor(connector);

  useEffect(() => {
    setMethod(account.method);
    setAccountLabel(account.accountLabel);
    setInstitution(account.institution);
    setCredentialRef(account.credentialRef);
    setSecretDraft("");
  }, [account.accountLabel, account.credentialRef, account.institution, account.method]);

  function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ref = credentialRef.trim() || `${connector.id}-${method}-credential`;
    onUpdateAccount({
      status: "connected",
      method,
      accountLabel: accountLabel.trim() || connector.label,
      institution: institution.trim(),
      credentialRef: ref,
      secretFingerprint: fingerprintSecret(secretDraft) || account.secretFingerprint,
      lastCheckedAt: currentDisplayTime(),
    });
    setSecretDraft("");
    setOpen(false);
  }

  return (
    <article className={`rdos-source-row${configured ? " is-enabled" : ""}${gated ? " is-gated" : ""}`}>
      <div>
        <strong>{connector.label}</strong>
        <span>{connector.scope}</span>
      </div>
      <dl>
        <div>
          <dt>Access</dt>
          <dd>{connector.access.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
      </dl>
      <p>{connector.notes}</p>
      {gated ? (
        <>
          {configured && (
            <div className="rdos-source-account-summary">
              <span>{account.accountLabel || connector.label}</span>
              <span>{account.institution || "No institution set"}</span>
              <span>{account.credentialRef || "No credential ref"}</span>
              <span>{account.secretFingerprint || "Secret not stored here"}</span>
            </div>
          )}
          <div className="rdos-source-actions">
            <button type="button" onClick={() => setOpen((value) => !value)}>
              {open ? "Close" : configured ? "Edit account" : "Connect account"}
            </button>
            {configured && <button type="button" onClick={onDisconnect}>Disconnect</button>}
          </div>
          {open && (
            <form className="rdos-source-account-form" onSubmit={handleConnect}>
              <label>
                Access method
                <select value={method} onChange={(event) => setMethod(event.target.value as SourceAccessMethod)}>
                  {methods.map((option) => (
                    <option value={option} key={option}>{sourceAccessMethodLabels[option]}</option>
                  ))}
                </select>
              </label>
              <label>
                Account / profile label
                <input value={accountLabel} onChange={(event) => setAccountLabel(event.target.value)} placeholder="e.g. SH institutional access" />
              </label>
              <label>
                Institution / library
                <input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="e.g. university library, lab account" />
              </label>
              <label>
                Credential ref
                <input value={credentialRef} onChange={(event) => setCredentialRef(event.target.value)} placeholder={`${connector.id}-${method}`} />
              </label>
              {(method === "api_key" || method === "browser_session") && (
                <label>
                  Secret / session token
                  <input
                    value={secretDraft}
                    onChange={(event) => setSecretDraft(event.target.value)}
                    placeholder={method === "api_key" ? "Paste API key once; only fingerprint is saved" : "Session/profile note; raw token is not persisted"}
                    type="password"
                  />
                </label>
              )}
              <p>Raw passwords and tokens are not stored in browser settings. This registers the connection method and a credential reference for the local connector.</p>
              <div className="rdos-source-actions">
                <button type="submit">Save connection</button>
                <button type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          )}
        </>
      ) : (
        <div className="rdos-source-actions">
          <button type="button" onClick={onToggle}>{enabled ? "Disable source" : "Enable source"}</button>
        </div>
      )}
    </article>
  );
}

function detailText(card: WorkflowCardData | undefined, key: string, fallback: string) {
  const value = card?.details[key];
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function detailList(card: WorkflowCardData | undefined, key: string, fallback: string[] = []) {
  const value = card?.details[key];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === "") return fallback;
  return [String(value)];
}

function ScreenHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: ReactNode }) {
  return (
    <header className="rdos-screen-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {meta && <div>{meta}</div>}
    </header>
  );
}

function DebatePosition({ agent, text }: { agent: AgentVariant; text: string }) {
  const [label, ...body] = text.split(":");
  return (
    <div className="rdos-debate-position">
      <img src={agentAssets[agent]} alt="" />
      <div>
        <strong>{body.length > 0 ? label : `${agent} Dino`}</strong>
        <span>{body.length > 0 ? body.join(":").trim() : text}</span>
      </div>
    </div>
  );
}

function EvidenceBox({ title, items, tone }: { title: string; items: string[]; tone: "bad" | "good" }) {
  return (
    <article className={`rdos-evidence-box is-${tone}`}>
      <strong>{title}</strong>
      <ul>
        {items.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rdos-mini-list">
      <h3>{title}</h3>
      <ul>
        {items.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function Participant({ name, role, agent }: { name: string; role: string; agent: AgentVariant }) {
  return (
    <div className="rdos-participant">
      <img src={agentAssets[agent]} alt="" />
      <div><strong>{name}</strong><span>{role}</span></div>
    </div>
  );
}

function ThreadMessage({ agent, name, tag, text }: { agent: AgentVariant; name: string; tag: string; text: string }) {
  return (
    <article className="rdos-thread-message">
      <img src={agentAssets[agent]} alt="" />
      <div>
        <header><strong>{name}</strong><b>{tag}</b><span>13:24</span></header>
        <p>{text}</p>
      </div>
    </article>
  );
}

function Toggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button className="rdos-toggle-row" type="button" onClick={onToggle}>
      <span>{label}</span>
      <i className={active ? "is-active" : ""} />
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rdos-stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg className="rdos-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {name === "grid" && <><rect x="3" y="3" width="7" height="7" rx="1.5" {...common} /><rect x="14" y="3" width="7" height="7" rx="1.5" {...common} /><rect x="3" y="14" width="7" height="7" rx="1.5" {...common} /><rect x="14" y="14" width="7" height="7" rx="1.5" {...common} /></>}
      {name === "folder" && <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...common} />}
      {name === "list" && <><rect x="3.5" y="4" width="4" height="4" rx="1" {...common} /><rect x="3.5" y="10" width="4" height="4" rx="1" {...common} /><rect x="3.5" y="16" width="4" height="4" rx="1" {...common} /><line x1="11" y1="6" x2="20" y2="6" {...common} /><line x1="11" y1="12" x2="20" y2="12" {...common} /><line x1="11" y1="18" x2="20" y2="18" {...common} /></>}
      {name === "agents" && <><circle cx="9" cy="8" r="3" {...common} /><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.6M20.5 20a6 6 0 0 0-3.4-5" {...common} /></>}
      {name === "book" && <><path d="M12 6c-1.6-1-4.2-1.5-6.2-1v13c2-.5 4.6 0 6.2 1 1.6-1 4.2-1.5 6.2-1V5c-2-.5-4.6 0-6.2 1z" {...common} /><line x1="12" y1="6" x2="12" y2="19" {...common} /></>}
      {name === "doc" && <><path d="M6 3h8l4 4v14H6z" {...common} /><path d="M14 3v4h4" {...common} /><line x1="9" y1="13" x2="15" y2="13" {...common} /><line x1="9" y1="16.5" x2="15" y2="16.5" {...common} /></>}
      {name === "sliders" && <><line x1="4" y1="8" x2="20" y2="8" {...common} /><line x1="4" y1="16" x2="20" y2="16" {...common} /><circle cx="9" cy="8" r="2.3" fill="#fff" stroke="currentColor" strokeWidth="1.8" /><circle cx="15" cy="16" r="2.3" fill="#fff" stroke="currentColor" strokeWidth="1.8" /></>}
      {name === "chat" && <path d="M4 5h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-4 3v-3a1 1 0 0 1-1-1V6a1 1 0 0 1 0-1z" {...common} />}
      {name === "pen" && <><path d="M5 19h4L18.5 9.5l-4-4L5 15z" {...common} /><line x1="13" y1="7" x2="17" y2="11" {...common} /></>}
      {name === "search" && <><circle cx="10.5" cy="10.5" r="6" {...common} /><line x1="15" y1="15" x2="21" y2="21" {...common} /></>}
      {name === "crown" && <path d="M4 8l4 4 4-7 4 7 4-4v10H4z" {...common} />}
      {name === "nodes" && <><circle cx="6" cy="7" r="2" {...common} /><circle cx="18" cy="7" r="2" {...common} /><circle cx="12" cy="18" r="2" {...common} /><path d="M8 8l3 8M16 8l-3 8M8 7h8" {...common} /></>}
      {name === "shelf" && <><rect x="4" y="5" width="4" height="14" {...common} /><rect x="10" y="5" width="4" height="14" {...common} /><rect x="16" y="5" width="4" height="14" {...common} /></>}
      {name === "chart" && <><path d="M4 18l5-6 4 3 7-9" {...common} /><circle cx="4" cy="18" r="1.5" {...common} /><circle cx="9" cy="12" r="1.5" {...common} /><circle cx="13" cy="15" r="1.5" {...common} /><circle cx="20" cy="6" r="1.5" {...common} /></>}
      {name === "flask" && <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3" {...common} /><path d="M7 16h10" {...common} /></>}
      {name === "send" && <><line x1="4" y1="12" x2="19" y2="12" {...common} /><path d="M13 6l6 6-6 6" {...common} /></>}
    </svg>
  );
}
