import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  getDemoResearchLabState,
  loadResearchLabState,
  registerIngestFolder,
  runAgentAction,
  scanIngestFolder,
  submitLeaderDecision,
  type AgentActionValue,
  type IngestScanResult,
  type LeaderDecisionValue,
  type ResearchDataMode,
  type ResearchLabState,
} from "../../api/researchApi";
import type {
  AgentLogEntry,
  AgentVariant,
  LaboratoryRoomData,
  PaperSourceConnector,
  RoomId,
  WorkflowCardData,
} from "../../types/research";

type ScreenId = "map" | "debate" | "reader" | "report" | "agents" | "library" | "reports" | "projects" | "tasks" | "settings";

const initialResearchLabState = getDemoResearchLabState();

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

function firstCard(cards: WorkflowCardData[], predicate: (card: WorkflowCardData) => boolean) {
  return cards.find(predicate);
}

export function ResearchDinoOS() {
  const [screen, setScreen] = useState<ScreenId>("map");
  const [rooms, setRooms] = useState<LaboratoryRoomData[]>(initialResearchLabState.rooms);
  const [cards, setCards] = useState<WorkflowCardData[]>(initialResearchLabState.cards);
  const [logs, setLogs] = useState<AgentLogEntry[]>(initialResearchLabState.logs);
  const [dataMode, setDataMode] = useState<ResearchDataMode>(initialResearchLabState.mode);
  const [loadError, setLoadError] = useState<string>();
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string>();
  const [ingestPath, setIngestPath] = useState("");
  const [ingestResult, setIngestResult] = useState<IngestScanResult>();

  function applyResearchLabState(nextState: ResearchLabState) {
    setRooms(nextState.rooms);
    setCards(nextState.cards);
    setLogs(nextState.logs);
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
  const activePaper = firstCard(cards, (card) => card.type === "paper" && card.status !== "failed");
  const activeDebate =
    firstCard(cards, (card) => card.type === "claim_debate" && card.status !== "stored_in_library") ??
    firstCard(cards, (card) => card.type === "claim_debate");
  const activeHypothesis = firstCard(cards, (card) => card.type === "hypothesis");
  const reviewCards = cards.filter((card) => card.requiresUserReview || card.status === "waiting_for_user" || card.status === "waiting_for_leader_review");
  const libraryCards = cards.filter((card) => card.currentRoom === "library" || card.status === "stored_in_library");

  const stats = useMemo(() => {
    const inProgress = cards.filter((card) => runningStatuses.has(card.status)).length;
    const waiting = cards.filter((card) => waitingStatuses.has(card.status)).length;
    const completed = cards.filter((card) => completeStatuses.has(card.status)).length;
    return {
      totalTasks: cards.length + rooms.reduce((total, room) => total + room.metrics.active, 0),
      inProgress,
      waiting,
      completed: Math.max(completed, 8),
      running: inProgress,
      online: new Set(rooms.map((room) => room.agent)).size,
      successRate: 98,
    };
  }, [cards, rooms]);

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
      const folder = await registerIngestFolder(ingestPath.trim());
      if (!folder.exists) {
        setActionMessage("Folder was registered, but it does not exist on this machine.");
        return;
      }
      const result = await scanIngestFolder();
      setIngestResult(result);
      await refreshState();
      setActionMessage(`Scanned ${result.pdfCount} PDFs and created ${result.paperCardCount} paper cards.`);
      setScreen("reader");
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
            <span>Active Project</span>
            <strong>AutoPhagy Mechanism</strong>
            <em>Smith et al., 2023</em>
          </section>

          <section className="rdos-stat-list" aria-label="Task summary">
            <StatRow label="Total Tasks" value={stats.totalTasks} />
            <StatRow label="In Progress" value={stats.inProgress} />
            <StatRow label="Waiting" value={stats.waiting} />
            <StatRow label="Completed" value={stats.completed} />
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
              <button type="button">
                <small>Active Project</small>
                <strong>AutoPhagy Mechanism</strong>
              </button>
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
                cards={cards}
                roomLookup={roomLookup}
                stats={stats}
                onNavigate={setScreen}
              />
            )}
            {screen === "debate" && (
              <DebateScreen
                card={activeDebate}
                onRunDebate={() => handleAgentAction(activeDebate, "run_debate", "reports")}
                onRequestEvidence={() => setScreen("reader")}
                busy={Boolean(busyAction)}
              />
            )}
            {screen === "reader" && (
              <ReaderScreen
                card={activePaper}
                onRunReader={() => handleAgentAction(activePaper, "run_reader", "debate")}
                busy={Boolean(busyAction)}
              />
            )}
            {screen === "report" && <ManuscriptScreen card={firstCard(cards, (card) => card.type === "manuscript")} />}
            {screen === "agents" && <AgentsScreen rooms={rooms} cards={cards} />}
            {screen === "library" && <LibraryScreen cards={libraryCards} allCards={cards} />}
            {screen === "reports" && (
              <ReportsScreen
                reviewCard={reviewCards[0]}
                onStore={() => handleLeaderDecision(reviewCards[0], "stored_in_library")}
                onRevise={() => handleLeaderDecision(reviewCards[0], "needs_revision")}
                onOpenStudio={() => setScreen("report")}
                busy={Boolean(busyAction)}
              />
            )}
            {screen === "projects" && <ProjectsScreen onOpenMap={() => setScreen("map")} />}
            {screen === "tasks" && <TasksScreen cards={cards} />}
            {screen === "settings" && (
              <SettingsScreen
                dataMode={dataMode}
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
  onNavigate,
}: {
  rooms: LaboratoryRoomData[];
  cards: WorkflowCardData[];
  roomLookup: Map<RoomId, LaboratoryRoomData>;
  stats: { online: number; running: number; waiting: number; successRate: number };
  onNavigate: (screen: ScreenId) => void;
}) {
  const queueCards = cards.filter((card) => !completeStatuses.has(card.status)).slice(0, 4);
  const layoutLookup = new Map(roomLayout.map((room) => [room.id, room]));

  return (
    <section className="rdos-map-screen">
      <div className="rdos-map-stage">
        <svg className="rdos-map-flow" viewBox="0 0 1300 685" aria-hidden="true">
          <defs>
            <marker id="rdos-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path className="rdos-arrow-shape" d="M0 0L9 4.5L0 9" fill="#c8c8c8" />
              </marker>
            <marker id="rdos-arrow-live" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <path className="rdos-arrow-shape" d="M0 0L9 4.5L0 9" fill="#2f7d5f" />
            </marker>
          </defs>
          <ManualFlow d="M580 198V252" live kind="directive" label="L1 Directive" x={602} y={224} />
          <ManualFlow d="M650 252V198" kind="brief" label="R1 Brief" x={671} y={224} />
          <ManualFlow d="M420 343C342 343 332 322 271 322" live kind="task" label="T1 Search Task" x={323} y={318} />
          <ManualFlow d="M585 434V468H150V494" kind="task" label="Task Fanout" x={452} y={464} />
          <ManualFlow d="M585 468H438V494" kind="task" />
          <ManualFlow d="M585 468H703V494" kind="task" />
          <ManualFlow d="M585 468H968V494" kind="task" />
          <ManualFlow d="M585 468H1205V494" kind="task" />
          <ManualFlow d="M144 416V494" live kind="data" label="C1 Search-Read" x={161} y={456} />
          <ManualFlow d="M274 580H315" live kind="data" label="C2 Reader-Critic" x={322} y={480} />
          <ManualFlow d="M560 580H580" live kind="data" label="C3 Critic-Strategy" x={580} y={480} />
          <ManualFlow d="M825 580H845" live kind="data" label="C4 Strategy-Experiment" x={838} y={480} />
          <ManualFlow d="M703 666C772 684 1060 684 1205 666" kind="data" label="C5 Strategy/Reader -> Writer" x={882} y={674} />
          <ManualFlow d="M730 122H805V210H1015V278" kind="store" label="A1 Approved Store" x={912} y={210} />
          <ManualFlow d="M1157 422V494" kind="store" label="K2 Library -> Writing" x={1174} y={456} />
          <ManualFlow d="M1015 354C918 393 812 444 703 494" kind="store" label="K1 Library -> Strategy" x={845} y={410} />
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
  label,
  x = 0,
  y = 0,
}: {
  d: string;
  live?: boolean;
  kind: "brief" | "data" | "directive" | "store" | "task";
  label?: string;
  x?: number;
  y?: number;
}) {
  const labelWidth = label ? Math.max(82, label.length * 7 + 22) : 0;
  return (
    <g className={`rdos-flow-group rdos-flow-group--${kind}${live ? " is-live" : ""}`}>
      <path
        className={`rdos-flow-line rdos-flow-line--${kind}${live ? " is-live" : ""}`}
        d={d}
        markerEnd={live ? "url(#rdos-arrow-live)" : "url(#rdos-arrow)"}
      />
      {label && (
        <g className="rdos-flow-label" transform={`translate(${x} ${y})`}>
          <rect x={-labelWidth / 2} y={-11} width={labelWidth} height={22} rx={11} />
          <text x="0" y="4" textAnchor="middle">{label}</text>
        </g>
      )}
    </g>
  );
}

function MapInfoCards({ stats }: { stats: { online: number; running: number; waiting: number; successRate: number } }) {
  return (
    <>
      <aside className="rdos-map-card rdos-legend-card">
        <strong>Legend</strong>
        <span><i className="solid" />Directive</span>
        <span><i className="dash" />Brief / Update</span>
        <span><i className="long" />Data Flow</span>
        <span><i className="dot" />Store / Archive</span>
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
  onRequestEvidence,
  busy,
}: {
  card?: WorkflowCardData;
  onRunDebate: () => void;
  onRequestEvidence: () => void;
  busy: boolean;
}) {
  return (
    <section className="rdos-debate-grid">
      <aside className="rdos-panel">
        <span className="rdos-eyebrow">Claim Under Debate</span>
        <h2>{card?.details.claim_text ?? card?.title ?? "No active debate card yet"}</h2>
        <div className="rdos-chip-row">
          <b>Round 3/5</b><b>32 Turns</b><b>Smith et al. 2023</b>
        </div>
        <span className="rdos-live-pill">Debating</span>
        <Participant name="Critic Dino" role="Challenger" agent="critic" />
        <Participant name="Reader Dino" role="Evidence" agent="reader" />
        <Participant name="Strategist Dino" role="Defender" agent="strategist" />
      </aside>
      <section className="rdos-panel rdos-thread">
        <span className="rdos-eyebrow">Debate Thread</span>
        <ThreadMessage agent="critic" name="Critic Dino" tag="Challenge" text="The claim needs stronger controls and independent replication before it can enter the Library." />
        <ThreadMessage agent="reader" name="Reader Dino" tag="Evidence" text="Reader extracted supporting evidence and marked weak source spans for review." />
        <ThreadMessage agent="strategist" name="Strategist Dino" tag="Defend" text="The unresolved issue can become a testable hypothesis if Experiment Bay validates the controls." />
        <ThreadMessage agent="experiment" name="Experiment Dino" tag="Protocol" text="A time-course assay with vehicle and unstressed controls is feasible as a first protocol skeleton." />
        <div className="rdos-composer">
          <img src={agentAssets.leader} alt="" />
          <span>Leader asks for a decision-ready packet...</span>
          <button type="button"><Icon name="send" /></button>
        </div>
      </section>
      <aside className="rdos-panel">
        <span className="rdos-eyebrow">Scorecard</span>
        <div className="rdos-score-grid"><b>Support 3</b><b>Challenge 2</b></div>
        <div className="rdos-confidence"><span>Confidence</span><i><b style={{ width: "68%" }} /></i><em>68%</em></div>
        <h3>Key Points</h3>
        <ul className="rdos-keypoints">
          <li className="good">Evidence packet is ready for Leader review.</li>
          <li className="bad">Control condition remains under-specified.</li>
          <li>Experiment Bay can draft a protocol skeleton.</li>
        </ul>
        <button className="rdos-primary-action" type="button" disabled={busy || !card} onClick={onRunDebate}>Accept & Send to Leader</button>
        <button className="rdos-secondary-action" type="button" onClick={onRequestEvidence}>Request More Evidence</button>
      </aside>
    </section>
  );
}

function ReaderScreen({ card, onRunReader, busy }: { card?: WorkflowCardData; onRunReader: () => void; busy: boolean }) {
  return (
    <section className="rdos-reader-grid">
      <aside className="rdos-panel rdos-now-reading">
        <span className="rdos-eyebrow">Now Reading</span>
        <img src={agentAssets.reader} alt="" />
        <h2>{card?.title ?? "No paper selected"}</h2>
        <p>Smith et al. · Nature Neuroscience · 2023</p>
        <div className="rdos-chip-row"><b>Autophagy</b><b>ULK1</b><b>Neuron</b></div>
        <div className="rdos-progress"><span>Progress</span><i><b style={{ width: `${card?.progress ?? 24}%` }} /></i></div>
      </aside>
      <article className="rdos-panel rdos-reading-pane">
        <h2>Abstract</h2>
        <p>
          Autophagy regulates protein aggregate clearance in stressed neurons. The current evidence suggests a timing-dependent
          activation pattern, but several control details remain unresolved.
        </p>
        <p>
          Reader Dino highlights <mark>claim candidates, evidence spans, limitations, and missing controls</mark> before Debate Room review.
        </p>
        <div className="rdos-reader-note">
          <img src={agentAssets.reader} alt="" />
          <span>Reader Note</span>
          <p>Run Reader to create a traceable Debate Room claim card from this paper.</p>
        </div>
      </article>
      <aside className="rdos-panel">
        <span className="rdos-eyebrow">AI Summary</span>
        <h3>Key Findings</h3>
        <ul>
          <li>Candidate claim extracted from paper metadata or parsed text.</li>
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
      </aside>
    </section>
  );
}

function ManuscriptScreen({ card }: { card?: WorkflowCardData }) {
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
        <h2>{card?.title ?? "Autophagy Mechanism Manuscript"}</h2>
        <em>ResearchDino Lab · AutoPhagy Mechanism</em>
        <h3>Abstract</h3>
        <p>Autophagy-mediated aggregate clearance remains a promising but evidence-sensitive mechanism in dopaminergic neurons.</p>
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

function AgentsScreen({ rooms, cards }: { rooms: LaboratoryRoomData[]; cards: WorkflowCardData[] }) {
  const agents = rooms.map((room) => ({
    agent: room.agent,
    name: `${room.agent[0].toUpperCase()}${room.agent.slice(1)} Dino`,
    role: roomPurpose[room.id],
    status: displayStatus(room.status),
    room: room.title,
    cards: cards.filter((card) => card.currentRoom === room.id).length,
  }));
  return (
    <section>
      <ScreenHeader eyebrow="Agents" title="9 Autonomous Agents" meta={<><span className="rdos-online-dot" />6 Online <b>3 Idle</b></>} />
      <div className="rdos-agent-grid">
        {agents.map((agent) => (
          <article className="rdos-agent-card" key={`${agent.agent}-${agent.room}`}>
            <img src={agentAssets[agent.agent]} alt="" />
            <div>
              <strong>{agent.name}</strong>
              <span>{agent.role}</span>
            </div>
            <em className={agent.status.includes("debating") ? "is-live" : ""}>{agent.status}</em>
            <p>Current Task: {agent.room}</p>
            <footer><span>{agent.room}</span><b>{agent.cards} Cards</b></footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function LibraryScreen({ cards, allCards }: { cards: WorkflowCardData[]; allCards: WorkflowCardData[] }) {
  const rows = cards.length > 0 ? cards : allCards.slice(0, 7);
  return (
    <section>
      <ScreenHeader eyebrow="Library" title="Knowledge Library" meta={<input className="rdos-search-input" placeholder="Search approved papers, claims, evidence..." />} />
      <div className="rdos-filter-row"><b>All · 42</b><span>Read · 18</span><span>Reading · 6</span><span>Queued · 18</span></div>
      <div className="rdos-library-list">
        {rows.map((card, index) => (
          <article className="rdos-library-row" key={card.id}>
            <Icon name="book" />
            <div>
              <strong>{card.title}</strong>
              <span>Smith et al. · {index % 2 ? "Science" : "Nature"} · 2023</span>
            </div>
            <b>{card.type.replace(/_/g, " ")}</b>
            <em className={card.status === "running" ? "is-live" : ""}>{displayStatus(card.status)}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportsScreen({
  reviewCard,
  onStore,
  onRevise,
  onOpenStudio,
  busy,
}: {
  reviewCard?: WorkflowCardData;
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
          <h2>Evidence-backed Autophagy Mechanism Draft</h2>
          <p>Writing Studio · Today · 18 citations</p>
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
      <div className="rdos-card-grid">
        {["Weekly Research Brief", "Debate Summary", "Experiment Plan v2", "Literature Gap Analysis", "Reading Digest", "Leader Decision Log"].map((title, index) => (
          <article className="rdos-small-report" key={title}>
            <Icon name={index === 2 ? "flask" : "doc"} />
            <em>{index % 3 === 0 ? "Final" : index % 3 === 1 ? "Draft" : "Pending"}</em>
            <strong>{title}</strong>
            <span>ResearchDino · Today</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectsScreen({ onOpenMap }: { onOpenMap: () => void }) {
  return (
    <section>
      <ScreenHeader eyebrow="Projects" title="Research Programs" meta={<button className="rdos-secondary-action" type="button">New Project</button>} />
      <article className="rdos-feature-card">
        <Icon name="folder" />
        <div>
          <span className="rdos-live-pill">Active</span>
          <h2>AutoPhagy Mechanism</h2>
          <p>Seeded from Smith et al., 2023 · 9 agents</p>
          <div className="rdos-project-stats"><b>12 Tasks</b><b>6 Running</b><b>4 Outputs</b></div>
        </div>
        <button type="button" onClick={onOpenMap}>Open Lab Map</button>
      </article>
      <div className="rdos-project-grid">
        {["Tau Propagation", "Gut-Brain Axis", "Mitophagy in ALS", "Neuroinflammation Atlas"].map((title, index) => (
          <article className="rdos-panel" key={title}>
            <span className="rdos-eyebrow">{index === 2 ? "Paused" : index === 3 ? "Done" : "Active"}</span>
            <h2>{title}</h2>
            <p>Research program · {index + 4} agents</p>
            <div className="rdos-progress"><i><b style={{ width: `${[58, 44, 28, 100][index]}%` }} /></i></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TasksScreen({ cards }: { cards: WorkflowCardData[] }) {
  const columns = [
    { title: "Waiting", cards: cards.filter((card) => waitingStatuses.has(card.status)).slice(0, 3) },
    { title: "In Progress", cards: cards.filter((card) => runningStatuses.has(card.status)).slice(0, 4) },
    { title: "Review", cards: cards.filter((card) => card.requiresUserReview).slice(0, 2) },
    { title: "Done", cards: cards.filter((card) => completeStatuses.has(card.status)).slice(0, 3) },
  ];
  return (
    <section>
      <ScreenHeader eyebrow="Tasks" title="Task Board" meta={<span>AutoPhagy Mechanism · {cards.length} tasks</span>} />
      <div className="rdos-kanban">
        {columns.map((column) => (
          <section className="rdos-kanban-column" key={column.title}>
            <h3>{column.title} <span>{column.cards.length}</span></h3>
            {column.cards.map((card, index) => (
              <article className={`rdos-task-card${column.title === "Done" ? " is-done" : ""}`} key={card.id}>
                <div><b>{card.currentRoom}</b><em className={`priority-${priorityLabel(card, index).toLowerCase()}`}>{priorityLabel(card, index)}</em></div>
                <strong>{card.title}</strong>
                <footer><img src={agentAssets[card.assignedAgent]} alt="" />{card.assignedAgent}<span>{card.status === "debating" ? "Live" : card.requiresUserReview ? "User" : ""}</span></footer>
              </article>
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function SettingsScreen({
  dataMode,
  sourceConnectors,
  ingestPath,
  ingestResult,
  busy,
  onPathChange,
  onSubmit,
}: {
  dataMode: ResearchDataMode;
  sourceConnectors: PaperSourceConnector[];
  ingestPath: string;
  ingestResult?: IngestScanResult;
  busy: boolean;
  onPathChange: (path: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section>
      <ScreenHeader eyebrow="Settings" title="ResearchDino Controls" meta={<button className="rdos-primary-action" type="button">Save Changes</button>} />
      <div className="rdos-settings-grid">
        <article className="rdos-panel rdos-source-panel">
          <span className="rdos-eyebrow">Paper Sources</span>
          <div className="rdos-source-list">
            {sourceConnectors.map((connector) => (
              <SourceConnectorRow connector={connector} key={connector.id} />
            ))}
          </div>
        </article>
        <article className="rdos-panel">
          <span className="rdos-eyebrow">Autonomy</span>
          <div className="rdos-segment"><button>Manual</button><button className="is-active">Assisted</button><button>Auto</button></div>
          <Toggle label="Auto-approve low-risk claims" active={false} />
          <label className="rdos-range">Max parallel tasks <input type="range" min="1" max="9" defaultValue="6" /></label>
        </article>
        <article className="rdos-panel">
          <span className="rdos-eyebrow">Models</span>
          <StatRow label="Reasoning & debate" value="Ollama local" />
          <StatRow label="Read & summarize" value="Ollama local" />
          <Toggle label="Local inference" active />
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
              <StatRow label="Paper Cards" value={ingestResult.paperCardCount} />
              <StatRow label="Parser" value={ingestResult.parserAvailable ? "PyMuPDF" : "Missing"} />
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function SourceConnectorRow({ connector }: { connector: PaperSourceConnector }) {
  const status = connector.enabled ? "Connected" : connector.access === "license_gated" ? "Needs account" : "Not connected";
  return (
    <div className={`rdos-source-row${connector.enabled ? " is-enabled" : ""}`}>
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
    </div>
  );
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

function Toggle({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="rdos-toggle-row">
      <span>{label}</span>
      <i className={active ? "is-active" : ""} />
    </div>
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
